const db = require("../models");
const Settings = db.Settings;

// 1. GET SETTINGS
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findByPk(1);
    
    // If settings row does not exist, create a default one
    if (!settings) {
      settings = await Settings.create({
        id: 1,
        low_stock_threshold: 5,
        default_shipping_fee: 100.00,
        tax_rate: 0.12,
        store_name: "Tunify",
        store_contact_email: "support@tunify.com",
        store_contact_phone: "+63 912 000 0000"
      });
    }
    
    res.status(200).json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

// 2. UPDATE SETTINGS
exports.updateSettings = async (req, res) => {
  try {
    const {
      low_stock_threshold,
      default_shipping_fee,
      tax_rate,
      store_name,
      store_contact_email,
      store_contact_phone
    } = req.body;

    // Validation checks
    if (!store_name || store_name.trim() === "") {
      return res.status(400).json({ error: "Store name is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!store_contact_email || !emailRegex.test(store_contact_email)) {
      return res.status(400).json({ error: "A valid store contact email is required" });
    }

    if (!store_contact_phone || store_contact_phone.trim() === "") {
      return res.status(400).json({ error: "Store contact phone is required" });
    }

    const thresholdVal = parseInt(low_stock_threshold, 10);
    if (isNaN(thresholdVal) || thresholdVal < 0) {
      return res.status(400).json({ error: "Low stock threshold must be a valid positive integer" });
    }

    const shippingFeeVal = parseFloat(default_shipping_fee);
    if (isNaN(shippingFeeVal) || shippingFeeVal < 0) {
      return res.status(400).json({ error: "Default shipping fee must be a valid positive number" });
    }

    const taxRateVal = parseFloat(tax_rate);
    if (isNaN(taxRateVal) || taxRateVal < 0 || taxRateVal > 1) {
      return res.status(400).json({ error: "Tax rate must be a decimal between 0 and 1 (e.g. 0.12 for 12%)" });
    }



    // Find or create settings row to update
    let settings = await Settings.findByPk(1);
    if (!settings) {
      settings = await Settings.create({ id: 1 });
    }

    // Perform update
    await settings.update({
      low_stock_threshold: thresholdVal,
      default_shipping_fee: shippingFeeVal,
      tax_rate: taxRateVal,
      store_name: store_name.trim(),
      store_contact_email: store_contact_email.trim(),
      store_contact_phone: store_contact_phone.trim()
    });

    res.status(200).json({ message: "Store settings updated successfully", settings });
  } catch (error) {
    console.error("Failed to update settings:", error);
    res.status(500).json({ error: "Failed to update store settings" });
  }
};
