const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

// Public route to view stock levels
router.get("/stocks", stockController.getStocks);

// Protected route to bulk restock items (only admins)
router.post("/stocks/bulk-restock", isAuthenticatedUser, isAdmin, stockController.bulkRestock);

module.exports = router;
