const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/review");
const { isAuthenticatedUser, isAdmin } = require("../middlewares/auth");

router.post("/reviews", isAuthenticatedUser, reviewController.submitReview);
router.get("/items/:itemId/reviews", reviewController.getItemReviews);
router.get("/items/:itemId/review-eligibility", isAuthenticatedUser, reviewController.checkEligibility);
router.delete("/reviews/:id", isAuthenticatedUser, reviewController.deleteReview);


router.get("/admin/reviews", isAuthenticatedUser, isAdmin, reviewController.getAllReviewsForAdmin);
router.put("/admin/reviews/:id/hide", isAuthenticatedUser, isAdmin, reviewController.hideReview);
router.put("/admin/reviews/:id/unhide", isAuthenticatedUser, isAdmin, reviewController.unhideReview);

module.exports = router;
