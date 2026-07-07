const db = require("../models");
const Item = db.Item;
const Category = db.Category;


exports.getStocks = async (req, res) => {
  try {
    const items = await Item.findAll({
      where: { deleted_at: null },
      include: [
        { model: Category, attributes: ["name"] },
        {
          model: db.RestockLog,
          as: "restockLogs",
          limit: 1,
          order: [["created_at", "DESC"]],
          include: [{ model: db.Supplier, attributes: ["name", "id"] }]
        }
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
        last_supplier_id: latestRestock && latestRestock.Supplier ? latestRestock.Supplier.id : null,
        last_supplier_name: latestRestock && latestRestock.Supplier ? latestRestock.Supplier.name : null
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
    const { restocks } = req.body;

    if (!Array.isArray(restocks) || restocks.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Restock list cannot be empty." });
    }

    
    const failedLines = [];
    const itemCache = {};
    const supplierCache = {};

    for (let i = 0; i < restocks.length; i++) {
      const { itemId, quantityToAdd, costPrice, supplierId } = restocks[i];

      
      if (!supplierId) {
        failedLines.push({ lineIndex: i + 1, itemId, reason: "A supplier must be selected for this row." });
        continue;
      }

      if (!supplierCache[supplierId]) {
        const supplier = await db.Supplier.findOne({
          where: { id: supplierId, deleted_at: null },
          transaction
        });
        if (!supplier) {
          failedLines.push({ lineIndex: i + 1, itemId, reason: `Selected supplier ID ${supplierId} not found or deactivated.` });
          continue;
        }
        supplierCache[supplierId] = supplier;
      }

      
      if (!itemId || !Number.isInteger(Number(quantityToAdd)) || Number(quantityToAdd) <= 0) {
        failedLines.push({ lineIndex: i + 1, itemId, reason: "Quantity must be a positive whole number." });
        continue;
      }

      
      if (costPrice === undefined || costPrice === null || Number(costPrice) <= 0) {
        failedLines.push({ lineIndex: i + 1, itemId, reason: "Cost price must be a positive number." });
        continue;
      }

      
      const item = await Item.findOne({ where: { id: itemId, deleted_at: null }, transaction });
      if (!item) {
        failedLines.push({ lineIndex: i + 1, itemId, reason: `Item ID ${itemId} not found.` });
        continue;
      }
      itemCache[itemId] = item;

      
      if (Number(costPrice) >= Number(item.sell_price)) {
        failedLines.push({
          lineIndex: i + 1,
          itemId,
          reason: `Unit cost ₱${Number(costPrice).toLocaleString()} for "${item.name}" must be less than its store selling price ₱${Number(item.sell_price).toLocaleString()}.`
        });
      }
    }

    if (failedLines.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Validation failed on ${failedLines.length} line(s). No records were saved.`,
        failedLines
      });
    }

    
    for (const entry of restocks) {
      const { itemId, quantityToAdd, costPrice, supplierId } = entry;
      const item = itemCache[itemId];

      await item.update({ quantity: item.quantity + Number(quantityToAdd) }, { transaction });

      await db.RestockLog.create(
        {
          item_id: itemId,
          supplier_id: Number(supplierId),
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
