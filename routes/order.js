const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/orders", isAuthenticatedUser, orderController.getOrders);
router.post("/orders", isAuthenticatedUser, orderController.placeOrder);
router.put("/orders/:id/ship", isAuthenticatedUser, orderController.shipOrder);

module.exports = router;
