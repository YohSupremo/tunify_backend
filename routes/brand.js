const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brand");
const { isAuthenticatedUser } = require("../middlewares/auth");
const upload = require("../utils/multer");

// Public route: anyone can view brands
router.get("/brands", brandController.getBrands);

// Protected routes: only logged-in users/admins can modify
router.post("/brands", isAuthenticatedUser, upload.single("logo"), brandController.createBrand);
router.put("/brands", isAuthenticatedUser, upload.single("logo"), brandController.updateBrand);
router.delete("/brands", isAuthenticatedUser, brandController.deleteBrand);

module.exports = router;