const db = require("../models");
const Stock = db.Stock;
const Item = db.Item;
const Category = db.Category;

// 1. GET ALL STOCKS (mapped to frontend expectations)
exports.getStocks = async (req, res) => {
  try {
    const stocks = await Stock.findAll({
      include: [
        {
          model: Item,
          attributes: ["id", "description"],
          where: { deleted_at: null },
          include: [
            { model: Category, attributes: ["name"] }
          ]
        }
      ]
    });

    const mappedStocks = stocks.map(s => ({
      id: s.Item ? s.Item.id : s.item_id, // Return item_id as the ID for frontend lookup
      name: s.Item ? s.Item.description : "Unknown Item",
      category: (s.Item && s.Item.Category) ? s.Item.Category.name : "uncategorized",
      stock: s.quantity
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

    const [stock, created] = await Stock.findOrCreate({
      where: { item_id: itemId },
      defaults: { quantity: quantity }
    });

    if (!created) {
      await stock.update({ quantity });
    }

    res.status(200).json({ success: true, message: "Stock updated successfully!" });
  } catch (error) {
    console.error("Failed to update stock:", error);
    res.status(500).json({ error: "Failed to update stock" });
  }
};
