const express = require("express");
const settingsController = require("../controllers/settings");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

const router = express.Router();

router.get("/settings", settingsController.getSettings);
router.put("/settings", isAuthenticatedUser, isAdmin, settingsController.updateSettings);
router.put("/settings/homepage", isAuthenticatedUser, isAdmin, settingsController.updateHomepageContent);

module.exports = router;
