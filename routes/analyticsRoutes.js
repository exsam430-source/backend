import express from "express";
import adminAuth from "../middleware/adminAuth.js";
import {
  createEvent,
  totalUsers,
  visitors,
  topProducts,
  overallStats,
  overallConversion,
  totalOrders,
  eventsByDate  // ← ADD THIS
} from "../controllers/analyticsController.js";

const router = express.Router();

/* ------------------ PUBLIC ROUTES ------------------ */
// Used by frontend to send analytics events
router.post("/events", createEvent);

/* ------------------ ADMIN-PROTECTED ROUTES ------------------ */
router.get("/totalUsers", adminAuth, totalUsers);
router.get("/totalOrders", adminAuth, totalOrders);
router.get("/visitors", adminAuth, visitors);

// Top products (supports ?metric=&limit=)
router.get("/top-products", adminAuth, topProducts);

// Total site-wide stats (views, addToCarts, purchases)
router.get("/product/all/stats", adminAuth, overallStats);

// Conversion rate stats
router.get("/conversion", adminAuth, overallConversion);

// ======================== NEW ROUTE ========================
// Events by date range for charts (supports ?range=1d|7d|30d|90d)
router.get("/events-by-date", adminAuth, eventsByDate);  // ← ADD THIS

export default router;
