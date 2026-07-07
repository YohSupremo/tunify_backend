const db = require("../models");
const Settings = db.Settings;


exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findByPk(1);
    
    
    if (!settings) {
      settings = await Settings.create({
        id: 1,
        low_stock_threshold: 5,
        default_shipping_fee: 100.00,
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


exports.updateSettings = async (req, res) => {
  try {
    const {
      low_stock_threshold,
      default_shipping_fee,
      store_name,
      store_contact_email,
      store_contact_phone
    } = req.body;

    
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



    
    let settings = await Settings.findByPk(1);
    if (!settings) {
      settings = await Settings.create({ id: 1 });
    }

    
    await settings.update({
      low_stock_threshold: thresholdVal,
      default_shipping_fee: shippingFeeVal,
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


exports.updateHomepageContent = async (req, res) => {
  try {
    const { carouselIds, featuredIds } = req.body;

    if (!Array.isArray(carouselIds) || !Array.isArray(featuredIds)) {
      return res.status(400).json({ error: "carouselIds and featuredIds arrays are required" });
    }

    const carouselIntIds = carouselIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    const featuredIntIds = featuredIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    const Item = db.Item;

    
    await Item.update({ is_carousel: false, is_featured: false }, { where: {} });

    
    if (carouselIntIds.length > 0) {
      await Item.update({ is_carousel: true }, {
        where: { id: { [require("sequelize").Op.in]: carouselIntIds } }
      });
    }

    if (featuredIntIds.length > 0) {
      await Item.update({ is_featured: true }, {
        where: { id: { [require("sequelize").Op.in]: featuredIntIds } }
      });
    }

    res.status(200).json({ success: true, message: "Homepage content settings updated successfully!" });
  } catch (error) {
    console.error("Failed to update homepage content:", error);
    res.status(500).json({ error: "Failed to update homepage content settings" });
  }
};
