const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock");
const restockLogController = require("../controllers/restockLog");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

// View stock levels (admin only)
router.get("/stocks", isAuthenticatedUser, isAdmin, stockController.getStocks);

// Bulk restock items — requires supplier_id + restocks array (admin only)
router.post("/stocks/bulk-restock", isAuthenticatedUser, isAdmin, stockController.bulkRestock);

// Restock log history with filters (admin only)
router.get("/stocks/logs", isAuthenticatedUser, isAdmin, restockLogController.getRestockLogs);

module.exports = router;
