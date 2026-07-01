const db = require("../models");
const Item = db.Item;
const Category = db.Category;

// 1. GET ALL STOCKS (mapped to frontend expectations)
exports.getStocks = async (req, res) => {
  try {
    const items = await Item.findAll({
      where: { deleted_at: null },
      include: [
        { model: Category, attributes: ["name"] },
        { model: db.RestockLog, as: "restockLogs", limit: 1, order: [["created_at", "DESC"]] }
      ]
    });

    const mappedStocks = items.map(i => {
      const latestRestock = i.restockLogs && i.restockLogs.length > 0 ? i.restockLogs[0] : null;
      return {
        id: i.id,
        name: i.name,
        category: i.Category ? i.Category.name : "uncategorized",
        stock: i.quantity,
        price: Number(i.sell_price),
        cost_price: latestRestock ? Number(latestRestock.cost_price) : 0,
        supplier_id: i.supplier_id
      };
    });

    res.status(200).json(mappedStocks);
  } catch (error) {
    console.error("Failed to fetch stocks:", error);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
};

exports.bulkRestock = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { restocks } = req.body; // Array of { itemId, quantityToAdd, costPrice }

    if (!Array.isArray(restocks) || restocks.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Invalid restock list" });
    }

    for (const entry of restocks) {
      const { itemId, quantityToAdd, costPrice } = entry;

      if (!itemId || !quantityToAdd || quantityToAdd <= 0 || !costPrice || costPrice <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: "Invalid restock entry details" });
      }

      // Find item
      const item = await Item.findOne({
        where: { id: itemId, deleted_at: null },
        transaction
      });

      if (!item) {
        await transaction.rollback();
        return res.status(404).json({ error: `Item with ID ${itemId} not found` });
      }

      if (Number(costPrice) > Number(item.sell_price)) {
        await transaction.rollback();
        return res.status(400).json({ error: `Unit cost price for "${item.name}" (₱${Number(costPrice).toLocaleString()}) cannot exceed its selling price (₱${Number(item.sell_price).toLocaleString()})` });
      }

      // Update quantity on item
      await item.update(
        {
          quantity: item.quantity + Number(quantityToAdd)
        },
        { transaction }
      );

      // Create restock log using the item's assigned supplier
      await db.RestockLog.create(
        {
          item_id: itemId,
          supplier_id: item.supplier_id || null,
          quantity: Number(quantityToAdd),
          cost_price: Number(costPrice)
        },
        { transaction }
      );
    }

    await transaction.commit();
    res.status(200).json({ success: true, message: "Bulk restocking completed successfully!" });
  } catch (error) {
    await transaction.rollback();
    console.error("Bulk restocking failed:", error);
    res.status(500).json({ error: "Bulk restocking failed" });
  }
};
