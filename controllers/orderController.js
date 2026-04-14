// controllers/orderController.js
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Cart from "../models/Cart.js";  // ✅ Add this
import nodemailer from "nodemailer";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { cleanTempFile } from "../middleware/upload.js";

// Email transporter
let transporter = null;

const initTransporter = () => {
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

// Send order confirmation email
const sendOrderConfirmationEmail = async (order, userEmail) => {
  try {
    const emailTransporter = initTransporter();

    let itemsHtml = '';
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      itemsHtml += '<tr><td style="padding: 10px; border-bottom: 1px solid #ddd;">' + item.name + '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">' + item.quantity + '</td><td style="padding: 10px; border-bottom: 1px solid #ddd;">Rs. ' + item.price + '</td></tr>';
    }

    const orderId = order.id || order._id;
    const orderIdStr = String(orderId).slice(-8).toUpperCase();

    const htmlContent = '<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 15px; overflow: hidden;"><div style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 50%, #d4af37 100%); padding: 30px; text-align: center;"><h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">Order Confirmed! 🎉</h1></div><div style="padding: 30px; color: #f4e5c2;"><p style="margin-bottom: 20px;">Thank you for your order! Here are your order details:</p><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><thead><tr style="background: rgba(212, 175, 55, 0.2);"><th style="padding: 10px; text-align: left; color: #d4af37;">Item</th><th style="padding: 10px; text-align: left; color: #d4af37;">Qty</th><th style="padding: 10px; text-align: left; color: #d4af37;">Price</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div style="background: rgba(212, 175, 55, 0.1); padding: 15px; border-radius: 10px; border: 1px solid #d4af37;"><p style="margin: 0; font-size: 20px; color: #d4af37;"><strong>Total: Rs. ' + order.amount.toLocaleString() + '</strong></p><p style="margin: 10px 0 0 0; color: #ccc;">Payment Method: ' + order.paymentMethod + '</p></div></div></div>';

    await emailTransporter.sendMail({
      from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
      to: userEmail,
      subject: 'Order Confirmed - RB Jewellery #' + orderIdStr,
      html: htmlContent
    });

    console.log('Order confirmation email sent to:', userEmail);
  } catch (error) {
    console.error('Email send error:', error);
  }
};

// ✅ Helper to clear cart using Cart model
const clearUserCart = async (userId) => {
  try {
    await Cart.clear(userId);
    console.log('Cart cleared for user:', userId);
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
};

// Place Order - COD
const placeOrder = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    console.log('Placing COD order for user:', userId);
    console.log('Items:', items.length);

    if (!items || items.length === 0) {
      return res.json({ success: false, message: "No items in order" });
    }

    const orderData = {
      userId: userId,
      items: items,
      amount: amount,
      address: address,
      paymentMethod: "COD",
      payment: false,
      status: "Order Placed",
      date: Date.now()
    };

    const newOrder = await orderModel.create(orderData);

    // ✅ Clear cart using Cart model
    await clearUserCart(userId);

    // Send email
    const user = await userModel.findById(userId);
    if (user && user.email) {
      sendOrderConfirmationEmail(newOrder, user.email);
    }

    res.json({ success: true, message: 'Order placed successfully', orderId: newOrder.id || newOrder._id });
  } catch (error) {
    console.error('Place order error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Place Order - Easypaisa
const placeOrderEasypaisa = async (req, res) => {
  try {
    const { userId, items, amount, address, paymentDetails } = req.body;

    console.log('Placing Easypaisa order for user:', userId);
    console.log('Items:', items.length);

    if (!items || items.length === 0) {
      return res.json({ success: false, message: "No items in order" });
    }

    const orderData = {
      userId: userId,
      items: items,
      amount: amount,
      address: address,
      paymentMethod: "Easypaisa",
      payment: false,
      status: "Payment Pending",
      paymentDetails: {
        transactionId: paymentDetails?.transactionId || "",
        senderName: paymentDetails?.senderName || "",
        senderNumber: paymentDetails?.senderNumber || ""
      },
      date: Date.now()
    };

    const newOrder = await orderModel.create(orderData);

    // ✅ Clear cart using Cart model
    await clearUserCart(userId);

    // Send email
    const user = await userModel.findById(userId);
    if (user && user.email) {
      sendOrderConfirmationEmail(newOrder, user.email);
    }

    res.json({ success: true, message: 'Order placed. Please upload payment screenshot.', orderId: newOrder.id || newOrder._id });
  } catch (error) {
    console.error('Place Easypaisa order error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Place Order - Bank Transfer
const placeOrderBankTransfer = async (req, res) => {
  try {
    const { userId, items, amount, address, paymentDetails } = req.body;

    console.log('Placing Bank Transfer order for user:', userId);
    console.log('Items:', items.length);

    if (!items || items.length === 0) {
      return res.json({ success: false, message: "No items in order" });
    }

    const orderData = {
      userId: userId,
      items: items,
      amount: amount,
      address: address,
      paymentMethod: "BankTransfer",
      payment: false,
      status: "Payment Pending",
      paymentDetails: {
        transactionId: paymentDetails?.transactionId || "",
        senderName: paymentDetails?.senderName || "",
        senderNumber: paymentDetails?.senderNumber || ""
      },
      date: Date.now()
    };

    const newOrder = await orderModel.create(orderData);

    // ✅ Clear cart using Cart model
    await clearUserCart(userId);

    // Send email
    const user = await userModel.findById(userId);
    if (user && user.email) {
      sendOrderConfirmationEmail(newOrder, user.email);
    }

    res.json({ success: true, message: 'Order placed. Please upload payment screenshot.', orderId: newOrder.id || newOrder._id });
  } catch (error) {
    console.error('Place Bank Transfer order error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Place Order - WhatsApp
const placeOrderWhatsApp = async (req, res) => {
  try {
    const { userId, items, amount, address } = req.body;

    console.log('Placing WhatsApp order for user:', userId);
    console.log('Items:', items.length);

    if (!items || items.length === 0) {
      return res.json({ success: false, message: "No items in order" });
    }

    const orderData = {
      userId: userId,
      items: items,
      amount: amount,
      address: address,
      paymentMethod: "WhatsApp",
      payment: false,
      status: "Payment Pending",
      date: Date.now()
    };

    const newOrder = await orderModel.create(orderData);

    // ✅ Clear cart using Cart model
    await clearUserCart(userId);

    res.json({ success: true, message: 'Order created. Please confirm via WhatsApp.', orderId: newOrder.id || newOrder._id });
  } catch (error) {
    console.error('Place WhatsApp order error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Upload Payment Proof
const uploadPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      cleanTempFile(req.file?.path);
      return res.json({ success: false, message: "Order ID is required" });
    }

    if (!req.file) {
      return res.json({ success: false, message: "Payment screenshot is required" });
    }

    const existingOrder = await orderModel.findById(orderId);
    if (!existingOrder) {
      cleanTempFile(req.file.path);
      return res.json({ success: false, message: "Order not found" });
    }

    let cloudinaryUrl;
    try {
      const result = await uploadToCloudinary(req.file.path, 'rb-jewellery/payment-proofs');
      cloudinaryUrl = result.url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      cleanTempFile(req.file.path);
      return res.json({ success: false, message: "Failed to upload image" });
    }

    cleanTempFile(req.file.path);

    const updateData = { paymentProof: cloudinaryUrl };
    if (existingOrder.status === "Order Placed") {
      updateData.status = "Payment Pending";
    }

    const order = await orderModel.findByIdAndUpdate(orderId, updateData, { new: true });

    res.json({ 
      success: true, 
      message: "Payment proof uploaded successfully.", 
      order: order 
    });
  } catch (error) {
    console.error('Upload payment proof error:', error);
    cleanTempFile(req.file?.path);
    res.json({ success: false, message: error.message });
  }
};

// Verify Payment (Admin)
const verifyPayment = async (req, res) => {
  try {
    const { orderId, verified, adminNote } = req.body;

    const updateData = {
      payment: verified,
      status: verified ? "Payment Verified" : "Payment Pending",
      adminNote: adminNote || ""
    };

    const order = await orderModel.findByIdAndUpdate(orderId, updateData, { new: true });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, message: verified ? "Payment verified" : "Payment rejected", order: order });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Update Payment Status (Admin)
const updatePaymentStatus = async (req, res) => {
  try {
    const { orderId, payment } = req.body;

    if (!orderId) {
      return res.json({ success: false, message: "Order ID is required" });
    }

    if (typeof payment !== 'boolean') {
      return res.json({ success: false, message: "Payment status must be true or false" });
    }

    const updateData = { 
      payment: payment,
      paymentVerifiedAt: payment ? new Date() : null
    };

    if (payment) {
      const currentOrder = await orderModel.findById(orderId);
      if (currentOrder && currentOrder.status === "Payment Pending") {
        updateData.status = "Payment Verified";
      }
    }

    const order = await orderModel.findByIdAndUpdate(orderId, updateData, { new: true });

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    res.json({ 
      success: true, 
      message: payment ? "Payment marked as Paid" : "Payment marked as Unpaid",
      order: order 
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get all orders (Admin)
const allOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, orders: orders });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get user orders
const userOrders = async (req, res) => {
  try {
    const { userId } = req.body;
    
    // ✅ Get userId from auth middleware if not in body
    const userIdToUse = userId || req.user?.id || req.user?._id;
    
    if (!userIdToUse) {
      return res.json({ success: false, message: "User ID is required" });
    }
    
    const orders = await orderModel.find({ userId: userIdToUse });
    res.json({ success: true, orders: orders });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Update order status (Admin)
const updateStatus = async (req, res) => {
  try {
    const { orderId, status, adminNote } = req.body;

    const updateData = { status: status };
    if (adminNote) updateData.adminNote = adminNote;

    if (status === "Delivered") {
      const order = await orderModel.findById(orderId);
      if (order && order.paymentMethod === "COD" && !order.payment) {
        updateData.payment = true;
        updateData.paymentVerifiedAt = new Date();
      }
    }

    await orderModel.findByIdAndUpdate(orderId, updateData);
    res.json({ success: true, message: 'Status Updated' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
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
};