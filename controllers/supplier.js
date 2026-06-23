const db = require("../models");
const Supplier = db.Supplier;
const Item = db.Item;

// 1. GET ALL
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { deleted_at: null }
    });
    res.status(200).json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
};

// 2. CREATE
exports.createSupplier = async (req, res) => {
  try {
    const { name, contact_name, email, phone, address_line, productIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      contact_name: contact_name ? contact_name.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      address_line: address_line ? address_line.trim() : null
    });

    // Link products to the new supplier
    if (Array.isArray(productIds) && productIds.length > 0) {
      await Item.update(
        { supplier_id: supplier.id },
        { where: { id: { [db.Sequelize.Op.in]: productIds } } }
      );
    }

    res.status(201).json({ success: true, message: "Supplier added!", supplier });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Supplier name already exists" });
    }
    res.status(500).json({ error: "Failed to create supplier" });
  }
};

// 3. UPDATE (Using the ID in the request path)
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_name, email, phone, address_line, productIds } = req.body;

    const supplier = await Supplier.findOne({
      where: { id, deleted_at: null }
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    await supplier.update({
      name: name !== undefined ? name.trim() : supplier.name,
      contact_name: contact_name !== undefined ? contact_name.trim() : supplier.contact_name,
      email: email !== undefined ? email.trim() : supplier.email,
      phone: phone !== undefined ? phone.trim() : supplier.phone,
      address_line: address_line !== undefined ? address_line.trim() : supplier.address_line
    });

    // Re-associate products
    if (Array.isArray(productIds)) {
      if (productIds.length > 0) {
        // Set supplier_id to NULL for unchecked products formerly supplied by this supplier
        await Item.update(
          { supplier_id: null }, 
          { where: { supplier_id: supplier.id, id: { [db.Sequelize.Op.notIn]: productIds } } }
        );
        // Link the checked products
        await Item.update(
          { supplier_id: supplier.id },
          { where: { id: { [db.Sequelize.Op.in]: productIds } } }
        );
      } else {
        // Revert all products from this supplier to NULL
        await Item.update(
          { supplier_id: null },
          { where: { supplier_id: supplier.id } }
        );
      }
    }

    res.status(200).json({ success: true, message: "Supplier updated!", supplier });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Supplier name already exists" });
    }
    res.status(500).json({ error: "Failed to update supplier" });
  }
};

// 4. DELETE (Soft delete using the ID in the request path)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOne({
      where: { id, deleted_at: null }
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Constraint Check: Don't allow delete if items exist for this supplier
    const itemCount = await Item.count({
      where: { supplier_id: id, deleted_at: null }
    });

    if (itemCount > 0) {
      return res.status(400).json({
        error: `Cannot delete supplier — it is linked to ${itemCount} item(s)`
      });
    }

    await supplier.update({ deleted_at: new Date() });
    res.status(200).json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
};