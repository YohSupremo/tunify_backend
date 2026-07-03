const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

router.get("/categories", categoryController.getCategories);

router.post("/categories", isAuthenticatedUser, isAdmin, categoryController.createCategory);
router.put("/categories", isAuthenticatedUser, isAdmin, categoryController.updateCategory);
router.delete("/categories", isAuthenticatedUser, isAdmin, categoryController.deleteCategory);

module.exports = router;