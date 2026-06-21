const express = require("express");
const userController = require("../controllers/user");
const { isAuthenticatedUser } = require("../middlewares/auth");
const upload = require("../utils/multer");

const router = express.Router();

// Auth and User endpoints
router.post("/register", userController.registerUser);
router.post("/login", userController.loginUser);
router.post("/update-profile", upload.single("image"), userController.updateProfile);
router.delete("/deactivate", userController.deactivateUser);
router.get("/", userController.getUser);

// Address endpoints
router.get("/addresses", isAuthenticatedUser, userController.getAddresses);
router.post("/addresses", isAuthenticatedUser, userController.addAddress);
router.delete("/addresses/:id", isAuthenticatedUser, userController.deleteAddress);
router.put("/addresses/:id/default", isAuthenticatedUser, userController.setDefaultAddress);


module.exports = router;
