const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock");
const { isAuthenticatedUser } = require("../middlewares/auth");

// Public route to view stock levels
router.get("/stocks", stockController.getStocks);

// Protected route to update stock levels (admin only via auth middleware)
router.put("/stocks", isAuthenticatedUser, stockController.updateStock);

module.exports = router;
