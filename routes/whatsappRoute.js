// routes/whatsappRoute.js
import express from "express";
import {
  logWhatsAppInquiry,
  getWhatsAppNumber,
  updateWhatsAppNumber,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
} from "../controllers/whatsappController.js";
import adminAuth from "../middleware/adminAuth.js";

const whatsappRouter = express.Router();

// PUBLIC routes (no auth needed)
whatsappRouter.get("/number", getWhatsAppNumber);
whatsappRouter.post("/log", logWhatsAppInquiry);

// ADMIN routes
whatsappRouter.get("/inquiries", adminAuth, getAllInquiries);
whatsappRouter.post("/update-status", adminAuth, updateInquiryStatus);
whatsappRouter.post("/update-number", adminAuth, updateWhatsAppNumber);
whatsappRouter.post("/delete", adminAuth, deleteInquiry);

export default whatsappRouter;