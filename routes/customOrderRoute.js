import express from 'express';
import {
  createCustomOrder,
  getUserCustomOrders,
  getAllCustomOrders,
  updateCustomOrderStatus,
  getCustomOrderById,
  deleteCustomOrder,
  debugUserOrders
} from '../controllers/customOrderController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import upload from '../middleware/upload.js';

var customOrderRouter = express.Router();

// ==================== PUBLIC ROUTES ====================
// Create custom order (guests + logged-in users)
customOrderRouter.post('/create', upload.array('referenceImages', 5), createCustomOrder);

// ==================== USER ROUTES (Authenticated) ====================
// Get user's custom orders
customOrderRouter.get('/my-orders', authUser, getUserCustomOrders);

// Get specific order by ID
customOrderRouter.get('/order/:id', authUser, getCustomOrderById);

// Debug endpoint (remove in production)
customOrderRouter.get('/debug', authUser, debugUserOrders);

// ==================== ADMIN ROUTES ====================
// Get all custom orders
customOrderRouter.get('/all', adminAuth, getAllCustomOrders);
customOrderRouter.post('/all', adminAuth, getAllCustomOrders);

// Update order status
customOrderRouter.post('/update-status', adminAuth, updateCustomOrderStatus);
customOrderRouter.put('/update-status', adminAuth, updateCustomOrderStatus);

// Delete order
customOrderRouter.delete('/:id', adminAuth, deleteCustomOrder);

// ==================== FALLBACK for /:id (must be last) ====================
customOrderRouter.get('/:id', authUser, getCustomOrderById);

export default customOrderRouter;