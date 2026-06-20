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
        CASE WHEN oi.date_shipped IS NULL THEN 'Processing' ELSE 'Shipped' END as status,
        COALESCE(SUM(ol.quantity * ol.sell_price), 0) as total,
        GROUP_CONCAT(i.description SEPARATOR '||') as items_list,
        DATE_FORMAT(oi.date_shipped, '%Y-%m-%d') as date_shipped
      FROM orderinfo oi
      LEFT JOIN orderline ol ON oi.id = ol.orderinfo_id
      LEFT JOIN item i ON ol.item_id = i.id
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

    // Insert into orderinfo
    const [orderId] = await db.sequelize.query(
      "INSERT INTO orderinfo (user_id, date_placed, shipping_fee) VALUES (:userId, CURRENT_TIMESTAMP, 100.00)",
      {
        replacements: { userId: req.body.user.id },
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
        "UPDATE stock SET quantity = GREATEST(quantity - :quantity, 0) WHERE item_id = :itemId",
        {
          replacements: {
            quantity: item.quantity,
            itemId: item.item_id
          },
          type: db.sequelize.QueryTypes.UPDATE
        }
      );
    }

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

// 3. SHIP ORDER (Update date_shipped)
exports.shipOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const rawId = Number(id.replace('TN-', '')) || id;

    const [updateResult] = await db.sequelize.query(
      "UPDATE orderinfo SET date_shipped = CURRENT_TIMESTAMP WHERE id = :id",
      {
        replacements: { id: rawId },
        type: db.sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({ success: true, message: "Order marked as Shipped!" });
  } catch (error) {
    console.error("Failed to ship order:", error);
    res.status(500).json({ error: "Failed to ship order" });
  }
};
