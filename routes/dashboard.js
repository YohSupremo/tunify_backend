const express = require("express");
const router = express.Router();
const { addressChart, categoryChart, salesChart, itemsChart, dashboardStats, stockActivity } = require("../controllers/dashboard");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

router.get("/address-chart", isAuthenticatedUser, isAdmin, addressChart);
router.get("/category-chart", isAuthenticatedUser, isAdmin, categoryChart);
router.get("/sales-chart", isAuthenticatedUser, isAdmin, salesChart);
router.get("/items-chart", isAuthenticatedUser, isAdmin, itemsChart);
router.get("/dashboard-stats", isAuthenticatedUser, isAdmin, dashboardStats);
router.get("/stock-activity", isAuthenticatedUser, isAdmin, stockActivity);

module.exports = router;
