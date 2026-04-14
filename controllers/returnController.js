// controllers/returnController.js
import returnModel from "../models/returnModel.js";
import orderModel from "../models/orderModel.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl
} from "../config/cloudinary.js";
import { cleanTempFiles, cleanTempFile } from "../middleware/upload.js";

// Helper to get error message safely
var getErrorMessage = function(error, fallback) {
  if (!fallback) fallback = 'An error occurred';
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  return fallback;
};

// Helper to delete Cloudinary images
var deleteCloudinaryImages = async function(images) {
  if (!images || images.length === 0) return;

  var imageArray = Array.isArray(images) ? images : [images];

  for (var i = 0; i < imageArray.length; i++) {
    var imageUrl = imageArray[i];
    if (imageUrl && imageUrl.indexOf('cloudinary') !== -1) {
      var publicId = getPublicIdFromUrl(imageUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
        } catch (err) {
          console.error('Failed to delete image:', err.message);
        }
      }
    }
  }
};

// ==================== CUSTOMER FUNCTIONS ====================

// Create Return Request
var createReturn = async function(req, res) {
  try {
    var orderId = req.body.orderId;
    var productId = req.body.productId;
    var reason = req.body.reason;
    var description = req.body.description;
    var productDetails = req.body.productDetails;
    var refundMethod = req.body.refundMethod;
    var refundDetails = req.body.refundDetails;

    var userId = req.user._id || req.user.id;

    // Verify order exists and belongs to user
    var order = await orderModel.findById(orderId);
    if (!order) {
      cleanTempFiles(req.files);
      return res.json({ success: false, message: "Order not found" });
    }

    var orderUserId = order.userId ? (order.userId._id || order.userId.id || order.userId) : null;
    if (!orderUserId || String(orderUserId) !== String(userId)) {
      cleanTempFiles(req.files);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (order.status !== 'Delivered') {
      cleanTempFiles(req.files);
      return res.json({ success: false, message: "Only delivered orders can be returned" });
    }

    // Check if return already exists
    var existingReturn = await returnModel.findOne({
      orderId: orderId,
      productId: productId,
      status: { $nin: ['rejected', 'cancelled', 'completed'] }
    });

    if (existingReturn) {
      cleanTempFiles(req.files);
      return res.json({ success: false, message: "Return request already exists for this product" });
    }

    // Upload proof images to Cloudinary
    var proofImages = [];
    if (req.files && req.files.length > 0) {
      for (var i = 0; i < req.files.length; i++) {
        try {
          var result = await uploadToCloudinary(req.files[i].path, 'rb-jewellery/returns');
          if (result && result.url) {
            proofImages.push(result.url);
          }
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr.message);
        }
      }
      cleanTempFiles(req.files);
    }

    // Parse JSON fields
    var parsedProductDetails = productDetails;
    if (typeof productDetails === 'string') {
      try {
        parsedProductDetails = JSON.parse(productDetails);
      } catch (e) {
        parsedProductDetails = {};
      }
    }

    var parsedRefundDetails = refundDetails || {};
    if (typeof refundDetails === 'string') {
      try {
        parsedRefundDetails = JSON.parse(refundDetails);
      } catch (e) {
        parsedRefundDetails = {};
      }
    }

    var quantity = parsedProductDetails.quantity || 1;
    var price = parsedProductDetails.price || 0;

    // Create return request
    var returnData = {
      orderId: orderId,
      userId: userId,
      productId: productId,
      productDetails: parsedProductDetails,
      reason: reason,
      description: description,
      proofImages: proofImages,
      refundMethod: refundMethod || 'easypaisa',
      refundDetails: parsedRefundDetails,
      refundAmount: price * quantity,
      status: 'pending'
    };

    var newReturn = await returnModel.create(returnData);

    res.json({
      success: true,
      message: "Return request submitted successfully. Please wait for admin approval.",
      return: newReturn
    });
  } catch (error) {
    cleanTempFiles(req.files);
    console.error('Create return error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to create return request');
    res.json({ success: false, message: errorMsg });
  }
};

// Upload Shipping Receipt
var uploadShippingReceipt = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var courier = req.body.courier;
    var trackingNumber = req.body.trackingNumber;
    var estimatedDelivery = req.body.estimatedDelivery;
    var notes = req.body.notes;

    console.log('Upload shipping receipt for return:', returnId);

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      if (req.file && req.file.path) cleanTempFile(req.file.path);
      return res.json({ success: false, message: "Return not found" });
    }

    var returnUserId = returnData.userId ? (returnData.userId._id || returnData.userId.id || returnData.userId) : null;
    var reqUserId = req.user._id || req.user.id;

    if (!returnUserId || String(returnUserId) !== String(reqUserId)) {
      if (req.file && req.file.path) cleanTempFile(req.file.path);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (returnData.status !== 'approved') {
      if (req.file && req.file.path) cleanTempFile(req.file.path);
      return res.json({ success: false, message: "Return must be approved before shipping" });
    }

    if (!req.file) {
      return res.json({ success: false, message: "Please upload courier receipt image" });
    }

    // Upload receipt to Cloudinary
    var result = await uploadToCloudinary(req.file.path, 'rb-jewellery/returns/receipts');
    cleanTempFile(req.file.path);

    // Update shipping info
    var shippingInfo = {
      courier: courier || 'other',
      trackingNumber: trackingNumber || '',
      shippedDate: new Date().toISOString(),
      receiptImage: result.url,
      estimatedDelivery: estimatedDelivery || '',
      notes: notes || ''
    };

    // Get existing status history
    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'shipped',
      date: new Date().toISOString(),
      note: 'Item shipped via ' + courier + '. Tracking: ' + trackingNumber,
      updatedBy: 'customer'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      shippingInfo: shippingInfo,
      status: 'shipped',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({
      success: true,
      message: "Shipping details uploaded. We will update you once we receive the item.",
      return: updatedReturn
    });
  } catch (error) {
    if (req.file && req.file.path) cleanTempFile(req.file.path);
    console.error('Upload shipping receipt error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to upload shipping details');
    res.json({ success: false, message: errorMsg });
  }
};

// Cancel Return Request
var cancelReturn = async function(req, res) {
  try {
    var returnId = req.body.returnId;

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    var returnUserId = returnData.userId ? (returnData.userId._id || returnData.userId.id || returnData.userId) : null;
    var reqUserId = req.user._id || req.user.id;

    if (!returnUserId || String(returnUserId) !== String(reqUserId)) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (['pending', 'approved'].indexOf(returnData.status) === -1) {
      return res.json({ success: false, message: "Cannot cancel return at this stage" });
    }

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'cancelled',
      date: new Date().toISOString(),
      note: 'Cancelled by customer',
      updatedBy: 'customer'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      status: 'cancelled',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({ success: true, message: "Return request cancelled", return: updatedReturn });
  } catch (error) {
    console.error('Cancel return error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to cancel return');
    res.json({ success: false, message: errorMsg });
  }
};

// Get User Returns
var getUserReturns = async function(req, res) {
  try {
    var userId = req.user._id || req.user.id;

    var returns = await returnModel.find({ userId: userId });

    res.json({ success: true, returns: returns });
  } catch (error) {
    console.error('Get user returns error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load returns');
    res.json({ success: false, message: errorMsg });
  }
};

// Get Single Return by ID
var getReturnById = async function(req, res) {
  try {
    var id = req.params.id;

    var returnData = await returnModel.findById(id);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    var reqUserId = req.user._id || req.user.id;
    var returnUserId = returnData.userId ? (returnData.userId._id || returnData.userId.id || returnData.userId) : null;

    // Check if admin or owner
    var isAdmin = req.user.isAdmin || String(reqUserId) === 'admin';
    var isOwner = returnUserId && String(returnUserId) === String(reqUserId);

    if (!isAdmin && !isOwner) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    res.json({ success: true, return: returnData });
  } catch (error) {
    console.error('Get return by ID error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load return');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== ADMIN FUNCTIONS ====================

// Get All Returns (Admin)
var getAllReturns = async function(req, res) {
  try {
    var returns = await returnModel.find({});

    res.json({ success: true, returns: returns });
  } catch (error) {
    console.error('Get all returns error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load returns');
    res.json({ success: false, message: errorMsg });
  }
};

// Approve Return (Admin)
var approveReturn = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var adminNote = req.body.adminNote;
    var returnAddress = req.body.returnAddress;

    console.log('Approving return:', returnId);

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    if (returnData.status !== 'pending') {
      return res.json({ success: false, message: "Can only approve pending returns" });
    }

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'approved',
      date: new Date().toISOString(),
      note: adminNote || 'Return request approved',
      updatedBy: 'admin'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      status: 'approved',
      adminNote: adminNote || '',
      returnAddress: returnAddress || process.env.STORE_ADDRESS || 'Contact us for return address',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({
      success: true,
      message: "Return approved. Customer will be notified to ship the item.",
      return: updatedReturn
    });
  } catch (error) {
    console.error('Approve return error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to approve return');
    res.json({ success: false, message: errorMsg });
  }
};

// Reject Return (Admin)
var rejectReturn = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var rejectionReason = req.body.rejectionReason;
    var adminNote = req.body.adminNote;

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    if (returnData.status !== 'pending') {
      return res.json({ success: false, message: "Can only reject pending returns" });
    }

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'rejected',
      date: new Date().toISOString(),
      note: rejectionReason || 'Return request rejected',
      updatedBy: 'admin'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      status: 'rejected',
      rejectionReason: rejectionReason || 'Does not meet return policy',
      adminNote: adminNote || '',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({ success: true, message: "Return rejected", return: updatedReturn });
  } catch (error) {
    console.error('Reject return error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to reject return');
    res.json({ success: false, message: errorMsg });
  }
};

// Mark Item Received (Admin)
var markItemReceived = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var adminNote = req.body.adminNote;

    console.log('Marking item received:', returnId);

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    if (returnData.status !== 'shipped') {
      return res.json({ success: false, message: "Item must be shipped first" });
    }

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'received',
      date: new Date().toISOString(),
      note: adminNote || 'Item received at warehouse',
      updatedBy: 'admin'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      status: 'received',
      adminNote: adminNote || '',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({ success: true, message: "Item marked as received", return: updatedReturn });
  } catch (error) {
    console.error('Mark item received error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to mark item received');
    res.json({ success: false, message: errorMsg });
  }
};

// Process Refund (Admin)
var processRefund = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var refundAmount = req.body.refundAmount;
    var adminNote = req.body.adminNote;

    console.log('Processing refund:', returnId);

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    if (returnData.status !== 'received') {
      return res.json({ success: false, message: "Item must be received first" });
    }

    var finalAmount = refundAmount || returnData.refundAmount || 0;

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: 'refund_processing',
      date: new Date().toISOString(),
      note: 'Processing refund of Rs. ' + finalAmount,
      updatedBy: 'admin'
    });

    await returnModel.findByIdAndUpdate(returnId, {
      status: 'refund_processing',
      refundAmount: finalAmount,
      adminNote: adminNote || '',
      statusHistory: statusHistory
    });

    var updatedReturn = await returnModel.findById(returnId);

    res.json({ success: true, message: "Refund processing started", return: updatedReturn });
  } catch (error) {
    console.error('Process refund error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to process refund');
    res.json({ success: false, message: errorMsg });
  }
};

// Complete Refund (Admin) - FIXED
var completeRefund = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var refundTransactionId = req.body.refundTransactionId;
    var adminNote = req.body.adminNote;

    console.log('=== COMPLETE REFUND ===');
    console.log('Return ID:', returnId);
    console.log('Transaction ID:', refundTransactionId);

    if (!returnId) {
      return res.json({ success: false, message: "Return ID is required" });
    }

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      console.log('Return not found');
      return res.json({ success: false, message: "Return not found" });
    }

    console.log('Current status:', returnData.status);

    if (returnData.status !== 'refund_processing') {
      console.log('Invalid status for complete refund');
      return res.json({ success: false, message: "Refund must be processing first. Current status: " + returnData.status });
    }

    // Build status history
    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    
    statusHistory.push({
      status: 'completed',
      date: new Date().toISOString(),
      note: 'Refund completed. Transaction ID: ' + (refundTransactionId || 'N/A'),
      updatedBy: 'admin'
    });

    // Update return
    var updateData = {
      status: 'completed',
      refundTransactionId: refundTransactionId || '',
      refundDate: new Date().toISOString(),
      statusHistory: statusHistory
    };

    if (adminNote) {
      updateData.adminNote = adminNote;
    }

    console.log('Updating with status:', updateData.status);

    var updatedReturn = await returnModel.findByIdAndUpdate(returnId, updateData, { new: true });

    if (!updatedReturn) {
      console.log('Update failed - no return returned');
      return res.json({ success: false, message: "Failed to update return" });
    }

    console.log('Updated status:', updatedReturn.status);
    console.log('=== COMPLETE REFUND DONE ===');

    res.json({ 
      success: true, 
      message: "Refund completed successfully!", 
      return: updatedReturn 
    });
  } catch (error) {
    console.error('Complete refund error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to complete refund');
    res.json({ success: false, message: errorMsg });
  }
};

// Update Return Status (Admin - Generic)
var updateReturnStatus = async function(req, res) {
  try {
    var returnId = req.body.returnId;
    var status = req.body.status;
    var adminNote = req.body.adminNote;
    var rejectionReason = req.body.rejectionReason;
    var returnAddress = req.body.returnAddress;
    var refundAmount = req.body.refundAmount;
    var refundTransactionId = req.body.refundTransactionId;

    var returnData = await returnModel.findById(returnId);

    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    var updateData = { status: status };

    if (adminNote) updateData.adminNote = adminNote;
    if (rejectionReason) updateData.rejectionReason = rejectionReason;
    if (returnAddress) updateData.returnAddress = returnAddress;
    if (refundAmount) updateData.refundAmount = refundAmount;
    if (refundTransactionId) {
      updateData.refundTransactionId = refundTransactionId;
      updateData.refundDate = new Date().toISOString();
    }

    var statusHistory = returnData.statusHistory || [];
    if (!Array.isArray(statusHistory)) {
      statusHistory = [];
    }
    statusHistory.push({
      status: status,
      date: new Date().toISOString(),
      note: adminNote || 'Status updated to ' + status,
      updatedBy: 'admin'
    });

    updateData.statusHistory = statusHistory;

    await returnModel.findByIdAndUpdate(returnId, updateData);

    var updatedReturn = await returnModel.findById(returnId);

    res.json({ success: true, message: "Return status updated", return: updatedReturn });
  } catch (error) {
    console.error('Update return status error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to update status');
    res.json({ success: false, message: errorMsg });
  }
};

// Delete Return (Admin)
var deleteReturn = async function(req, res) {
  try {
    var id = req.params.id;

    var returnData = await returnModel.findById(id);
    if (!returnData) {
      return res.json({ success: false, message: "Return not found" });
    }

    // Delete proof images from Cloudinary
    if (returnData.proofImages) {
      await deleteCloudinaryImages(returnData.proofImages);
    }

    // Delete receipt image
    if (returnData.shippingInfo && returnData.shippingInfo.receiptImage) {
      await deleteCloudinaryImages([returnData.shippingInfo.receiptImage]);
    }

    await returnModel.findByIdAndDelete(id);

    res.json({ success: true, message: "Return deleted" });
  } catch (error) {
    console.error('Delete return error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to delete return');
    res.json({ success: false, message: errorMsg });
  }
};

// Get Return Stats (Admin)
var getReturnStats = async function(req, res) {
  try {
    var stats = await returnModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$refundAmount' }
        }
      }
    ]);

    var totalReturns = await returnModel.countDocuments();
    var totalRefunded = await returnModel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$refundAmount' } } }
    ]);

    var refundedAmount = 0;
    if (totalRefunded && totalRefunded[0] && totalRefunded[0].total) {
      refundedAmount = totalRefunded[0].total;
    }

    res.json({
      success: true,
      stats: stats,
      totalReturns: totalReturns,
      totalRefunded: refundedAmount
    });
  } catch (error) {
    console.error('Get return stats error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to get stats');
    res.json({ success: false, message: errorMsg });
  }
};

export {
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
};