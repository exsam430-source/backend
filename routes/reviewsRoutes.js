import express from "express";
import { addReview, deleteReview, getReviews } from "../controllers/reviewsController.js";
import authUser from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// GET REVIEWS - Public
router.get("/:productId", getReviews);

// ADD REVIEW - Public (auth optional for guest reviews) 
router.post("/review/:id", upload.array("images", 3), addReview);

// DELETE REVIEW - Requires auth
router.delete("/review/:productId/:reviewId", authUser, deleteReview);

export default router;