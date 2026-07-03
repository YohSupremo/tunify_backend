const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

router.get("/suppliers", isAuthenticatedUser, isAdmin, supplierController.getSuppliers);

router.post("/suppliers", isAuthenticatedUser, isAdmin, supplierController.createSupplier);

router.put("/suppliers/:id", isAuthenticatedUser, isAdmin, supplierController.updateSupplier);
router.delete("/suppliers/:id", isAuthenticatedUser, isAdmin, supplierController.deleteSupplier);
router.patch("/suppliers/:id/restore", isAuthenticatedUser, isAdmin, supplierController.restoreSupplier);

module.exports = router;