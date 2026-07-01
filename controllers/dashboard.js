const db = require("../models");
const sequelize = db.sequelize;

exports.addressChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT count(id) as total, CONCAT(city, ', ', province) as addressline FROM customer_addresses WHERE deleted_at IS NULL GROUP BY city, province ORDER BY total DESC",
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching address chart data" });
  }
};

exports.categoryChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT 
         c.name as category, 
         COALESCE(SUM(CASE 
           WHEN oi.status_id IS NOT NULL AND ((p.payment_method != 'cod' AND oi.status_id IN (2, 3, 4)) OR (p.payment_method = 'cod' AND oi.status_id = 4)) 
           THEN ol.quantity 
           ELSE 0 
         END), 0) as total 
       FROM category c 
       LEFT JOIN item i ON c.id = i.category_id 
       LEFT JOIN orderline ol ON i.id = ol.item_id 
       LEFT JOIN orderinfo oi ON ol.orderinfo_id = oi.id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       GROUP BY c.name`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    const totalSold = rows.reduce((sum, r) => sum + parseInt(r.total || 0), 0);
    const result = rows.map(r => {
      const total = parseInt(r.total || 0);
      const pct = totalSold > 0 ? Math.round((total / totalSold) * 100) : 0;
      return {
        label: r.category.charAt(0).toUpperCase() + r.category.slice(1),
        pct: pct
      };
    });
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching category chart data" });
  }
};

exports.salesChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT 
         MONTHNAME(oi.date_placed) as month, 
         SUM(CASE 
           WHEN ((p.payment_method != 'cod' AND oi.status_id IN (2, 3, 4)) OR (p.payment_method = 'cod' AND oi.status_id = 4)) 
           THEN ol.quantity * ol.sell_price 
           ELSE 0 
         END) as total 
       FROM orderinfo oi 
       INNER JOIN orderline ol ON oi.id = ol.orderinfo_id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       GROUP BY MONTH(oi.date_placed), MONTHNAME(oi.date_placed)
       ORDER BY MONTH(oi.date_placed)`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching sales chart data" });
  }
};

exports.itemsChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT 
         i.name as items, 
         SUM(CASE 
           WHEN ((p.payment_method != 'cod' AND oi.status_id IN (2, 3, 4)) OR (p.payment_method = 'cod' AND oi.status_id = 4)) 
           THEN ol.quantity 
           ELSE 0 
         END) as total 
       FROM item i 
       INNER JOIN orderline ol ON i.id = ol.item_id 
       INNER JOIN orderinfo oi ON ol.orderinfo_id = oi.id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id
       GROUP BY i.name`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching items chart data" });
  }
};

exports.dashboardStats = async (req, res) => {
  try {
    const [revOrderRes] = await sequelize.query(
      `SELECT 
         COALESCE(SUM(CASE 
           WHEN ((p.payment_method != 'cod' AND oi.status_id IN (2, 3, 4)) OR (p.payment_method = 'cod' AND oi.status_id = 4)) 
           THEN ol.quantity * ol.sell_price 
           ELSE 0 
         END), 0) as total_revenue, 
         COUNT(DISTINCT oi.id) as order_count 
       FROM orderinfo oi 
       LEFT JOIN orderline ol ON oi.id = ol.orderinfo_id
       LEFT JOIN payments p ON oi.id = p.orderinfo_id`,
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    
    const [custRes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM customer WHERE deleted_at IS NULL",
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    const [outOfStockRes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM item WHERE quantity = 0 AND deleted_at IS NULL",
      { type: db.Sequelize.QueryTypes.SELECT }
    );

    const [settingsRes] = await sequelize.query(
      "SELECT low_stock_threshold FROM settings LIMIT 1",
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    const threshold = parseInt(settingsRes ? settingsRes.low_stock_threshold : 5) || 5;

    const [lowStockRes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM item WHERE quantity > 0 AND quantity <= :threshold AND deleted_at IS NULL",
      { replacements: { threshold }, type: db.Sequelize.QueryTypes.SELECT }
    );

    const dbRevenue = parseFloat(revOrderRes.total_revenue || 0);
    const dbOrders = parseInt(revOrderRes.order_count || 0);
    const dbCustomers = parseInt(custRes.count || 0);
    const dbOutOfStock = parseInt(outOfStockRes.count || 0);
    const dbLowStock = parseInt(lowStockRes.count || 0);

    res.status(200).json({
      revenue: dbRevenue,
      orders: dbOrders,
      customers: dbCustomers,
      outOfStock: dbOutOfStock,
      lowStock: dbLowStock
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching dashboard stats" });
  }
};
