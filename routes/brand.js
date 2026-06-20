const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brand");
const { isAuthenticatedUser } = require("../middlewares/auth");

// Public route: anyone can view brands
router.get("/brands", brandController.getBrands);

// Protected routes: only logged-in users/admins can modify
router.post("/brands", isAuthenticatedUser, brandController.createBrand);
router.put("/brands", isAuthenticatedUser, brandController.updateBrand);
router.delete("/brands", isAuthenticatedUser, brandController.deleteBrand);

module.exports = router;