const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customer");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");
const upload = require("../utils/multer");


router.get("/customers", isAuthenticatedUser, isAdmin, customerController.getCustomers);


router.post("/customers", isAuthenticatedUser, isAdmin, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.createCustomer);


router.get("/customers/:id", isAuthenticatedUser, isAdmin, customerController.getCustomerById);


router.put("/customers/:id", isAuthenticatedUser, isAdmin, upload.single("image"), (req, res, next) => {
  if (req.user) {
    req.body.user = req.user;
  }
  next();
}, customerController.updateCustomer);


router.delete("/customers/:id", isAuthenticatedUser, isAdmin, customerController.deactivateCustomer);


router.patch("/customers/:id/reactivate", isAuthenticatedUser, isAdmin, customerController.reactivateCustomer);

module.exports = router;
