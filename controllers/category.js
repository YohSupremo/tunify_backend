const db = require("../models");
const Category = db.Category;
const Item = db.Item;

// 1. GET ALL (Returns ID, Name, Description)
exports.getCategories = async (req, res) => {
  try {
    const { status } = req.query; // active | deactivated | all
    let whereClause = {};
    if (!status || status === "active") {
      whereClause = { deleted_at: null };
    } else if (status === "deactivated") {
      whereClause = { deleted_at: { [db.Sequelize.Op.ne]: null } };
    }

    const categories = await Category.findAll({
      where: whereClause
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// 2. CREATE
exports.createCategory = async (req, res) => {
  try {
    const { name, description, productIds } = req.body; // Add productIds here

    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const lowerName = name.trim().toLowerCase();

    // 1. Create the category
    const category = await Category.create({ 
      name: lowerName,
      description: description ? description.trim() : null
    });

    // 2. If products were checked, assign them to the new category ID
    if (Array.isArray(productIds) && productIds.length > 0) {
      await Item.update(
        { category_id: category.id },
        { where: { id: { [db.Sequelize.Op.in]: productIds } } }
      );
    }

    res.status(201).json({ success: true, message: "Category added!", category });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to create category" });
  }
};

// 3. UPDATE (Updates details + updates associated product IDs)
exports.updateCategory = async (req, res) => {
  try {
    const { oldName, newName, description, productIds } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ error: "Both old name and new name are required" });
    }

    const category = await Category.findOne({
      where: { name: oldName.toLowerCase(), deleted_at: null }
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // A. Update category name and description
    await category.update({ 
      name: newName.trim().toLowerCase(),
      description: description !== undefined ? description.trim() : category.description
    });

    // B. Re-associate products if productIds array was sent
    if (Array.isArray(productIds)) {
      if (productIds.length > 0) {
        // 1. Revert items that were in this category but are now unchecked (set category_id to default 1)
        await Item.update(
          { category_id: 1 }, 
          { where: { category_id: category.id, id: { [db.Sequelize.Op.notIn]: productIds } } }
        );

        // 2. Set category_id to this category's ID for all checked items
        await Item.update(
          { category_id: category.id },
          { where: { id: { [db.Sequelize.Op.in]: productIds } } }
        );
      } else {
        // Revert all items that were in this category to default 1
        await Item.update(
          { category_id: 1 },
          { where: { category_id: category.id } }
        );
      }
    }

    res.status(200).json({ success: true, message: "Category updated!" });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Category name already exists" });
    }
    res.status(500).json({ error: "Failed to update category" });
  }
};

// 4. DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required to delete" });
    }

    const category = await Category.findOne({
      where: { name: name.toLowerCase(), deleted_at: null }
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const itemCount = await Item.count({
      where: { category_id: category.id, deleted_at: null }
    });

    if (itemCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category — it is linked to ${itemCount} item(s)` 
      });
    }

    await category.update({ deleted_at: new Date() });
    res.status(200).json({ success: true, message: `Category "${name}" deleted` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete category" });
  }
};

// 5. RESTORE
exports.restoreCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Category name is required to restore" });
    }

    const category = await Category.findOne({
      where: { name: name.toLowerCase() }
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (!category.deleted_at) {
      return res.status(400).json({ error: "Category is already active" });
    }

    await category.update({ deleted_at: null });
    res.status(200).json({ success: true, message: `Category "${name}" restored successfully!` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to restore category" });
  }
};