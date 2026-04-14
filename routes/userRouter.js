// routes/userRouter.js
import express from 'express';
import {
  loginUser,
  registerUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleLogin,
  adminLogin,
  adminChangePassword,
  getAdminProfile,
  checkAdminExists,
  resendVerificationEmail,
  checkEmailStatus
} from '../controllers/userController.js';
import authUser from '../middleware/auth.js';
import adminAuth from '../middleware/adminAuth.js';

const userRouter = express.Router();

// ==================== PUBLIC ROUTES ====================
// User Authentication
userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.post('/verify-email', verifyEmail);
userRouter.post('/forgot-password', forgotPassword);
userRouter.post('/reset-password', resetPassword);
userRouter.post('/google-login', googleLogin);
userRouter.post('/resend-verification', resendVerificationEmail);

// Admin Authentication (LOGIN ONLY - NO REGISTER)
userRouter.post('/admin', adminLogin);

// Check if admin exists (for initial setup check)
userRouter.get('/admin/exists', checkAdminExists);

// Email status check
userRouter.get('/email-status', checkEmailStatus);

// ==================== PROTECTED ADMIN ROUTES ====================
// Admin verification
userRouter.get('/verify', adminAuth, (req, res) => {
  res.json({ success: true, message: 'Admin verified' });
});

// Admin profile
userRouter.get('/admin/profile', adminAuth, getAdminProfile);

// Admin change password
userRouter.post('/admin/change-password', adminAuth, adminChangePassword);

// ==================== NO ADMIN REGISTRATION ROUTE ====================
// This is intentionally NOT implemented to ensure admin is created only once via seed script

export default userRouter;