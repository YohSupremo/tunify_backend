const db = require("../models");

// 1. GET ALL ORDERS (Supports Admin and Customer filtering)
exports.getOrders = async (req, res) => {
  try {
    const roleQuery = await db.User.findOne({ where: { id: req.body.user.id, deleted_at: null } });
    if (!roleQuery) return res.status(404).json({ error: "User not found" });

    let whereClause = "";
    let replacements = {};
    if (roleQuery.role !== 'admin') {
      whereClause = "WHERE oi.user_id = :userId";
      replacements = { userId: req.body.user.id };
    }

    const query = `
      SELECT 
        oi.id,
        DATE_FORMAT(oi.date_placed, '%Y-%m-%d') as date,
        os.status_name as status,
        COALESCE(SUM(ol.quantity * ol.sell_price), 0) as total,
        GROUP_CONCAT(i.name SEPARATOR '||') as items_list,
        DATE_FORMAT(oi.date_shipped, '%Y-%m-%d') as date_shipped
      FROM orderinfo oi
      LEFT JOIN orderline ol ON oi.id = ol.orderinfo_id
      LEFT JOIN item i ON ol.item_id = i.id
      LEFT JOIN order_statuses os ON oi.status_id = os.id
      ${whereClause}
      GROUP BY oi.id
      ORDER BY oi.date_placed DESC;
    `;

    const orders = await db.sequelize.query(query, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT
    });

    const formatted = orders.map(o => ({
      id: 'TN-' + String(o.id).padStart(4, '0'),
      raw_id: o.id,
      date: o.date,
      status: o.status,
      total: parseFloat(o.total || 0),
      items: o.items_list ? o.items_list.split('||') : [],
      date_shipped: o.date_shipped
    }));

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// 2. PLACE AN ORDER
exports.placeOrder = async (req, res) => {
  try {
    const { cart } = req.body;
    if (!cart || !cart.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Get user's shipping address (default first, or fallback to most recent)
    const [shippingAddress] = await db.sequelize.query(
      "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND is_default = 1 AND deleted_at IS NULL LIMIT 1",
      {
        replacements: { userId: req.body.user.id },
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    let address = shippingAddress;
    if (!address) {
      const [fallbackAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
        {
          replacements: { userId: req.body.user.id },
          type: db.sequelize.QueryTypes.SELECT
        }
      );
      address = fallbackAddress;
    }

    if (!address) {
      return res.status(400).json({ error: "Please add a shipping address in your profile before placing an order." });
    }

    // Insert into orderinfo
    const [orderId] = await db.sequelize.query(
      "INSERT INTO orderinfo (user_id, address_id, shipping_street, shipping_city, shipping_province, shipping_zip, shipping_fee, date_placed) VALUES (:userId, :addressId, :street, :city, :province, :zip, 100.00, CURRENT_TIMESTAMP)",
      {
        replacements: {
          userId: req.body.user.id,
          addressId: address.id,
          street: address.street,
          city: address.city,
          province: address.province,
          zip: address.zip_code
        },
        type: db.sequelize.QueryTypes.INSERT
      }
    );

    // Insert order lines and decrement stock
    for (const item of cart) {
      await db.sequelize.query(
        "INSERT INTO orderline (orderinfo_id, item_id, quantity, sell_price) VALUES (:orderinfoId, :itemId, :quantity, :sellPrice)",
        {
          replacements: {
            orderinfoId: orderId,
            itemId: item.item_id,
            quantity: item.quantity,
            sellPrice: item.price
          },
          type: db.sequelize.QueryTypes.INSERT
        }
      );

      // Decrement stock quantity
      await db.sequelize.query(
        "UPDATE item SET quantity = GREATEST(quantity - :quantity, 0) WHERE id = :itemId",
        {
          replacements: {
            quantity: item.quantity,
            itemId: item.item_id
          },
          type: db.sequelize.QueryTypes.UPDATE
        }
      );
    }

    // Calculate total and insert payment record
    let orderSubtotal = 0;
    for (const item of cart) {
      orderSubtotal += parseFloat(item.price) * parseInt(item.quantity);
    }
    const amountPaid = orderSubtotal + 100.00; // subtotal + shipping fee

    await db.sequelize.query(
      "INSERT INTO payments (orderinfo_id, payment_method, amount_paid, payment_status, paid_at) VALUES (:orderinfoId, 'cod', :amountPaid, 'pending', NULL)",
      {
        replacements: {
          orderinfoId: orderId,
          amountPaid: amountPaid
        },
        type: db.sequelize.QueryTypes.INSERT
      }
    );

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      orderId: 'TN-' + String(orderId).padStart(4, '0')
    });
  } catch (error) {
    console.error("Failed to place order:", error);
    res.status(500).json({ error: "Failed to place order" });
  }
};

// 3. UPDATE ORDER STATUS
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // status name (string) or status ID (number)

    if (!id || status === undefined) {
      return res.status(400).json({ error: "Order ID and status are required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    // Resolve status name and ID
    let statusId = null;
    let statusName = null;

    if (typeof status === 'number' || !isNaN(status)) {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE id = :id",
        { replacements: { id: Number(status) }, type: db.sequelize.QueryTypes.SELECT }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    } else {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE LOWER(status_name) = LOWER(:name)",
        { replacements: { name: String(status).trim() }, type: db.sequelize.QueryTypes.SELECT }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    }

    if (!statusId) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    // Get current order state to check for stock restoration
    const [oldOrder] = await db.sequelize.query(
      "SELECT status_id FROM orderinfo WHERE id = :id",
      { replacements: { id: rawId }, type: db.sequelize.QueryTypes.SELECT }
    );

    if (!oldOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    const oldStatusId = oldOrder.status_id;

    // 1. Stock handling if order is Cancelled
    if (statusId === 5 && oldStatusId !== 5) {
      // Transitioning TO Cancelled: Restore stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.sequelize.QueryTypes.SELECT }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = quantity + :qty WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.sequelize.QueryTypes.UPDATE }
        );
      }
    } else if (statusId !== 5 && oldStatusId === 5) {
      // Transitioning FROM Cancelled: Decrement stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.sequelize.QueryTypes.SELECT }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = GREATEST(quantity - :qty, 0) WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.sequelize.QueryTypes.UPDATE }
        );
      }
    }

    // 2. COD payment handling if status is Delivered
    if (statusName === 'Delivered') {
      await db.sequelize.query(
        "UPDATE payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_method = 'cod' AND payment_status = 'pending'",
        { replacements: { orderId: rawId }, type: db.sequelize.QueryTypes.UPDATE }
      );
    }

    // Determine date_shipped update
    let dateShippedQuery = "";
    if (statusName === 'Shipped' || statusName === 'Delivered') {
      dateShippedQuery = "date_shipped = COALESCE(date_shipped, CURRENT_TIMESTAMP)";
    } else {
      dateShippedQuery = "date_shipped = NULL";
    }

    // Update order status
    await db.sequelize.query(
      `UPDATE orderinfo SET status_id = :statusId, ${dateShippedQuery} WHERE id = :id`,
      {
        replacements: { statusId, id: rawId },
        type: db.sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({ success: true, message: `Order status updated to ${statusName}!` });
  } catch (error) {
    console.error("Failed to update order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

// 4. GET ORDER DETAILS (Invoice/Receipt details)
exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    // Get order summary & customer details
    const [order] = await db.sequelize.query(
      `SELECT 
         oi.id,
         DATE_FORMAT(oi.date_placed, '%Y-%m-%d %H:%i:%s') as date_placed,
         DATE_FORMAT(oi.date_shipped, '%Y-%m-%d %H:%i:%s') as date_shipped,
         os.status_name as status,
         oi.status_id,
         oi.shipping_street,
         oi.shipping_city,
         oi.shipping_province,
         oi.shipping_zip,
         oi.shipping_fee,
         u.email as customer_email,
         CONCAT(c.first_name, ' ', c.last_name) as customer_name,
         c.phone as customer_phone,
         p.payment_method,
         p.payment_status
       FROM orderinfo oi
       JOIN users u ON oi.user_id = u.id
       JOIN customer c ON u.id = c.user_id
       LEFT JOIN order_statuses os ON oi.status_id = os.id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       WHERE oi.id = :id`,
      {
        replacements: { id: rawId },
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get order items (lines)
    const items = await db.sequelize.query(
      `SELECT 
         ol.quantity,
         ol.sell_price as price,
         i.name as name
       FROM orderline ol
       JOIN item i ON ol.item_id = i.id
       WHERE ol.orderinfo_id = :id`,
      {
        replacements: { id: rawId },
        type: db.sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      ...order,
      items
    });
  } catch (error) {
    console.error("Failed to fetch order details:", error);
    res.status(500).json({ error: "Failed to fetch order details" });
  }
};
