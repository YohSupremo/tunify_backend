const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock");
const { isAuthenticatedUser } = require("../middlewares/auth");

// Public route to view stock levels
router.get("/stocks", stockController.getStocks);

// Protected route to bulk restock items
router.post("/stocks/bulk-restock", isAuthenticatedUser, stockController.bulkRestock);

module.exports = router;
