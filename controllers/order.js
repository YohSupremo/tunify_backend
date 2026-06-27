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
      type: db.Sequelize.QueryTypes.SELECT
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
  const transaction = await db.sequelize.transaction();
  try {
    const { cart, payment_method, address_id } = req.body;
    if (!cart || !cart.length) {
      await transaction.rollback();
      return res.status(400).json({ error: "Cart is empty" });
    }

    let address = null;
    if (address_id) {
      const [selectedAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE id = :addressId AND user_id = :userId AND deleted_at IS NULL LIMIT 1",
        {
          replacements: { addressId: address_id, userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = selectedAddress;
    }

    if (!address) {
      // Get user's shipping address (default first, or fallback to most recent)
      const [shippingAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND is_default = 1 AND deleted_at IS NULL LIMIT 1",
        {
          replacements: { userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = shippingAddress;
    }

    if (!address) {
      const [fallbackAddress] = await db.sequelize.query(
        "SELECT id, street, city, province, zip_code FROM customer_addresses WHERE user_id = :userId AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
        {
          replacements: { userId: req.body.user.id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      address = fallbackAddress;
    }

    if (!address) {
      await transaction.rollback();
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
        type: db.Sequelize.QueryTypes.INSERT,
        transaction
      }
    );

    // Insert order lines and decrement stock
    for (const item of cart) {
      // Validate stock levels
      const [itemInDb] = await db.sequelize.query(
        "SELECT id, name, quantity, sell_price FROM item WHERE id = :itemId FOR UPDATE",
        {
          replacements: { itemId: item.item_id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      if (!itemInDb) {
        const err = new Error(`Item with ID ${item.item_id} not found.`);
        err.statusCode = 404;
        throw err;
      }

      if (itemInDb.quantity < item.quantity) {
        const err = new Error(`Insufficient stock for "${itemInDb.name}". Only ${itemInDb.quantity} left in stock.`);
        err.statusCode = 400;
        throw err;
      }

      const sellPrice = itemInDb.sell_price;

      await db.sequelize.query(
        "INSERT INTO orderline (orderinfo_id, item_id, quantity, sell_price) VALUES (:orderinfoId, :itemId, :quantity, :sellPrice)",
        {
          replacements: {
            orderinfoId: orderId,
            itemId: item.item_id,
            quantity: item.quantity,
            sellPrice: sellPrice
          },
          type: db.Sequelize.QueryTypes.INSERT,
          transaction
        }
      );

      // Decrement stock quantity
      await db.sequelize.query(
        "UPDATE item SET quantity = quantity - :quantity WHERE id = :itemId",
        {
          replacements: {
            quantity: item.quantity,
            itemId: item.item_id
          },
          type: db.Sequelize.QueryTypes.UPDATE,
          transaction
        }
      );
    }

    // Calculate total and insert payment record
    let orderSubtotal = 0;
    for (const item of cart) {
      const [itemInDb] = await db.sequelize.query(
        "SELECT sell_price FROM item WHERE id = :itemId",
        {
          replacements: { itemId: item.item_id },
          type: db.Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      const price = itemInDb ? itemInDb.sell_price : item.price;
      orderSubtotal += parseFloat(price) * parseInt(item.quantity);
    }
    const amountPaid = orderSubtotal + 100.00; // subtotal + shipping fee

    let method = 'cod';
    if (payment_method && ['cod', 'gcash', 'card', 'bank_transfer'].includes(payment_method)) {
      method = payment_method;
    }

    const paymentStatus = method === 'cod' ? 'pending' : 'paid';
    const paidAt = method === 'cod' ? null : new Date();
    
    let transactionRef = null;
    if (method !== 'cod') {
      let prefix = '';
      if (method === 'gcash') prefix = 'GC';
      else if (method === 'card') prefix = 'CARD';
      else if (method === 'bank_transfer') prefix = 'BT';

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${date}`;
      transactionRef = `${prefix}-${dateStr}-${String(orderId).padStart(3, '0')}`;
    }

    await db.sequelize.query(
      "INSERT INTO payments (orderinfo_id, payment_method, amount_paid, payment_status, transaction_ref, paid_at) VALUES (:orderinfoId, :method, :amountPaid, :paymentStatus, :transactionRef, :paidAt)",
      {
        replacements: {
          orderinfoId: orderId,
          method,
          amountPaid: amountPaid,
          paymentStatus,
          transactionRef,
          paidAt
        },
        type: db.Sequelize.QueryTypes.INSERT,
        transaction
      }
    );

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      orderId: 'TN-' + String(orderId).padStart(4, '0')
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Failed to place order:", error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || "Failed to place order" });
  }
};

// 3. UPDATE ORDER STATUS
exports.updateOrderStatus = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { status } = req.body; // status name (string) or status ID (number)

    if (!id || status === undefined) {
      await transaction.rollback();
      return res.status(400).json({ error: "Order ID and status are required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    // Resolve status name and ID
    let statusId = null;
    let statusName = null;

    if (typeof status === 'number' || !isNaN(status)) {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE id = :id",
        { replacements: { id: Number(status) }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    } else {
      const [resolved] = await db.sequelize.query(
        "SELECT id, status_name FROM order_statuses WHERE LOWER(status_name) = LOWER(:name)",
        { replacements: { name: String(status).trim() }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (resolved) {
        statusId = resolved.id;
        statusName = resolved.status_name;
      }
    }

    if (!statusId) {
      await transaction.rollback();
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    // Get current order state to check for stock restoration & ownership validation
    const [oldOrder] = await db.sequelize.query(
      "SELECT status_id, user_id FROM orderinfo WHERE id = :id",
      { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
    );

    if (!oldOrder) {
      await transaction.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // Security check: Only admin or the order owner can update/cancel the order
    if (req.body.user.role !== 'admin' && oldOrder.user_id !== req.body.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: "Access denied. You can only update your own orders." });
    }

    const oldStatusId = oldOrder.status_id;

    // 1. Stock handling if order is Cancelled
    if (statusId === 5 && oldStatusId !== 5) {
      // Transitioning TO Cancelled: Restore stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = quantity + :qty WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
    } else if (statusId !== 5 && oldStatusId === 5) {
      // Transitioning FROM Cancelled: Decrement stock
      const lines = await db.sequelize.query(
        "SELECT item_id, quantity FROM orderline WHERE orderinfo_id = :id",
        { replacements: { id: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      for (const line of lines) {
        await db.sequelize.query(
          "UPDATE item SET quantity = GREATEST(quantity - :qty, 0) WHERE id = :itemId",
          { replacements: { qty: line.quantity, itemId: line.item_id }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
    }

    // 2. COD payment handling if status is Delivered
    if (statusName === 'Delivered') {
      await db.sequelize.query(
        "UPDATE payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_method = 'cod' AND payment_status = 'pending'",
        { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
      );
    }

    // Auto-mark non-COD payments as paid when processed/shipped/delivered
    if (statusName === 'Processing' || statusName === 'Shipped' || statusName === 'Delivered') {
      const [payment] = await db.sequelize.query(
        "SELECT payment_method, transaction_ref FROM payments WHERE orderinfo_id = :orderId",
        { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.SELECT, transaction }
      );
      if (payment && payment.payment_method !== 'cod' && !payment.transaction_ref) {
        let prefix = '';
        if (payment.payment_method === 'gcash') prefix = 'GC';
        else if (payment.payment_method === 'card') prefix = 'CARD';
        else if (payment.payment_method === 'bank_transfer') prefix = 'BT';

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${date}`;
        const ref = `${prefix}-${dateStr}-${String(rawId).padStart(3, '0')}`;

        await db.sequelize.query(
          "UPDATE payments SET payment_status = 'paid', transaction_ref = :ref, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_status = 'pending'",
          { replacements: { orderId: rawId, ref }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      } else {
        await db.sequelize.query(
          "UPDATE payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE orderinfo_id = :orderId AND payment_method != 'cod' AND payment_status = 'pending'",
          { replacements: { orderId: rawId }, type: db.Sequelize.QueryTypes.UPDATE, transaction }
        );
      }
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
        type: db.Sequelize.QueryTypes.UPDATE,
        transaction
      }
    );

    await transaction.commit();
    res.status(200).json({ success: true, message: `Order status updated to ${statusName}!` });
  } catch (error) {
    await transaction.rollback();
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
         p.payment_status,
         p.transaction_ref
       FROM orderinfo oi
       JOIN users u ON oi.user_id = u.id
       JOIN customer c ON u.id = c.user_id
       LEFT JOIN order_statuses os ON oi.status_id = os.id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       WHERE oi.id = :id`,
      {
        replacements: { id: rawId },
        type: db.Sequelize.QueryTypes.SELECT
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
        type: db.Sequelize.QueryTypes.SELECT
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
