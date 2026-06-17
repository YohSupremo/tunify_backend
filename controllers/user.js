const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const User = db.User;
const Customer = db.Customer;
const sequelize = db.sequelize;

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
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password_hash: hashedPassword,
      role: "customer"
    });

    let fname = name || "";
    let lname = "";
    if (name && name.includes(" ")) {
      const parts = name.split(" ");
      fname = parts[0];
      lname = parts.slice(1).join(" ");
    }

    await Customer.create({
      user_id: user.id,
      first_name: fname,
      last_name: lname,
      phone: "",
      address_line: "",
      zip_code: "",
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

    const customer = await Customer.findOne({ where: { user_id: user.id } });

    res.status(200).json({
      success: true,
      message: "Welcome back",
      token,
      user: {
        id: user.id,
        email: user.email,
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
    const { first_name, last_name, address_line, zip_code, phone, user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
    }

    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path.replace(/\\/g, "/");
    }

    const [customer, created] = await Customer.findOrCreate({
      where: { user_id: user_id },
      defaults: {
        first_name: first_name || "",
        last_name: last_name || "",
        address_line: address_line || "",
        zip_code: zip_code || "",
        phone: phone || "",
        profile_image_path: imagePath,
        user_id: user_id
      }
    });

    if (!created) {
      await customer.update({
        first_name: first_name !== undefined ? first_name : customer.first_name,
        last_name: last_name !== undefined ? last_name : customer.last_name,
        address_line: address_line !== undefined ? address_line : customer.address_line,
        zip_code: zip_code !== undefined ? zip_code : customer.zip_code,
        phone: phone !== undefined ? phone : customer.phone,
        profile_image_path: imagePath || customer.profile_image_path
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      customer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating profile", details: error.message });
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
    await user.update({ deleted_at: timestamp });

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

