const fs = require("fs");
const path = require("path");
const db = require("../models");
const Item = db.Item;
const Brand = db.Brand;
const Category = db.Category;

function saveBase64Image(base64Data) {
  if (!base64Data || typeof base64Data !== "string" || !base64Data.startsWith("data:image/")) {
    return base64Data;
  }

  const matches = base64Data.match(/^data:image\/([A-Za-z0-9-+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Data;
  }

  let ext = matches[1];
  if (ext === "jpeg") ext = "jpg";
  const dataBuffer = Buffer.from(matches[2], "base64");
  const filename = `item-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  const backendDir = path.join(__dirname, "..", "images");
  const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");

  if (!fs.existsSync(backendDir)) {
    fs.mkdirSync(backendDir, { recursive: true });
  }
  fs.writeFileSync(path.join(backendDir, filename), dataBuffer);

  try {
    if (!fs.existsSync(frontendDir)) {
      fs.mkdirSync(frontendDir, { recursive: true });
    }
    fs.writeFileSync(path.join(frontendDir, filename), dataBuffer);
  } catch (err) {
    console.warn("Failed to write to frontend directory:", err.message);
  }

  return `images/${filename}`;
}

// 1. GET ALL ITEMS (mapped to frontend expectations)
exports.getItems = async (req, res) => {
  try {
    const { status } = req.query; // active | deactivated | all
    let whereClause = {};
    if (!status || status === "active") {
      whereClause = { deleted_at: null };
    } else if (status === "deactivated") {
      whereClause = { deleted_at: { [require("sequelize").Op.ne]: null } };
    }
    // status === "all" → no where clause, fetch everything

    const items = await Item.findAll({
      where: whereClause,
      include: [
        { model: Brand, attributes: ["name"] },
        { model: Category, attributes: ["name"] }
      ]
    });

    const mappedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      brand_id: item.brand_id,
      category_id: item.category_id,
      brand: item.Brand ? item.Brand.name : "",
      category: item.Category ? item.Category.name : "",
      price: Number(item.sell_price),
      cost_price: Number(item.cost_price),
      stock: item.quantity,
      image: item.image_path || "",
      desc: item.description || "",
      deleted_at: item.deleted_at || null
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
    const { name, brandName, categoryName, price, cost_price, stock, image, desc } = req.body;

    if (!name || !brandName || !categoryName || price === undefined) {
      return res.status(400).json({ error: "Name, brand, category, and price are required" });
    }

    // Look up brand ID
    const brand = await Brand.findOne({ where: { name: brandName, deleted_at: null } });
    if (!brand) return res.status(400).json({ error: `Brand "${brandName}" not found` });

    // Look up category ID
    const category = await Category.findOne({ where: { name: categoryName.toLowerCase(), deleted_at: null } });
    if (!category) return res.status(400).json({ error: `Category "${categoryName}" not found` });

    // Use provided cost_price or auto-calculate as 60% of sell price
    const finalCostPrice = (cost_price !== undefined && cost_price !== null && cost_price !== '')
      ? Number(cost_price)
      : Math.round(Number(price) * 0.6);

    const item = await Item.create({
      brand_id: brand.id,
      category_id: category.id,
      supplier_id: 1, // Default supplier ID
      name: name.trim(),
      description: desc ? desc.trim() : null,
      cost_price: finalCostPrice,
      sell_price: Number(price),
      quantity: stock ? Number(stock) : 0,
      image_path: saveBase64Image(image) || null
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
    const { id, name, brandName, categoryName, price, cost_price, stock, image, desc } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    const item = await Item.findOne({ where: { id, deleted_at: null } });
    if (!item) return res.status(404).json({ error: "Item not found" });

    const updateData = {};

    if (name) updateData.name = name.trim();
    if (desc !== undefined) updateData.description = desc ? desc.trim() : null;
    if (price !== undefined) {
      updateData.sell_price = Number(price);
      // Use provided cost_price or auto-calculate
      updateData.cost_price = (cost_price !== undefined && cost_price !== null && cost_price !== '')
        ? Number(cost_price)
        : Math.round(Number(price) * 0.6);
    } else if (cost_price !== undefined && cost_price !== null && cost_price !== '') {
      updateData.cost_price = Number(cost_price);
    }
    if (image !== undefined) updateData.image_path = saveBase64Image(image);

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

    if (stock !== undefined) {
      updateData.quantity = Number(stock);
    }

    await item.update(updateData);

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

// 5. RESTORE ITEM (un-soft-delete)
exports.restoreItem = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Item ID is required" });

    const item = await Item.findOne({ where: { id } });
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (!item.deleted_at) return res.status(400).json({ error: "Item is already active" });

    await item.update({ deleted_at: null });
    res.status(200).json({ success: true, message: "Item restored successfully!" });
  } catch (error) {
    console.error("Failed to restore item:", error);
    res.status(500).json({ error: "Failed to restore item" });
  }
};
