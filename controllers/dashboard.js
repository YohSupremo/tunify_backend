const db = require("../models");
const sequelize = db.sequelize;

exports.addressChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT count(address_line) as total, address_line as addressline FROM customer WHERE deleted_at IS NULL GROUP BY address_line ORDER BY total DESC",
      { type: sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching address chart data" });
  }
};

exports.salesChart = async (req, res) => {
  try {
    const rows = await sequelize.query(
      "SELECT monthname(oi.date_placed) as month, sum(ol.quantity * i.sell_price) as total FROM orderinfo oi INNER JOIN orderline ol ON oi.id = ol.orderinfo_id INNER JOIN item i ON i.id = ol.item_id GROUP BY month(oi.date_placed)",
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
      "SELECT i.description as items, sum(ol.quantity) as total FROM item i INNER JOIN orderline ol ON i.id = ol.item_id GROUP BY i.description",
      { type: sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching items chart data" });
  }
};
