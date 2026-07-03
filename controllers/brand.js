const db = require("../models");
const Brand = db.Brand;
const Item = db.Item;

// 1. GET ALL
exports.getBrands = async (req, res) => {
  try {
    const { status } = req.query; // active | deactivated | all
    let whereClause = {};
    if (!status || status === "active") {
      whereClause = { deleted_at: null };
    } else if (status === "deactivated") {
      whereClause = { deleted_at: { [db.Sequelize.Op.ne]: null } };
    }

    const brands = await Brand.findAll({
      where: whereClause
    });
    res.status(200).json(brands);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
};

// 2. CREATE
exports.createBrand = async (req, res) => {
  try {
    const { name, description, productIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    let logoPath = null;
    if (req.file) {
      logoPath = "images/" + req.file.filename;
      const fs = require("fs");
      const path = require("path");
      const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
      try {
        if (!fs.existsSync(frontendDir)) {
          fs.mkdirSync(frontendDir, { recursive: true });
        }
        fs.copyFileSync(req.file.path, path.join(frontendDir, req.file.filename));
      } catch (err) {
        console.warn("Failed to copy brand logo to frontend:", err.message);
      }
    }

    // 1. Create the brand
    const brand = await Brand.create({ 
      name: name.trim(),
      description: description ? description.trim() : null,
      logo_path: logoPath
    });

    let productIdsParsed = [];
    if (productIds) {
      try {
        productIdsParsed = JSON.parse(productIds);
      } catch (e) {
        productIdsParsed = productIds;
      }
    }

    // 2. If products were checked, assign them to the new brand ID
    if (Array.isArray(productIdsParsed) && productIdsParsed.length > 0) {
      await Item.update(
        { brand_id: brand.id },
        { where: { id: { [db.Sequelize.Op.in]: productIdsParsed } } }
      );
    }

    res.status(201).json({ success: true, message: "Brand added!", brand });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Brand already exists" });
    }
    res.status(500).json({ error: "Failed to create brand" });
  }
};  

// 3. UPDATE (Updates details + updates associated product IDs)
exports.updateBrand = async (req, res) => {
  try {
    const { oldName, newName, description, productIds } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ error: "Both old name and new name are required" });
    }

    const brand = await Brand.findOne({
      where: { name: oldName, deleted_at: null }
    });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    let logoPath = brand.logo_path;
    if (req.file) {
      logoPath = "images/" + req.file.filename;
      const fs = require("fs");
      const path = require("path");
      const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
      try {
        if (!fs.existsSync(frontendDir)) {
          fs.mkdirSync(frontendDir, { recursive: true });
        }
        fs.copyFileSync(req.file.path, path.join(frontendDir, req.file.filename));
      } catch (err) {
        console.warn("Failed to copy brand logo to frontend:", err.message);
      }
    } else if (req.body.logo_path === '') {
      logoPath = null;
    }

    // A. Update brand details
    await brand.update({ 
      name: newName.trim(),
      description: description !== undefined ? description.trim() : brand.description,
      logo_path: logoPath
    });

    let productIdsParsed = [];
    if (productIds) {
      try {
        productIdsParsed = JSON.parse(productIds);
      } catch (e) {
        productIdsParsed = productIds;
      }
    }

    // B. Re-associate products if productIds array was sent
    if (Array.isArray(productIdsParsed)) {
      if (productIdsParsed.length > 0) {
        // 1. Revert items that were in this brand but are now unchecked (set brand_id to default 1)
        await Item.update(
          { brand_id: 1 }, 
          { where: { brand_id: brand.id, id: { [db.Sequelize.Op.notIn]: productIdsParsed } } }
        );

        // 2. Set brand_id to this brand's ID for all checked items
        await Item.update(
          { brand_id: brand.id },
          { where: { id: { [db.Sequelize.Op.in]: productIdsParsed } } }
        );
      } else {
        // Revert all items that were in this brand to default 1
        await Item.update(
          { brand_id: 1 },
          { where: { brand_id: brand.id } }
        );
      }
    }

    res.status(200).json({ success: true, message: "Brand updated!" });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Brand name already exists" });
    }
    res.status(500).json({ error: "Failed to update brand" });
  }
};

// 4. DELETE
exports.deleteBrand = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brand name is required to delete" });
    }

    const brand = await Brand.findOne({
      where: { name, deleted_at: null }
    });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    const itemCount = await Item.count({
      where: { brand_id: brand.id, deleted_at: null }
    });

    if (itemCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete brand — it is linked to ${itemCount} item(s)` 
      });
    }

    await brand.update({ deleted_at: new Date() });
    res.status(200).json({ success: true, message: `Brand "${name}" deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete brand" });
  }
};

// 5. RESTORE
exports.restoreBrand = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Brand name is required to restore" });
    }

    const brand = await Brand.findOne({
      where: { name }
    });

    if (!brand) {
      return res.status(404).json({ error: "Brand not found" });
    }

    if (!brand.deleted_at) {
      return res.status(400).json({ error: "Brand is already active" });
    }

    await brand.update({ deleted_at: null });
    res.status(200).json({ success: true, message: `Brand "${name}" restored successfully!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to restore brand" });
  }
};