import express from 'express';
import {
  createReturn,
  uploadShippingReceipt,
  cancelReturn,
  getUserReturns,
  getReturnById,
  getAllReturns,
  approveReturn,
  rejectReturn,
  markItemReceived,
  processRefund,
  completeRefund,
  updateReturnStatus,
  deleteReturn,
  getReturnStats
} from '../controllers/returnController.js';
import adminAuth from '../middleware/adminAuth.js';
import authUser from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const returnRouter = express.Router();

// User routes
returnRouter.post('/create', authUser, upload.array('proofImages', 5), createReturn);
returnRouter.post('/upload-receipt', authUser, upload.single('receiptImage'), uploadShippingReceipt);
returnRouter.post('/cancel', authUser, cancelReturn);
returnRouter.post('/my-returns', authUser, getUserReturns);
returnRouter.get('/detail/:id', authUser, getReturnById);

// Admin routes
returnRouter.post('/all', adminAuth, getAllReturns);
returnRouter.post('/stats', adminAuth, getReturnStats);
returnRouter.post('/approve', adminAuth, approveReturn);
returnRouter.post('/reject', adminAuth, rejectReturn);
returnRouter.post('/mark-received', adminAuth, markItemReceived);
returnRouter.post('/process-refund', adminAuth, processRefund);
returnRouter.post('/complete-refund', adminAuth, completeRefund);
returnRouter.post('/update-status', adminAuth, updateReturnStatus);
returnRouter.delete('/delete/:id', adminAuth, deleteReturn);

export default returnRouter;