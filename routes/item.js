const express = require("express");
const router = express.Router();
const itemController = require("../controllers/item");
const { isAuthenticatedUser } = require("../middlewares/auth");
const upload = require("../utils/multer");

// Public route to view items
router.get("/items", itemController.getItems);

// Protected routes to modify items
router.post("/items", isAuthenticatedUser, upload.array("images", 10), itemController.createItem);
router.put("/items", isAuthenticatedUser, upload.array("images", 10), itemController.updateItem);
router.delete("/items", isAuthenticatedUser, itemController.deleteItem);
router.patch("/items/restore", isAuthenticatedUser, itemController.restoreItem);

module.exports = router;
