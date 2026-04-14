import express from "express";
import {
  getProfile,
  updateProfile,
  updatePassword,
  uploadProfileImage
} from "../controllers/profileController.js";
import authUser from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Routes
router.get("/me", authUser, getProfile);
router.put("/me", authUser, updateProfile);
router.put("/me/password", authUser, updatePassword);
router.post("/me/upload", authUser, upload.single("image"), uploadProfileImage);

export default router;