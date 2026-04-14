import whatsappInquiryModel from "../models/whatsappInquiryModel.js";
import settingsModel from "../models/settingsModel.js";

// Log WhatsApp inquiry
const logWhatsAppInquiry = async (req, res) => {
  try {
    const {
      productId, productName, productPrice,
      customerName, customerPhone, message, inquiryType
    } = req.body;

    const userId = req.body.userId || null;

    const inquiry = await whatsappInquiryModel.create({
      userId: userId,
      productId: productId || null,
      productName: productName || '',
      productPrice: productPrice || 0,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      message: message || '',
      inquiryType: inquiryType || 'general'
    });

    res.json({ success: true, message: "Inquiry logged", inquiry: inquiry });
  } catch (error) {
    console.log("Log inquiry error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Get WhatsApp number - PUBLIC route
const getWhatsAppNumber = async (req, res) => {
  try {
    const setting = await settingsModel.findOne({ key: 'whatsappNumber' });

    const whatsappNumber = setting && setting.value
      ? setting.value
      : (process.env.WHATSAPP_NUMBER || "+923102442743");

    res.json({ success: true, whatsappNumber: whatsappNumber });
  } catch (error) {
    console.log("Get WhatsApp number error:", error);
    res.json({
      success: true,
      whatsappNumber: process.env.WHATSAPP_NUMBER || "+923102442743"
    });
  }
};

// Update WhatsApp number (Admin)
const updateWhatsAppNumber = async (req, res) => {
  try {
    const { whatsappNumber } = req.body;

    if (!whatsappNumber) {
      return res.json({ success: false, message: "WhatsApp number is required" });
    }

    const setting = await settingsModel.findOneAndUpdate(
      { key: 'whatsappNumber' },
      { value: whatsappNumber },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "WhatsApp number updated", setting: setting });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Get all inquiries (Admin)
const getAllInquiries = async (req, res) => {
  try {
    const inquiries = await whatsappInquiryModel.find({});
    res.json({ success: true, inquiries: inquiries });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Update inquiry status (Admin)
const updateInquiryStatus = async (req, res) => {
  try {
    const { inquiryId, status } = req.body;

    const inquiry = await whatsappInquiryModel.findByIdAndUpdate(
      inquiryId,
      { status: status },
      { new: true }
    );

    if (!inquiry) {
      return res.json({ success: false, message: "Inquiry not found" });
    }

    res.json({ success: true, message: "Status updated", inquiry: inquiry });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

// Delete inquiry (Admin)
const deleteInquiry = async (req, res) => {
  try {
    const { inquiryId } = req.body;

    await whatsappInquiryModel.findByIdAndDelete(inquiryId);

    res.json({ success: true, message: "Inquiry deleted" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  logWhatsAppInquiry,
  getWhatsAppNumber,
  updateWhatsAppNumber,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
};