const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock");
const restockLogController = require("../controllers/restockLog");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");


router.get("/stocks", isAuthenticatedUser, isAdmin, stockController.getStocks);


router.post("/stocks/bulk-restock", isAuthenticatedUser, isAdmin, stockController.bulkRestock);


router.get("/stocks/logs", isAuthenticatedUser, isAdmin, restockLogController.getRestockLogs);

module.exports = router;
