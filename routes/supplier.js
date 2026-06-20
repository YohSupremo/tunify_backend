const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier");
const { isAuthenticatedUser } = require("../middlewares/auth");

router.get("/suppliers", supplierController.getSuppliers);

router.post("/suppliers", isAuthenticatedUser, supplierController.createSupplier);

router.put("/suppliers/:id", isAuthenticatedUser, supplierController.updateSupplier);
router.delete("/suppliers/:id", isAuthenticatedUser, supplierController.deleteSupplier);

module.exports = router;