const db = require("../models");
const Brand = db.Brand;
const Item = db.Item;

// 1. GET ALL
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll({
      where: { deleted_at: null }
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
    const { name, description, productIds } = req.body; // Add productIds here

    if (!name) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    // 1. Create the brand
    const brand = await Brand.create({ 
      name: name.trim(),
      description: description ? description.trim() : null
    });

    // 2. If products were checked, assign them to the new brand ID
    if (Array.isArray(productIds) && productIds.length > 0) {
      await Item.update(
        { brand_id: brand.id },
        { where: { id: { [db.Sequelize.Op.in]: productIds } } }
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

    // A. Update brand details
    await brand.update({ 
      name: newName.trim(),
      description: description !== undefined ? description.trim() : brand.description
    });

    // B. Re-associate products if productIds array was sent
    if (Array.isArray(productIds)) {
      if (productIds.length > 0) {
        // 1. Revert items that were in this brand but are now unchecked (set brand_id to default 1)
        await Item.update(
          { brand_id: 1 }, 
          { where: { brand_id: brand.id, id: { [db.Sequelize.Op.notIn]: productIds } } }
        );

        // 2. Set brand_id to this brand's ID for all checked items
        await Item.update(
          { brand_id: brand.id },
          { where: { id: { [db.Sequelize.Op.in]: productIds } } }
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