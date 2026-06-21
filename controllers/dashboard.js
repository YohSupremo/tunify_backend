const db = require("../models");
const sequelize = db.sequelize;

exports.addressChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT count(id) as total, CONCAT(city, ', ', province) as addressline FROM customer_addresses WHERE deleted_at IS NULL GROUP BY city, province ORDER BY total DESC",
      { type: sequelize.QueryTypes.SELECT }
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
      "SELECT c.name as category, COALESCE(SUM(ol.quantity), 0) as total FROM category c LEFT JOIN item i ON c.id = i.category_id LEFT JOIN orderline ol ON i.id = ol.item_id GROUP BY c.name",
      { type: sequelize.QueryTypes.SELECT }
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
      "SELECT monthname(oi.date_placed) as month, sum(ol.quantity * ol.sell_price) as total FROM orderinfo oi INNER JOIN orderline ol ON oi.id = ol.orderinfo_id GROUP BY month(oi.date_placed)",
      { type: sequelize.QueryTypes.SELECT }
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
      "SELECT i.name as items, sum(ol.quantity) as total FROM item i INNER JOIN orderline ol ON i.id = ol.item_id GROUP BY i.name",
      { type: sequelize.QueryTypes.SELECT }
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
      "SELECT COALESCE(SUM(ol.quantity * ol.sell_price), 0) as total_revenue, COUNT(DISTINCT oi.id) as order_count FROM orderinfo oi LEFT JOIN orderline ol ON oi.id = ol.orderinfo_id",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const [custRes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM customer WHERE deleted_at IS NULL",
      { type: sequelize.QueryTypes.SELECT }
    );

    const [lowStockRes] = await sequelize.query(
      "SELECT COUNT(*) as count FROM item WHERE quantity <= 5 AND deleted_at IS NULL",
      { type: sequelize.QueryTypes.SELECT }
    );

    const dbRevenue = parseFloat(revOrderRes.total_revenue || 0);
    const dbOrders = parseInt(revOrderRes.order_count || 0);
    const dbCustomers = parseInt(custRes.count || 0);
    const dbLowStock = parseInt(lowStockRes.count || 0);

    res.status(200).json({
      revenue: dbRevenue,
      orders: dbOrders,
      customers: dbCustomers,
      lowStock: dbLowStock
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching dashboard stats" });
  }
};
