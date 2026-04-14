import express from 'express';
import {
  placeOrder,
  placeOrderEasypaisa,
  placeOrderBankTransfer,
  placeOrderWhatsApp,
  uploadPaymentProof,
  verifyPayment,
  updatePaymentStatus,
  allOrders,
  userOrders,
  updateStatus,
  getOrderById
} from '../controllers/orderController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const orderRouter = express.Router();

// User routes - Place orders
orderRouter.post('/place', authUser, placeOrder);
orderRouter.post('/easypaisa', authUser, placeOrderEasypaisa);
orderRouter.post('/bank-transfer', authUser, placeOrderBankTransfer);
orderRouter.post('/whatsapp', authUser, placeOrderWhatsApp);

// User routes - Payment proof
orderRouter.post('/upload-payment-proof', authUser, upload.single('paymentProof'), uploadPaymentProof);

// User routes - Get orders
orderRouter.post('/userorders', authUser, userOrders);
orderRouter.get('/:id', authUser, getOrderById);

// Admin routes
orderRouter.post('/list', adminAuth, allOrders);
orderRouter.post('/status', adminAuth, updateStatus);
orderRouter.post('/verify-payment', adminAuth, verifyPayment);
orderRouter.post('/update-payment', adminAuth, updatePaymentStatus);

export default orderRouter;