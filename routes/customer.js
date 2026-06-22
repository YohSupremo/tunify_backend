const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer");
const { isAuthenticatedUser } = require("../middlewares/auth");
const upload = require("../utils/multer");

// GET all customers (admin listing — no auth required for datatable load, but admin check is on frontend)
router.get("/customers", isAuthenticatedUser, customerController.getCustomers);

// CREATE new customer
router.post("/customers", isAuthenticatedUser, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.createCustomer);

// GET single customer detail + addresses
router.get("/customers/:id", isAuthenticatedUser, customerController.getCustomerById);

// UPDATE customer profile (admin)
router.put("/customers/:id", isAuthenticatedUser, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.updateCustomer);

// SOFT-DELETE / deactivate customer
router.delete("/customers/:id", isAuthenticatedUser, customerController.deactivateCustomer);

// REACTIVATE customer
router.patch("/customers/:id/reactivate", isAuthenticatedUser, customerController.reactivateCustomer);

module.exports = router;
