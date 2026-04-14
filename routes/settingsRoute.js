import express from 'express';
import {
  getAllSettings,
  getPublicSettings,
  updateSetting,
  updateMultipleSettings,
  initializeSettings,
  getSetting
} from '../controllers/settingsController.js';
import adminAuth from '../middleware/adminAuth.js';

const settingsRouter = express.Router();

// ==================== PUBLIC ROUTES ====================
// Get public settings (for checkout, WhatsApp, etc.)
settingsRouter.get('/public', getPublicSettings);

// Get single public setting
settingsRouter.get('/public/:key', getSetting);

// ==================== ADMIN ROUTES ====================
// Get all settings
settingsRouter.get('/all', adminAuth, getAllSettings);

// Get single setting
settingsRouter.get('/get/:key', adminAuth, getSetting);

// Update single setting
settingsRouter.post('/update', adminAuth, updateSetting);

// Update multiple settings
settingsRouter.post('/update-multiple', adminAuth, updateMultipleSettings);

// Initialize default settings
settingsRouter.post('/initialize', adminAuth, initializeSettings);

export default settingsRouter;