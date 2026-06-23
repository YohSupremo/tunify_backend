const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/orders", isAuthenticatedUser, orderController.getOrders);
router.post("/orders", isAuthenticatedUser, orderController.placeOrder);
router.get("/orders/:id", isAuthenticatedUser, orderController.getOrderDetails);
router.put("/orders/:id/status", isAuthenticatedUser, orderController.updateOrderStatus);

module.exports = router;
