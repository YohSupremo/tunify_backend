const express = require("express");
const router = express.Router();
const { addressChart, categoryChart, salesChart, itemsChart, dashboardStats } = require("../controllers/dashboard");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/address-chart", isAuthenticatedUser, addressChart);
router.get("/category-chart", isAuthenticatedUser, categoryChart);
router.get("/sales-chart", isAuthenticatedUser, salesChart);
router.get("/items-chart", isAuthenticatedUser, itemsChart);
router.get("/dashboard-stats", isAuthenticatedUser, dashboardStats);

module.exports = router;
