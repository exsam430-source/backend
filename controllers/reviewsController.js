// controllers/reviewsController.js
import Review from "../models/Review.js";
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from "../config/cloudinary.js";
import { cleanTempFiles } from "../middleware/upload.js";

// ADD REVIEW
export const addReview = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { userId, rating, comment, name, email } = req.body;

    console.log('Adding review for product:', productId);

    // Upload images to Cloudinary
    const imagePaths = [];
    if (req.files && req.files.length > 0) {
      for (var i = 0; i < req.files.length; i++) {
        try {
          var result = await uploadToCloudinary(req.files[i].path, 'rb-jewellery/reviews');
          if (result && result.url) {
            imagePaths.push(result.url);
          }
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
        }
      }
      cleanTempFiles(req.files);
    }

    var newReview = await Review.create({
      productId: productId,
      userId: userId || null,
      rating: parseInt(rating) || 5,
      comment: comment || '',
      name: name || 'Anonymous',
      email: email || '',
      images: imagePaths
    });

    var reviews = await Review.find({ productId: productId });

    res.json({ success: true, reviews: reviews, newReview: newReview });
  } catch (err) {
    if (req.files) cleanTempFiles(req.files);
    console.error("Add review error:", err);
    res.status(500).json({ success: false, message: "Failed to add review", error: err.message });
  }
};

// GET REVIEWS
export const getReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    console.log('Fetching reviews for product:', productId, 'skip:', skip, 'limit:', limit);

    var allReviews = await Review.find({ productId: productId });
    
    console.log('Found', allReviews.length, 'reviews');
    
    // Apply skip and limit manually
    var reviews = allReviews.slice(skip, skip + limit);
    
    var total = allReviews.length;
    
    // Calculate average rating
    var averageRating = 0;
    if (total > 0) {
      var sum = 0;
      for (var i = 0; i < allReviews.length; i++) {
        sum += Number(allReviews[i].rating) || 0;
      }
      averageRating = sum / total;
    }

    res.json({ 
      success: true, 
      reviews: reviews, 
      total: total, 
      averageRating: averageRating 
    });
  } catch (err) {
    console.error("Get review error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// DELETE REVIEW
export const deleteReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    var userId = req.user?.id || req.user?._id;

    var review = await Review.findOne({ _id: reviewId, productId: productId });
    
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Check authorization - convert to string for comparison
    var reviewUserId = review.userId;
    if (typeof reviewUserId === 'object' && reviewUserId._id) {
      reviewUserId = reviewUserId._id;
    }
    
    if (String(reviewUserId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Delete images from Cloudinary
    if (review.images && Array.isArray(review.images) && review.images.length > 0) {
      for (var i = 0; i < review.images.length; i++) {
        try {
          var publicId = getPublicIdFromUrl(review.images[i]);
          if (publicId) {
            await deleteFromCloudinary(publicId);
          }
        } catch (delErr) {
          console.error('Error deleting image:', delErr);
        }
      }
    }

    await Review.deleteOne({ _id: reviewId });

    var reviews = await Review.find({ productId: productId });

    res.json({ success: true, reviews: reviews });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};