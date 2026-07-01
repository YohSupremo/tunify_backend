const db = require("../models");
const Review = db.Review;
const OrderInfo = db.sequelize.models.OrderInfo; // Using raw queries or Sequelize
const sequelize = db.sequelize;
const Sequelize = db.Sequelize;

// Helper to replace bad words with matching length of asterisks (substring matches allowed for compound words)
function censorProfanity(text) {
  if (!text) return text;
  // Ordered by length descending to ensure longer compound matches are processed first
  const badWords = ['tanginamo', 'tarantado', 'siraulo', 'tangina', 'kupal', 'tanga', 'gago', 'bobo', 'puta'];
  let censored = text;
  badWords.forEach(word => {
    const regex = new RegExp(word, 'gi');
    censored = censored.replace(regex, (match) => '*'.repeat(match.length));
  });
  return censored;
}

// 1. SUBMIT OR UPDATE A PRODUCT REVIEW
exports.submitReview = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const { item_id, rating, comment } = req.body;

    if (!item_id || !rating) {
      return res.status(400).json({ error: "Item ID and rating are required." });
    }

    const ratingVal = parseInt(rating);
    if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    // Check if user has purchased the item and the order status is "Delivered" (status_id = 4)
    const [purchased] = await sequelize.query(
      `SELECT oi.id 
       FROM orderinfo oi
       JOIN orderline ol ON oi.id = ol.orderinfo_id
       WHERE oi.user_id = :userId AND ol.item_id = :itemId AND oi.status_id = 4
       LIMIT 1`,
      {
        replacements: { userId, itemId: item_id },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!purchased) {
      return res.status(403).json({ 
        error: "You can only review products you have purchased and received (Delivered status)." 
      });
    }

    // Filter toxic words
    const censoredComment = censorProfanity(comment);

    // Check if review record already exists in the table (even if soft-deleted) to update/restore it
    const [existingReview] = await sequelize.query(
      `SELECT id FROM review WHERE user_id = :userId AND item_id = :itemId LIMIT 1`,
      {
        replacements: { userId, itemId: item_id },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (existingReview) {
      // Update and restore/reactivate the review
      await sequelize.query(
        `UPDATE review SET rating = :rating, comment = :comment, deleted_at = NULL WHERE id = :id`,
        {
          replacements: { rating: ratingVal, comment: censoredComment || null, id: existingReview.id },
          type: Sequelize.QueryTypes.UPDATE
        }
      );

      return res.status(200).json({ 
        success: true, 
        message: "Your review has been updated successfully!" 
      });
    } else {
      // Create new review
      await sequelize.query(
        `INSERT INTO review (user_id, item_id, rating, comment) VALUES (:userId, :itemId, :rating, :comment)`,
        {
          replacements: { userId, itemId: item_id, rating: ratingVal, comment: censoredComment || null },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      return res.status(201).json({ 
        success: true, 
        message: "Your review has been submitted successfully!" 
      });
    }
  } catch (error) {
    console.error("Failed to submit review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
};

// 2. GET REVIEWS FOR A SPECIFIC ITEM
exports.getItemReviews = async (req, res) => {
  try {
    const itemId = req.params.itemId;

    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required." });
    }

    // Fetch all reviews for this item
    const reviews = await sequelize.query(
      `SELECT r.id, r.user_id, r.rating, r.comment, DATE_FORMAT(r.created_at, '%Y-%m-%d') as date, 
              CONCAT(c.first_name, ' ', c.last_name) as customer_name, c.profile_image_path as customer_avatar
       FROM review r
       JOIN users u ON r.user_id = u.id
       JOIN customer c ON u.id = c.user_id
       WHERE r.item_id = :itemId AND r.deleted_at IS NULL
       ORDER BY r.created_at DESC`,
      {
        replacements: { itemId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Calculate average rating and count
    const [stats] = await sequelize.query(
      `SELECT COALESCE(AVG(rating), 0) as average_rating, COUNT(id) as total_reviews 
       FROM review 
       WHERE item_id = :itemId AND deleted_at IS NULL`,
      {
        replacements: { itemId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      success: true,
      average_rating: parseFloat(stats.average_rating || 0).toFixed(1),
      total_reviews: parseInt(stats.total_reviews || 0),
      reviews
    });
  } catch (error) {
    console.error("Failed to fetch item reviews:", error);
    res.status(500).json({ error: "Failed to fetch item reviews" });
  }
};

// 3. CHECK USER ELIGIBILITY TO REVIEW
exports.checkEligibility = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const itemId = req.params.itemId;

    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required." });
    }

    // Check if user has purchased the item and it is Delivered (status_id = 4)
    const [purchased] = await sequelize.query(
      `SELECT oi.id 
       FROM orderinfo oi
       JOIN orderline ol ON oi.id = ol.orderinfo_id
       WHERE oi.user_id = :userId AND ol.item_id = :itemId AND oi.status_id = 4
       LIMIT 1`,
      {
        replacements: { userId, itemId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Check if they already reviewed it
    const [reviewed] = await sequelize.query(
      `SELECT rating, comment FROM review WHERE user_id = :userId AND item_id = :itemId AND deleted_at IS NULL LIMIT 1`,
      {
        replacements: { userId, itemId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      success: true,
      eligible: !!purchased,
      already_reviewed: !!reviewed,
      existing_review: reviewed || null
    });
  } catch (error) {
    console.error("Failed to check review eligibility:", error);
    res.status(500).json({ error: "Failed to check review eligibility" });
  }
};

// 4. DELETE A REVIEW (SOFT DELETE)
exports.deleteReview = async (req, res) => {
  try {
    const userId = req.body.user.id;
    const reviewId = req.params.id;

    if (!reviewId) {
      return res.status(400).json({ error: "Review ID is required." });
    }

    // Verify ownership of the review before deleting
    const [review] = await sequelize.query(
      `SELECT id FROM review WHERE id = :reviewId AND user_id = :userId AND deleted_at IS NULL LIMIT 1`,
      {
        replacements: { reviewId, userId },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!review) {
      return res.status(404).json({ error: "Review not found or unauthorized to delete." });
    }

    // Soft delete the review
    await sequelize.query(
      `UPDATE review SET deleted_at = NOW() WHERE id = :reviewId`,
      {
        replacements: { reviewId },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({
      success: true,
      message: "Your review has been deleted successfully."
    });
  } catch (error) {
    console.error("Failed to delete review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
};

// 5. GET ALL REVIEWS (FOR ADMIN)
exports.getAllReviewsForAdmin = async (req, res) => {
  try {
    const reviews = await sequelize.query(
      `SELECT r.id, r.user_id, r.item_id, r.rating, r.comment, 
              DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') as date, r.deleted_at,
              i.name as item_name,
              CONCAT(c.first_name, ' ', c.last_name) as customer_name
       FROM review r
       JOIN item i ON r.item_id = i.id
       JOIN users u ON r.user_id = u.id
       JOIN customer c ON u.id = c.user_id
       ORDER BY r.created_at DESC`,
      {
        type: Sequelize.QueryTypes.SELECT
      }
    );

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error("Failed to fetch all reviews for admin:", error);
    res.status(500).json({ error: "Failed to fetch all reviews for admin" });
  }
};

// 6. HIDE A REVIEW (ADMIN ONLY)
exports.hideReview = async (req, res) => {
  try {
    const reviewId = req.params.id;

    if (!reviewId) {
      return res.status(400).json({ error: "Review ID is required." });
    }

    await sequelize.query(
      `UPDATE review SET deleted_at = NOW() WHERE id = :reviewId`,
      {
        replacements: { reviewId },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({
      success: true,
      message: "Review has been hidden successfully."
    });
  } catch (error) {
    console.error("Failed to hide review:", error);
    res.status(500).json({ error: "Failed to hide review" });
  }
};

// 7. UNHIDE A REVIEW (ADMIN ONLY)
exports.unhideReview = async (req, res) => {
  try {
    const reviewId = req.params.id;

    if (!reviewId) {
      return res.status(400).json({ error: "Review ID is required." });
    }

    await sequelize.query(
      `UPDATE review SET deleted_at = NULL WHERE id = :reviewId`,
      {
        replacements: { reviewId },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    res.status(200).json({
      success: true,
      message: "Review has been restored successfully."
    });
  } catch (error) {
    console.error("Failed to restore review:", error);
    res.status(500).json({ error: "Failed to restore review" });
  }
};
