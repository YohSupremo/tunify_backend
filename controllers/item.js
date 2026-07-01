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

    const items = await Item.findAll({
      where: whereClause,
      include: [
        { model: Brand, attributes: ["name"] },
        { model: Category, attributes: ["name"] },
        { model: db.Supplier, attributes: ["name"] },
        { model: db.ItemImage, as: "images" },
        { model: db.RestockLog, as: "restockLogs", limit: 1, order: [["created_at", "DESC"]] }
      ]
    });

    const mappedItems = items.map(item => {
      const primaryImgObj = (item.images && item.images.find(img => img.is_primary)) || (item.images && item.images[0]);
      const latestRestock = item.restockLogs && item.restockLogs.length > 0 ? item.restockLogs[0] : null;
      return {
        id: item.id,
        name: item.name,
        brand_id: item.brand_id,
        category_id: item.category_id,
        supplier_id: item.supplier_id,
        brand: item.Brand ? item.Brand.name : "",
        category: item.Category ? item.Category.name : "",
        supplier: item.Supplier ? item.Supplier.name : "",
        price: Number(item.sell_price),
        cost_price: latestRestock ? Number(latestRestock.cost_price) : 0,
        stock: item.quantity,
        image: primaryImgObj ? primaryImgObj.image_path : "",
        images: item.images ? item.images.map(img => ({
          id: img.id,
          image_path: img.image_path,
          is_primary: img.is_primary,
          sort_order: img.sort_order
        })).sort((a, b) => a.sort_order - b.sort_order) : [],
        desc: item.description || "",
        deleted_at: item.deleted_at || null
      };
    });

    res.status(200).json(mappedItems);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
};

// 2. CREATE ITEM
exports.createItem = async (req, res) => {
  try {
    const { name, brandName, categoryName, supplierName, price, stock, desc } = req.body;

    if (!name || !brandName || !categoryName || !supplierName || price === undefined) {
      return res.status(400).json({ error: "Name, brand, category, supplier, and price are required" });
    }

    // Look up brand ID
    const brand = await Brand.findOne({ where: { name: brandName, deleted_at: null } });
    if (!brand) return res.status(400).json({ error: `Brand "${brandName}" not found` });

    // Look up category ID
    const category = await Category.findOne({ where: { name: categoryName.toLowerCase(), deleted_at: null } });
    if (!category) return res.status(400).json({ error: `Category "${categoryName}" not found` });

    // Look up supplier ID
    const supplier = await db.Supplier.findOne({ where: { name: supplierName, deleted_at: null } });
    if (!supplier) return res.status(400).json({ error: `Supplier "${supplierName}" not found` });

    const item = await Item.create({
      brand_id: brand.id,
      category_id: category.id,
      supplier_id: supplier.id,
      name: name.trim(),
      description: desc ? desc.trim() : null,
      sell_price: Number(price),
      quantity: 0
    });

    // Handle multiple uploaded files
    if (req.files && req.files.length > 0) {
      const primaryIdx = req.body.primaryImageIndex !== undefined ? Number(req.body.primaryImageIndex) : 0;
      
      const imageRecords = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const filename = file.filename;
        const relativePath = `images/${filename}`;

        // Copy file to frontend images folder
        const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
        try {
          if (!fs.existsSync(frontendDir)) {
            fs.mkdirSync(frontendDir, { recursive: true });
          }
          fs.copyFileSync(file.path, path.join(frontendDir, filename));
        } catch (err) {
          console.warn("Failed to copy file to frontend:", err.message);
        }

        imageRecords.push({
          item_id: item.id,
          image_path: relativePath,
          is_primary: i === primaryIdx,
          sort_order: i
        });
      }

      await db.ItemImage.bulkCreate(imageRecords);
    }

    res.status(201).json({ success: true, message: "Item created successfully!", item });
  } catch (error) {
    console.error("Failed to create item:", error);
    res.status(500).json({ error: "Failed to create item" });
  }
};

// 3. UPDATE ITEM
exports.updateItem = async (req, res) => {
  try {
    const { id, name, brandName, categoryName, supplierName, price, stock, desc } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    const item = await Item.findOne({ where: { id, deleted_at: null } });
    if (!item) return res.status(404).json({ error: "Item not found" });

    let updateData = {};

    if (name) updateData.name = name.trim();
    if (desc !== undefined) updateData.description = desc ? desc.trim() : null;
    if (price !== undefined) {
      updateData.sell_price = Number(price);
    }

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

    if (supplierName) {
      const supplier = await db.Supplier.findOne({ where: { name: supplierName, deleted_at: null } });
      if (!supplier) return res.status(400).json({ error: `Supplier "${supplierName}" not found` });
      updateData.supplier_id = supplier.id;
    }

    await item.update(updateData);

    // --- Process multiple images ---
    const keptImageIds = req.body.existingImages ? JSON.parse(req.body.existingImages) : null;
    if (keptImageIds) {
      await db.ItemImage.destroy({
        where: {
          item_id: id,
          id: { [require("sequelize").Op.notIn]: keptImageIds }
        }
      });
    }

    const primaryImage = req.body.primaryImage; // e.g. "existing_12" or "new_0"
    if (primaryImage && primaryImage.startsWith("existing_")) {
      const primaryId = parseInt(primaryImage.split("_")[1]);
      await db.ItemImage.update({ is_primary: true }, { where: { id: primaryId, item_id: id } });
      await db.ItemImage.update({ is_primary: false }, { where: { item_id: id, id: { [require("sequelize").Op.ne]: primaryId } } });
    } else if (primaryImage && primaryImage.startsWith("new_")) {
      await db.ItemImage.update({ is_primary: false }, { where: { item_id: id } });
    }

    // Process new uploads
    if (req.files && req.files.length > 0) {
      const maxSortOrderImg = await db.ItemImage.findOne({
        where: { item_id: id },
        order: [["sort_order", "DESC"]]
      });
      let startSortOrder = maxSortOrderImg ? maxSortOrderImg.sort_order + 1 : 0;

      const imageRecords = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const filename = file.filename;
        const relativePath = `images/${filename}`;

        // Copy file to frontend images folder
        const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
        try {
          if (!fs.existsSync(frontendDir)) {
            fs.mkdirSync(frontendDir, { recursive: true });
          }
          fs.copyFileSync(file.path, path.join(frontendDir, filename));
        } catch (err) {
          console.warn("Failed to copy file to frontend:", err.message);
        }

        const isThisPrimary = (primaryImage === `new_${i}`) || (!primaryImage && i === 0 && startSortOrder === 0);

        imageRecords.push({
          item_id: id,
          image_path: relativePath,
          is_primary: isThisPrimary,
          sort_order: startSortOrder + i
        });
      }

      await db.ItemImage.bulkCreate(imageRecords);
    }

    // Ensure at least one image is primary if any exist
    const currentImages = await db.ItemImage.findAll({ where: { item_id: id } });
    if (currentImages.length > 0) {
      const hasPrimary = currentImages.some(img => img.is_primary);
      if (!hasPrimary) {
        await currentImages[0].update({ is_primary: true });
      }
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
