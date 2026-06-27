const bcrypt = require("bcryptjs");
const db = require("../models");
const User = db.User;
const Customer = db.Customer;
const sequelize = db.sequelize;

// Helper to enforce admin check
const enforceAdmin = (req, res) => {
  if (!req.body.user || req.body.user.role !== 'admin') {
    res.status(403).json({ error: "Access denied. Admin role required." });
    return false;
  }
  return true;
};

// ─── 1. GET ALL CUSTOMERS (admin list view) ──────────────────────────────────
// Supports ?status=active (default) | deactivated | all & ?role=customer|admin|all
exports.getCustomers = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const status = req.query.status || 'active';
    const role = req.query.role || 'all';

    const whereClauseParts = [];
    const replacements = {};

    if (status === 'deactivated') {
      whereClauseParts.push('u.deleted_at IS NOT NULL');
    } else if (status === 'active') {
      whereClauseParts.push('u.deleted_at IS NULL');
    }

    if (role === 'admin' || role === 'customer') {
      whereClauseParts.push('u.role = :role');
      replacements.role = role;
    }

    const whereClause = whereClauseParts.length > 0
      ? 'WHERE ' + whereClauseParts.join(' AND ')
      : '';

    const rows = await sequelize.query(
      `SELECT
          u.id         AS user_id,
          c.id         AS customer_id,
          u.email,
          c.first_name,
          c.last_name,
          c.phone,
          c.profile_image_path,
          u.role,
          u.created_at,
          u.deleted_at,
          (SELECT COUNT(*) FROM orderinfo o WHERE o.user_id = u.id)        AS order_count,
          (SELECT COUNT(*) FROM customer_addresses a
            WHERE a.user_id = u.id AND a.deleted_at IS NULL)               AS address_count
        FROM users u
        LEFT JOIN customer c ON c.user_id = u.id
        ${whereClause}
        ORDER BY u.id ASC`,
      {
        replacements,
        type: db.Sequelize.QueryTypes.SELECT
      }
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// ─── 2. GET SINGLE CUSTOMER (detail + addresses) ─────────────────────────────
exports.getCustomerById = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const { id } = req.params; // user_id

    const [customer] = await sequelize.query(
      `SELECT
          u.id         AS user_id,
          c.id         AS customer_id,
          u.email,
          c.first_name,
          c.last_name,
          c.phone,
          c.profile_image_path,
          u.role,
          u.created_at,
          u.deleted_at
        FROM users u
        LEFT JOIN customer c ON c.user_id = u.id
        WHERE u.id = ?
        LIMIT 1`,
      { replacements: [id], type: db.Sequelize.QueryTypes.SELECT }
    );

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const addresses = await sequelize.query(
      `SELECT id, label, street, city, province, zip_code, is_default, created_at
        FROM customer_addresses
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY is_default DESC, id DESC`,
      { replacements: [id], type: db.Sequelize.QueryTypes.SELECT }
    );

    res.status(200).json({ customer, addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customer details" });
  }
};

// ─── 3. UPDATE CUSTOMER (admin can edit profile fields + email + role) ───────
// Enhancement: admin can update role (admin/customer), email, name, and phone.
exports.updateCustomer = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const { id } = req.params; // user_id
    const { email, first_name, last_name, phone, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Build the update payload for the users table
    const userUpdates = {};

    // Update email if provided and changed
    if (email && email.trim() !== user.email) {
      userUpdates.email = email.trim();
    }

    // Validate and update role if provided
    if (role !== undefined && role !== null && role !== '') {
      if (!['admin', 'customer'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'customer'." });
      }
      userUpdates.role = role;
    }

    // Hash and update password if provided
    const { password } = req.body;
    if (password && password.trim() !== '') {
      if (password.trim().length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      userUpdates.password_hash = hashedPassword;
    }

    if (Object.keys(userUpdates).length > 0) {
      await user.update(userUpdates);
    }

    // Update customer profile row
    const customer = await Customer.findOne({ where: { user_id: id } });
    if (customer) {
      let imagePath = customer.profile_image_path;
      if (req.file) {
        imagePath = "images/" + req.file.filename;
        const path = require("path");
        const fs = require("fs");
        const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
        try {
          if (!fs.existsSync(frontendDir)) {
            fs.mkdirSync(frontendDir, { recursive: true });
          }
          fs.copyFileSync(req.file.path, path.join(frontendDir, req.file.filename));
        } catch (err) {
          console.warn("Failed to copy profile image to frontend:", err.message);
        }
      }
      await customer.update({
        first_name: first_name !== undefined ? first_name.trim() : customer.first_name,
        last_name:  last_name  !== undefined ? last_name.trim()  : customer.last_name,
        phone:      phone      !== undefined ? phone.trim()      : customer.phone,
        profile_image_path: imagePath
      });
    }

    res.status(200).json({ success: true, message: "Customer updated successfully" });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Email already in use by another account" });
    }
    res.status(500).json({ error: "Failed to update customer" });
  }
};

// ─── 4. SOFT-DELETE / DEACTIVATE CUSTOMER (sets deleted_at on users row) ─────
// Follows the same soft-delete pattern used by deactivateUser in user controller.
exports.deactivateCustomer = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const { id } = req.params; // user_id

    const user = await User.findOne({ where: { id, deleted_at: null } });
    if (!user) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Prevent accidental deactivation of admin accounts via this endpoint
    if (user.role === "admin") {
      return res.status(403).json({ error: "Cannot deactivate an admin account via this endpoint" });
    }

    await user.update({ deleted_at: new Date() });
    res.status(200).json({ success: true, message: "Customer deactivated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to deactivate customer" });
  }
};

// ─── 5. REACTIVATE CUSTOMER (clears deleted_at on users row) ─────────────────
exports.reactivateCustomer = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const { id } = req.params; // user_id

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: "Customer not found" });
    }

    if (user.deleted_at === null) {
      return res.status(400).json({ error: "Customer is already active" });
    }

    await user.update({ deleted_at: null });
    res.status(200).json({ success: true, message: "Customer reactivated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reactivate customer" });
  }
};

// ─── 6. CREATE CUSTOMER (admin can create new user + customer profile) ───────
exports.createCustomer = async (req, res) => {
  try {
    if (!enforceAdmin(req, res)) return;

    const { email, password, first_name, last_name, phone, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.trim(),
      password_hash: hashedPassword,
      role: role || "customer"
    });

    let imagePath = null;
    if (req.file) {
      imagePath = "images/" + req.file.filename;
      const path = require("path");
      const fs = require("fs");
      const frontendDir = path.join(__dirname, "..", "..", "tunify", "images");
      try {
        if (!fs.existsSync(frontendDir)) {
          fs.mkdirSync(frontendDir, { recursive: true });
        }
        fs.copyFileSync(req.file.path, path.join(frontendDir, req.file.filename));
      } catch (err) {
        console.warn("Failed to copy profile image to frontend:", err.message);
      }
    }

    const customer = await Customer.create({
      user_id: user.id,
      first_name: first_name ? first_name.trim() : "",
      last_name: last_name ? last_name.trim() : "",
      phone: phone ? phone.trim() : "",
      profile_image_path: imagePath
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully!",
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      customer
    });
  } catch (error) {
    console.error("Failed to create customer:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create customer" });
  }
};
