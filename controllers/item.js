const db = require("../models");
const Item = db.Item;
const Brand = db.Brand;
const Category = db.Category;

// 1. GET ALL ITEMS (mapped to frontend expectations)
exports.getItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      where: { deleted_at: null },
      include: [
        { model: Brand, attributes: ["name"] },
        { model: Category, attributes: ["name"] },
        { model: db.Stock, attributes: ["quantity"] }
      ]
    });

    const mappedItems = items.map(item => ({
      id: item.id,
      name: item.description, // description stores the product name
      brand_id: item.brand_id,
      category_id: item.category_id,
      brand: item.Brand ? item.Brand.name : "",
      category: item.Category ? item.Category.name : "",
      price: Number(item.sell_price),
      cost_price: Number(item.cost_price),
      stock: item.Stock ? item.Stock.quantity : 0,
      image: item.image_path || ""
    }));

    res.status(200).json(mappedItems);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

// 2. CREATE ITEM
exports.createItem = async (req, res) => {
  try {
    const { name, brandName, categoryName, price, stock, image } = req.body;

    if (!name || !brandName || !categoryName || price === undefined) {
      return res.status(400).json({ error: "Name, brand, category, and price are required" });
    }

    // Look up brand ID
    const brand = await Brand.findOne({ where: { name: brandName, deleted_at: null } });
    if (!brand) return res.status(400).json({ error: `Brand "${brandName}" not found` });

    // Look up category ID
    const category = await Category.findOne({ where: { name: categoryName.toLowerCase(), deleted_at: null } });
    if (!category) return res.status(400).json({ error: `Category "${categoryName}" not found` });

    // Create item
    const cost_price = Math.round(Number(price) * 0.6);
    const item = await Item.create({
      brand_id: brand.id,
      category_id: category.id,
      supplier_id: 1, // Default supplier ID
      description: name.trim(),
      cost_price,
      sell_price: Number(price),
      image_path: image || null
    });

    // Create stock entry
    await db.Stock.create({
      item_id: item.id,
      quantity: stock ? Number(stock) : 0
    });

    res.status(201).json({ success: true, message: "Item created successfully!", item });
  } catch (error) {
    console.error("Failed to create item:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

// 3. UPDATE ITEM
exports.updateItem = async (req, res) => {
  try {
    const { id, name, brandName, categoryName, price, stock, image } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    const item = await Item.findOne({ where: { id, deleted_at: null } });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const updateData = {};

    if (name) updateData.description = name.trim();
    if (price !== undefined) {
      updateData.sell_price = Number(price);
      updateData.cost_price = Math.round(Number(price) * 0.6);
    }
    if (image !== undefined) updateData.image_path = image;

    if (brandName) {
      const brand = await Brand.findOne({ where: { name: brandName, deleted_at: null } });
      if (!brand) return res.status(400).json({ error: `Brand "${brandName}" not found` });
      updateData.brand_id = brand.id;
    }

    if (categoryName) {
      const category = await Category.findOne({ where: { name: categoryName.toLowerCase(), deleted_at: null } });
      if (!category) return res.status(400).json({ error: `Category "${categoryName}" not found` });
      updateData.category_id = category.id;
    }

    await item.update(updateData);

    // Update stock entry
    if (stock !== undefined) {
      const [stockObj] = await db.Stock.findOrCreate({
        where: { item_id: item.id },
        defaults: { quantity: Number(stock) }
      });
      await stockObj.update({ quantity: Number(stock) });
    }

    res.status(200).json({ success: true, message: "Item updated successfully!" });
  } catch (error) {
    console.error("Failed to update item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
};

// 4. DELETE ITEM (Soft Delete)
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    const item = await Item.findOne({ where: { id, deleted_at: null } });
    if (!item) return res.status(404).json({ error: "Item not found" });

    await item.update({ deleted_at: new Date() });

    res.status(200).json({ success: true, message: "Item deleted successfully!" });
  } catch (error) {
    console.error("Failed to delete item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
};
