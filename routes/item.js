const express = require("express");
const router = express.Router();
const itemController = require("../controllers/item");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");
const upload = require("../utils/multer");


router.get("/items", itemController.getItems);


router.post("/items", isAuthenticatedUser, isAdmin, upload.array("images", 10), itemController.createItem);
router.put("/items", isAuthenticatedUser, isAdmin, upload.array("images", 10), itemController.updateItem);
router.delete("/items", isAuthenticatedUser, isAdmin, itemController.deleteItem);
router.patch("/items/restore", isAuthenticatedUser, isAdmin, itemController.restoreItem);

module.exports = router;
