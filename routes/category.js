const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/categories", categoryController.getCategories);

router.post("/categories", isAuthenticatedUser, categoryController.createCategory);
router.put("/categories", isAuthenticatedUser, categoryController.updateCategory);
router.delete("/categories", isAuthenticatedUser, categoryController.deleteCategory);

module.exports = router;