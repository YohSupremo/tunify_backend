const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const User = db.User;
const Customer = db.Customer;
const sequelize = db.sequelize;
const Sequelize = db.Sequelize;

exports.getUser = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { deleted_at: null }
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password_hash: hashedPassword,
      role: "customer"
    });

    await Customer.create({
      user_id: user.id,
      first_name: first_name || "",
      last_name: last_name || "",
      phone: "",
      profile_image_path: null
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Error registering user", details: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({
      where: {
        email,
        deleted_at: null
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1h"
    });

    // Save token to database
    await user.update({ token });

    const customer = await Customer.findOne({ where: { user_id: user.id } });

    res.status(200).json({
      success: true,
      message: "Welcome back",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: customer ? (customer.first_name + " " + customer.last_name).trim() : ""
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error logging in", details: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    let imagePath = null;
    if (req.file) {
      imagePath = "images/" + req.file.filename;
      const fs = require("fs");
      const path = require("path");
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

    const [customer, created] = await Customer.findOrCreate({
      where: { user_id: user_id },
      defaults: {
        first_name: first_name || "",
        last_name: last_name || "",
        phone: phone || "",
        profile_image_path: imagePath,
        user_id: user_id
      }
    });

    if (!created) {
      await customer.update({
        first_name: first_name !== undefined ? first_name : customer.first_name,
        last_name: last_name !== undefined ? last_name : customer.last_name,
        phone: phone !== undefined ? phone : customer.phone,
        profile_image_path: imagePath || customer.profile_image_path
      });
    }

    // Retrieve default address for UI/session consistency
    const [addressRows] = await sequelize.query(
      "SELECT street, city, province, zip_code FROM customer_addresses WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1",
      {
        replacements: [user_id],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    const customerJSON = customer.toJSON();
    customerJSON.street = addressRows ? addressRows.street : "";
    customerJSON.city = addressRows ? addressRows.city : "";
    customerJSON.province = addressRows ? addressRows.province : "";
    customerJSON.zip_code = addressRows ? addressRows.zip_code : "";

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      customer: customerJSON
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating profile", details: error.message });
  }
};

exports.getAddresses = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const rows = await sequelize.query(
      "SELECT id, label, street, city, province, zip_code, is_default FROM customer_addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, id DESC",
      {
        replacements: [userId],
        type: Sequelize.QueryTypes.SELECT
      }
    );
    res.status(200).json({ success: true, addresses: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch addresses" });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const { label, street, city, province, zip_code, is_default } = req.body;

    if (!street || !city || !province || !zip_code) {
      return res.status(400).json({ error: "Street, city, province, and zip code are required" });
    }

    const defaultVal = is_default ? 1 : 0;

    if (defaultVal === 1) {
      await sequelize.query(
        "UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?",
        { replacements: [userId], type: Sequelize.QueryTypes.UPDATE }
      );
    }

    const [resultId] = await sequelize.query(
      "INSERT INTO customer_addresses (user_id, label, street, city, province, zip_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
      {
        replacements: [userId, label || "Home", street, city, province, zip_code, defaultVal],
        type: Sequelize.QueryTypes.INSERT
      }
    );

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: { id: resultId, label, street, city, province, zip_code, is_default: defaultVal }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add address" });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const addressId = req.params.id;

    // 1. Soft-delete the target address and clear its is_default status
    await sequelize.query(
      "UPDATE customer_addresses SET deleted_at = NOW(), is_default = 0 WHERE id = ? AND user_id = ?",
      {
        replacements: [addressId, userId],
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    // 2. Check if the user still has a default address
    const defaultAddresses = await sequelize.query(
      "SELECT id FROM customer_addresses WHERE user_id = ? AND deleted_at IS NULL AND is_default = 1 LIMIT 1",
      {
        replacements: [userId],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // 3. If no default address remains, check for any other active addresses
    if (defaultAddresses.length === 0) {
      const remainingAddresses = await sequelize.query(
        "SELECT id FROM customer_addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
        {
          replacements: [userId],
          type: Sequelize.QueryTypes.SELECT
        }
      );

      // 4. Promote the most recent active address to default
      if (remainingAddresses.length > 0) {
        const newDefaultId = remainingAddresses[0].id;
        await sequelize.query(
          "UPDATE customer_addresses SET is_default = 1 WHERE id = ?",
          {
            replacements: [newDefaultId],
            type: Sequelize.QueryTypes.UPDATE
          }
        );
      }
    }

    res.status(200).json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete address" });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const addressId = req.params.id;

    await sequelize.query(
      "UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?",
      { replacements: [userId], type: Sequelize.QueryTypes.UPDATE }
    );

    await sequelize.query(
      "UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
      { replacements: [addressId, userId], type: Sequelize.QueryTypes.UPDATE }
    );

    res.status(200).json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update default address" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const addressId = req.params.id;
    const { label, street, city, province, zip_code, is_default } = req.body;

    if (!street || !city || !province || !zip_code) {
      return res.status(400).json({ error: "Street, city, province, and zip code are required" });
    }

    const defaultVal = is_default ? 1 : 0;

    if (defaultVal === 1) {
      await sequelize.query(
        "UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?",
        { replacements: [userId], type: Sequelize.QueryTypes.UPDATE }
      );
    }

    await sequelize.query(
      "UPDATE customer_addresses SET label = ?, street = ?, city = ?, province = ?, zip_code = ?, is_default = ? WHERE id = ? AND user_id = ?",
      {
        replacements: [label || "Home", street, city, province, zip_code, defaultVal, addressId, userId],
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({
      success: true,
      message: "Address updated successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update address" });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ where: { email, deleted_at: null } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const timestamp = new Date();
    await user.update({ deleted_at: timestamp, token: null });

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      email,
      deleted_at: timestamp
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error deactivating user", details: error.message });
  }
};

