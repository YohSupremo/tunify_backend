const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");
const upload = require("../utils/multer");

// GET all customers (admin listing)
router.get("/customers", isAuthenticatedUser, isAdmin, customerController.getCustomers);

// CREATE new customer
router.post("/customers", isAuthenticatedUser, isAdmin, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.createCustomer);

// GET single customer detail + addresses
router.get("/customers/:id", isAuthenticatedUser, isAdmin, customerController.getCustomerById);

// UPDATE customer profile (admin)
router.put("/customers/:id", isAuthenticatedUser, isAdmin, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.updateCustomer);

// SOFT-DELETE / deactivate customer
router.delete("/customers/:id", isAuthenticatedUser, isAdmin, customerController.deactivateCustomer);

// REACTIVATE customer
router.patch("/customers/:id/reactivate", isAuthenticatedUser, isAdmin, customerController.reactivateCustomer);

module.exports = router;
