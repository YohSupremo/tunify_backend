const express = require("express");
const router = express.Router();
const { addressChart, salesChart, itemsChart } = require("../controllers/dashboard");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/address-chart", isAuthenticatedUser, addressChart);
router.get("/sales-chart", isAuthenticatedUser, salesChart);
router.get("/items-chart", isAuthenticatedUser, itemsChart);

module.exports = router;
