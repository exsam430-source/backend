import express from "express";
import {
  subscribeNewsletter,
  checkNewsletterEmail,
  unsubscribeNewsletter,
  getAllSubscribers
} from "../controllers/newsletterController.js";
import authUser from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

// Public
router.post("/subscribe", subscribeNewsletter);
router.get("/check", checkNewsletterEmail);

// User
router.post("/unsubscribe", authUser, unsubscribeNewsletter);

// Admin
router.get("/subscribers", adminAuth, getAllSubscribers);

export default router;