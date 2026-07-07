const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brand");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");
const upload = require("../utils/multer");


router.get("/brands", brandController.getBrands);


router.post("/brands", isAuthenticatedUser, isAdmin, upload.single("logo"), brandController.createBrand);
router.post("/brands/restore", isAuthenticatedUser, isAdmin, brandController.restoreBrand);
router.put("/brands", isAuthenticatedUser, isAdmin, upload.single("logo"), brandController.updateBrand);
router.delete("/brands", isAuthenticatedUser, isAdmin, brandController.deleteBrand);

module.exports = router;