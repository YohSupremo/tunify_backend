const db = require("../models");
const Supplier = db.Supplier;

// 1. GET ALL — includes restock entry count per supplier
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      where: { deleted_at: null }
    });

    // Attach restock entry counts
    const result = await Promise.all(suppliers.map(async s => {
      const restockCount = await db.RestockLog.count({ where: { supplier_id: s.id } });
      return {
        id: s.id,
        name: s.name,
        contact_name: s.contact_name,
        email: s.email,
        phone: s.phone,
        address_line: s.address_line,
        created_at: s.created_at,
        restock_count: restockCount
      };
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
};

// 2. CREATE
exports.createSupplier = async (req, res) => {
  try {
    const { name, contact_name, email, phone, address_line } = req.body;

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

    res.status(201).json({ success: true, message: "Supplier added!", supplier });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Supplier name already exists" });
    }
    res.status(500).json({ error: "Failed to create supplier" });
  }
};

// 3. UPDATE
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_name, email, phone, address_line } = req.body;

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

    res.status(200).json({ success: true, message: "Supplier updated!", supplier });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Supplier name already exists" });
    }
    res.status(500).json({ error: "Failed to update supplier" });
  }
};

// 4. DEACTIVATE (Soft delete via deleted_at)
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOne({
      where: { id, deleted_at: null }
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Block deactivation if the supplier has restock log history
    // (fk_restock_supplier is ON DELETE RESTRICT at the DB level too)
    const restockCount = await db.RestockLog.count({ where: { supplier_id: id } });
    if (restockCount > 0) {
      return res.status(400).json({
        error: `Cannot deactivate supplier — they have ${restockCount} restock log entry(s). Restock history must be preserved.`
      });
    }

    await supplier.update({ deleted_at: new Date() });
    res.status(200).json({ success: true, message: "Supplier deactivated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to deactivate supplier" });
  }
};