const db = require("../models");
const Item = db.Item;
const Category = db.Category;

// 1. GET ALL STOCKS (mapped to frontend expectations)
exports.getStocks = async (req, res) => {
  try {
    const items = await Item.findAll({
      where: { deleted_at: null },
      include: [
        { model: Category, attributes: ["name"] }
      ]
    });

    const mappedStocks = items.map(i => ({
      id: i.id,
      name: i.name,
      category: i.Category ? i.Category.name : "uncategorized",
      stock: i.quantity
    }));

    res.status(200).json(mappedStocks);
  } catch (error) {
    console.error("Failed to fetch stocks:", error);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
};

// 2. UPDATE STOCK LEVEL BY ITEM ID
exports.updateStock = async (req, res) => {
  try {
    const { itemId, quantity } = req.body;

    if (itemId === undefined || quantity === undefined) {
      return res.status(400).json({ error: "Item ID and quantity are required" });
    }

    const item = await Item.findOne({
      where: { id: itemId, deleted_at: null }
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    await item.update({ quantity: Number(quantity) });

    res.status(200).json({ success: true, message: "Stock updated successfully!" });
  } catch (error) {
    console.error("Failed to update stock:", error);
    res.status(500).json({ error: "Failed to update stock" });
  }
};
