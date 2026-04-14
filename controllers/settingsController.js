import settingsModel from "../models/settingsModel.js";

// Get all settings (Admin)
const getAllSettings = async (req, res) => {
  try {
    console.log('=== GET ALL SETTINGS ===');
    
    const settings = await settingsModel.find({});
    
    console.log('Found settings:', settings.length);

    const settingsObj = {};
    for (let i = 0; i < settings.length; i++) {
      settingsObj[settings[i].key] = settings[i].value;
    }

    console.log('Settings object:', Object.keys(settingsObj));

    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('getAllSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get public settings (for frontend)
const getPublicSettings = async (req, res) => {
  try {
    console.log('=== GET PUBLIC SETTINGS ===');
    
    const publicKeys = [
      'whatsappNumber',
      'easypaisaNumber',
      'easypaisaName',
      'bankName',
      'bankAccountNumber',
      'bankAccountTitle',
      'bankIBAN',
      'deliveryCharges',
      'freeDeliveryAbove',
      'currency',
      'storeName',
      'storePhone',
      'storeEmail',
      'storeAddress'
    ];

    const settings = await settingsModel.find({ key: { $in: publicKeys } });

    console.log('Found public settings:', settings.length);

    const settingsObj = {};
    for (let i = 0; i < settings.length; i++) {
      settingsObj[settings[i].key] = settings[i].value;
    }

    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('getPublicSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update single setting (Admin)
const updateSetting = async (req, res) => {
  try {
    console.log('=== UPDATE SETTING ===');
    console.log('Body:', req.body);
    
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, message: "Setting key is required" });
    }

    const setting = await settingsModel.findOneAndUpdate(
      { key: key },
      { value: value },
      { upsert: true, new: true }
    );

    console.log('Setting updated:', key, '=', value);

    res.json({ success: true, message: "Setting updated", setting: setting });
  } catch (error) {
    console.error('updateSetting error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update multiple settings (Admin)
const updateMultipleSettings = async (req, res) => {
  try {
    console.log('=== UPDATE MULTIPLE SETTINGS ===');
    console.log('Body:', req.body);
    
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: "Settings object is required" });
    }

    const keys = Object.keys(settings);
    console.log('Settings to update:', keys);

    // Method 1: Use bulkWrite
    const operations = [];
    for (const key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        const value = settings[key];
        
        // Skip empty keys
        if (!key || key.trim() === '') continue;
        
        operations.push({
          updateOne: {
            filter: { key: key },
            update: { value: value },
            upsert: true
          }
        });
      }
    }

    if (operations.length === 0) {
      return res.status(400).json({ success: false, message: "No valid settings to update" });
    }

    console.log('Operations to execute:', operations.length);

    const result = await settingsModel.bulkWrite(operations);

    console.log('Bulk write result:', result);

    // Fetch updated settings to return
    const updatedSettings = await settingsModel.getAllAsObject();

    res.json({ 
      success: true, 
      message: `${operations.length} settings updated successfully`,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('updateMultipleSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Initialize default settings
const initializeSettings = async (req, res) => {
  try {
    console.log('=== INITIALIZE SETTINGS ===');
    
    const defaults = {
      whatsappNumber: "+923001234567",
      easypaisaNumber: "03001234567",
      easypaisaName: "RB Jewellery",
      bankName: "HBL",
      bankAccountNumber: "1234567890",
      bankAccountTitle: "RB Jewellery",
      bankIBAN: "PK00HABB0001234567890",
      deliveryCharges: "200",
      freeDeliveryAbove: "5000",
      currency: "Rs.",
      storeName: "RB Jewellery",
      storeEmail: "info@rbjewellery.com",
      storePhone: "+923001234567",
      storeAddress: "Your Store Address"
    };

    let initialized = 0;
    
    for (const key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        try {
          await settingsModel.findOneAndUpdate(
            { key: key },
            { value: defaults[key] },
            { upsert: true, new: true }
          );
          initialized++;
          console.log('Initialized:', key);
        } catch (err) {
          console.error('Failed to initialize:', key, err.message);
        }
      }
    }

    console.log('Initialized', initialized, 'settings');

    res.json({ 
      success: true, 
      message: `${initialized} default settings initialized` 
    });
  } catch (error) {
    console.error('initializeSettings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single setting value
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({ success: false, message: "Setting key is required" });
    }

    const value = await settingsModel.get(key);

    res.json({ success: true, key: key, value: value });
  } catch (error) {
    console.error('getSetting error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getAllSettings,
  getPublicSettings,
  updateSetting,
  updateMultipleSettings,
  initializeSettings,
  getSetting
};