const db = require("../models");
const sequelize = db.sequelize;



exports.getRestockLogs = async (req, res) => {
  try {
    const { supplier_id, item_id, brand_id, category_id, date_from, date_to } = req.query;

    let whereLogs = {};
    if (supplier_id) whereLogs.supplier_id = Number(supplier_id);
    if (item_id) whereLogs.item_id = Number(item_id);

    
    if (date_from || date_to) {
      whereLogs.created_at = {};
      if (date_from) whereLogs.created_at[db.Sequelize.Op.gte] = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        whereLogs.created_at[db.Sequelize.Op.lte] = end;
      }
    }

    let itemWhere = { deleted_at: null };
    if (brand_id) itemWhere.brand_id = Number(brand_id);
    if (category_id) itemWhere.category_id = Number(category_id);

    const logs = await db.RestockLog.findAll({
      where: whereLogs,
      include: [
        {
          model: db.Item,
          where: itemWhere,
          attributes: ["id", "name", "sell_price"],
          include: [
            { model: db.Brand, attributes: ["name"] },
            { model: db.Category, attributes: ["name"] }
          ]
        },
        {
          model: db.Supplier,
          attributes: ["id", "name"]
        }
      ],
      order: [["created_at", "DESC"]]
    });

    const result = logs.map(log => ({
      id: log.id,
      created_at: log.created_at,
      item_id: log.item_id,
      item_name: log.Item ? log.Item.name : "",
      brand: log.Item && log.Item.Brand ? log.Item.Brand.name : "",
      category: log.Item && log.Item.Category ? log.Item.Category.name : "",
      sell_price: log.Item ? Number(log.Item.sell_price) : 0,
      supplier_id: log.supplier_id,
      supplier_name: log.Supplier ? log.Supplier.name : "",
      quantity: log.quantity,
      cost_price: Number(log.cost_price),
      total_cost: Number(log.quantity) * Number(log.cost_price)
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Failed to fetch restock logs:", error);
    res.status(500).json({ error: "Failed to fetch restock logs" });
  }
};
