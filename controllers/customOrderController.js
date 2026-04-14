import customOrderModel from "../models/customOrderModel.js";
import nodemailer from "nodemailer";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { cleanTempFiles } from "../middleware/upload.js";

// Helper to get error message safely
var getErrorMessage = function(error, fallback) {
  if (!fallback) fallback = 'An error occurred';
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  return fallback;
};

// Helper to extract userId from request
var extractUserId = function(req) {
  // From auth middleware
  if (req.user) {
    var id = req.user._id || req.user.id || req.user.userId;
    if (id && id !== 'admin') return id;
  }
  
  // From body
  if (req.body && req.body.userId && req.body.userId !== 'admin') {
    return req.body.userId;
  }
  
  return null;
};

// Email transporter
var transporter = null;

var initTransporter = function() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
      }
    });
  }
  return transporter;
};

// Create Custom Order Request
var createCustomOrder = async function(req, res) {
  try {
    console.log('=== CREATE CUSTOM ORDER ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user);
    console.log('Files:', req.files ? req.files.length : 0);

    var customerName = req.body.customerName;
    var customerEmail = req.body.customerEmail;
    var customerPhone = req.body.customerPhone;
    var customerWhatsApp = req.body.customerWhatsApp;
    var jewelleryType = req.body.jewelleryType;
    var description = req.body.description;
    var budgetMin = req.body.budgetMin;
    var budgetMax = req.body.budgetMax;
    var size = req.body.size;
    var materialPreference = req.body.materialPreference;
    var requiredBy = req.body.requiredBy;
    var occasion = req.body.occasion;

    // Get userId from auth or null for guest
    var userId = extractUserId(req);
    console.log('Extracted userId:', userId);

    // Validate required fields
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    if (!customerEmail || !customerEmail.trim()) {
      return res.status(400).json({ success: false, message: "Customer email is required" });
    }
    if (!customerPhone || !customerPhone.trim()) {
      return res.status(400).json({ success: false, message: "Customer phone is required" });
    }
    if (!jewelleryType || !jewelleryType.trim()) {
      return res.status(400).json({ success: false, message: "Jewellery type is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: "Description is required" });
    }

    // Upload reference images to Cloudinary
    var referenceImages = [];
    if (req.files && req.files.length > 0) {
      console.log('Uploading', req.files.length, 'images...');
      for (var i = 0; i < req.files.length; i++) {
        try {
          var result = await uploadToCloudinary(req.files[i].path, 'rb-jewellery/custom-orders');
          if (result && result.url) {
            referenceImages.push(result.url);
            console.log('Image uploaded:', result.url);
          }
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr.message);
        }
      }
      cleanTempFiles(req.files);
    }

    var customOrderData = {
      userId: userId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      customerPhone: customerPhone.trim(),
      customerWhatsApp: (customerWhatsApp || customerPhone).trim(),
      jewelleryType: jewelleryType.trim(),
      description: description.trim(),
      referenceImages: referenceImages,
      budgetMin: Number(budgetMin) || 0,
      budgetMax: Number(budgetMax) || 0,
      size: (size || "").trim(),
      materialPreference: materialPreference || "Artificial Gold Plated",
      requiredBy: requiredBy ? new Date(requiredBy) : null,
      occasion: (occasion || "").trim(),
      status: 'pending'
    };

    console.log('Creating order with data:', JSON.stringify(customOrderData, null, 2));

    var newCustomOrder = await customOrderModel.create(customOrderData);

    if (!newCustomOrder) {
      return res.status(500).json({ success: false, message: "Failed to create custom order" });
    }

    console.log('Custom order created successfully:', newCustomOrder.id || newCustomOrder._id);

    // Send confirmation email to customer
    try {
      var emailTransporter = initTransporter();
      var budgetMinStr = budgetMin ? Number(budgetMin).toLocaleString() : '0';
      var budgetMaxStr = budgetMax ? Number(budgetMax).toLocaleString() : '0';

      await emailTransporter.sendMail({
        from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
        to: customerEmail,
        subject: "Custom Order Request Received - RB Jewellery",
        html: `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 15px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 100%); padding: 30px; text-align: center;">
    <h1 style="color: #1a1a1a; margin: 0;">Custom Order Request Received!</h1>
  </div>
  <div style="padding: 30px; color: #f4e5c2;">
    <p>Dear ${customerName},</p>
    <p>Thank you for your custom jewellery request! We have received your inquiry and our design team will review it shortly.</p>
    <p><strong>Jewellery Type:</strong> ${jewelleryType}</p>
    <p><strong>Budget Range:</strong> Rs. ${budgetMinStr} - Rs. ${budgetMaxStr}</p>
    <p>We will contact you within 24-48 hours with a quote and design consultation.</p>
    <p style="color: #d4af37;">Thank you for choosing RB Jewellery!</p>
  </div>
</body>
</html>`
      });
      console.log('Customer email sent');
    } catch (emailError) {
      console.error("Customer email error:", emailError.message);
    }

    // Notify admin
    try {
      var adminTransporter = initTransporter();
      await adminTransporter.sendMail({
        from: '"RB Jewellery System" <' + process.env.GMAIL_USER + '>',
        to: process.env.GMAIL_USER,
        subject: 'New Custom Order Request - ' + jewelleryType,
        html: `<h2>New Custom Order Request</h2>
<p><strong>Customer:</strong> ${customerName}</p>
<p><strong>Phone:</strong> ${customerPhone}</p>
<p><strong>Email:</strong> ${customerEmail}</p>
<p><strong>Type:</strong> ${jewelleryType}</p>
<p><strong>Budget:</strong> Rs. ${budgetMin} - Rs. ${budgetMax}</p>
<p><strong>Description:</strong> ${description}</p>
<p><strong>User ID:</strong> ${userId || 'Guest'}</p>`
      });
      console.log('Admin notification sent');
    } catch (adminEmailError) {
      console.error("Admin notification error:", adminEmailError.message);
    }

    res.status(201).json({
      success: true,
      message: "Custom order request submitted successfully! We will contact you soon.",
      customOrder: newCustomOrder
    });

  } catch (error) {
    if (req.files) {
      cleanTempFiles(req.files);
    }
    console.error('Create custom order error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to submit custom order');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get User's Custom Orders - FIXED
var getUserCustomOrders = async function(req, res) {
  try {
    console.log('=== GET USER CUSTOM ORDERS ===');
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);

    // Extract userId from auth middleware
    var userId = extractUserId(req);

    if (!userId) {
      console.error('No userId found in request');
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated. Please login.' 
      });
    }

    console.log('Fetching custom orders for userId:', userId, 'Type:', typeof userId);

    // Query orders for this user
    var customOrders = await customOrderModel.find({ userId: userId });

    console.log('Found', customOrders.length, 'custom orders');

    // Also try to find orders by email if user has email
    if (customOrders.length === 0 && req.user && req.user.email) {
      console.log('No orders found by userId, trying email:', req.user.email);
      var ordersByEmail = await customOrderModel.find({ customerEmail: req.user.email });
      if (ordersByEmail.length > 0) {
        console.log('Found', ordersByEmail.length, 'orders by email');
        customOrders = ordersByEmail;
      }
    }

    res.json({ 
      success: true, 
      customOrders: customOrders,
      count: customOrders.length
    });

  } catch (error) {
    console.error('Get user custom orders error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load custom orders');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get All Custom Orders (Admin)
var getAllCustomOrders = async function(req, res) {
  try {
    console.log('=== GET ALL CUSTOM ORDERS (ADMIN) ===');
    
    var customOrders = await customOrderModel.findAll();
    
    console.log('Total custom orders:', customOrders.length);
    
    res.json({ 
      success: true, 
      customOrders: customOrders,
      count: customOrders.length
    });
  } catch (error) {
    console.error('Get all custom orders error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load custom orders');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Update Custom Order Status (Admin)
var updateCustomOrderStatus = async function(req, res) {
  try {
    console.log('=== UPDATE CUSTOM ORDER STATUS ===');
    console.log('Body:', req.body);

    var customOrderId = req.body.customOrderId;
    var status = req.body.status;
    var adminQuote = req.body.adminQuote;
    var adminNote = req.body.adminNote;

    if (!customOrderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    var updateData = { status: status };
    if (adminNote !== undefined) updateData.adminNote = adminNote;
    if (adminQuote) updateData.adminQuote = adminQuote;

    console.log('Updating order:', customOrderId, 'with data:', updateData);

    var customOrder = await customOrderModel.findByIdAndUpdate(
      customOrderId,
      updateData,
      { new: true }
    );

    if (!customOrder) {
      return res.status(404).json({ success: false, message: "Custom order not found" });
    }

    console.log('Order updated successfully');

    // Send email to customer about status update
    if (status === 'quoted' && adminQuote && adminQuote.price) {
      try {
        var emailTransporter = initTransporter();
        var priceStr = adminQuote.price ? Number(adminQuote.price).toLocaleString() : '0';
        var daysStr = adminQuote.estimatedDays || 'N/A';
        var notesStr = adminQuote.notes || '';

        var notesHtml = '';
        if (notesStr) {
          notesHtml = '<p style="margin: 10px 0 0 0;">Notes: ' + notesStr + '</p>';
        }

        await emailTransporter.sendMail({
          from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
          to: customOrder.customerEmail,
          subject: "Your Custom Order Quote - RB Jewellery",
          html: `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 15px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 100%); padding: 30px; text-align: center;">
    <h1 style="color: #1a1a1a; margin: 0;">Your Custom Order Quote</h1>
  </div>
  <div style="padding: 30px; color: #f4e5c2;">
    <p>Dear ${customOrder.customerName},</p>
    <p>We have reviewed your custom jewellery request and here is our quote:</p>
    <div style="background: rgba(212, 175, 55, 0.1); padding: 20px; border-radius: 10px; border: 1px solid #d4af37; margin: 20px 0;">
      <p style="font-size: 24px; color: #d4af37; margin: 0;"><strong>Price: Rs. ${priceStr}</strong></p>
      <p style="margin: 10px 0 0 0;">Estimated Delivery: ${daysStr} days</p>
      ${notesHtml}
    </div>
    <p>To proceed with your order, please contact us via WhatsApp or reply to this email.</p>
  </div>
</body>
</html>`
        });
        console.log('Quote email sent to customer');
      } catch (emailError) {
        console.error("Quote email error:", emailError.message);
      }
    }

    res.json({ 
      success: true, 
      message: "Custom order updated successfully", 
      customOrder: customOrder 
    });

  } catch (error) {
    console.error('Update custom order status error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to update custom order');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get Custom Order by ID
var getCustomOrderById = async function(req, res) {
  try {
    var id = req.params.id;
    console.log('=== GET CUSTOM ORDER BY ID ===');
    console.log('Order ID:', id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    var customOrder = await customOrderModel.findById(id);

    if (!customOrder) {
      return res.status(404).json({ success: false, message: "Custom order not found" });
    }

    // Verify user owns this order (if not admin)
    var userId = extractUserId(req);
    var isAdmin = req.user && (req.user.isAdmin || req.user._id === 'admin');

    if (!isAdmin && customOrder.userId && String(customOrder.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized to view this order" });
    }

    res.json({ success: true, customOrder: customOrder });

  } catch (error) {
    console.error('Get custom order by ID error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to load custom order');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Delete Custom Order (Admin)
var deleteCustomOrder = async function(req, res) {
  try {
    var id = req.params.id;
    console.log('=== DELETE CUSTOM ORDER ===');
    console.log('Order ID:', id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    var customOrder = await customOrderModel.findByIdAndDelete(id);

    if (!customOrder) {
      return res.status(404).json({ success: false, message: "Custom order not found" });
    }

    console.log('Custom order deleted successfully');

    res.json({ success: true, message: "Custom order deleted successfully" });

  } catch (error) {
    console.error('Delete custom order error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to delete custom order');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Debug endpoint - Get orders with detailed info
var debugUserOrders = async function(req, res) {
  try {
    var userId = extractUserId(req);
    var userEmail = req.user ? req.user.email : null;

    console.log('=== DEBUG USER ORDERS ===');
    console.log('userId:', userId, 'Type:', typeof userId);
    console.log('userEmail:', userEmail);

    // Direct SQL query for debugging
    var result = await pool.query(
      'SELECT id, userId, customerEmail, customerName, status, created_at FROM custom_orders ORDER BY created_at DESC LIMIT 20'
    );

    var allOrders = result[0];

    // Find matching orders
    var matchingOrders = allOrders.filter(function(order) {
      var orderUserId = order.userId;
      var matches = (
        String(orderUserId) === String(userId) ||
        Number(orderUserId) === Number(userId) ||
        order.customerEmail === userEmail
      );
      return matches;
    });

    res.json({
      success: true,
      debug: {
        requestUserId: userId,
        requestUserIdType: typeof userId,
        requestUserEmail: userEmail,
        totalOrdersInDB: allOrders.length,
        matchingOrders: matchingOrders.length,
        allOrders: allOrders.map(function(o) {
          return {
            id: o.id,
            userId: o.userId,
            userIdType: typeof o.userId,
            email: o.customerEmail,
            status: o.status
          };
        }),
        matchingOrderDetails: matchingOrders
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Import pool for debug endpoint
import pool from '../config/database.js';

export {
  createCustomOrder,
  getUserCustomOrders,
  getAllCustomOrders,
  updateCustomOrderStatus,
  getCustomOrderById,
  deleteCustomOrder,
  debugUserOrders
};