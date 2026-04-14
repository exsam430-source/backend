import Newsletter from "../models/Newsletter.js";
import validator from 'validator';

// Subscribe to newsletter
const subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Invalid email format" });
    }

    const existing = await Newsletter.findOne({ email: email.toLowerCase() });

    if (existing) {
      if (existing.isActive) {
        return res.json({ success: false, message: "Already subscribed" });
      }
      
      // Reactivate subscription
      await Newsletter.findOneAndUpdate(
        { email: email.toLowerCase() },
        { isActive: true, name: name || existing.name },
        { new: true }
      );
      
      return res.json({ success: true, message: "Subscription reactivated!" });
    }

    await Newsletter.create({
      email: email.toLowerCase(),
      name: name || '',
      isActive: true
    });

    res.json({ success: true, message: "Successfully subscribed to newsletter!" });
  } catch (error) {
    console.log('Newsletter subscribe error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Check if email is subscribed
const checkNewsletterEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.json({ success: false, subscribed: false });
    }

    const subscriber = await Newsletter.findOne({ 
      email: email.toLowerCase(),
      isActive: true
    });

    res.json({ 
      success: true, 
      subscribed: !!subscriber 
    });
  } catch (error) {
    console.log('Newsletter check error:', error);
    res.json({ success: false, subscribed: false });
  }
};

// Unsubscribe from newsletter
const unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.json({ success: false, message: "Email not found in subscription list" });
    }

    await Newsletter.findOneAndUpdate(
      { email: email.toLowerCase() },
      { isActive: false },
      { new: true }
    );

    res.json({ success: true, message: "Unsubscribed successfully" });
  } catch (error) {
    console.log('Newsletter unsubscribe error:', error);
    res.json({ success: false, message: error.message });
  }
};

// Get all subscribers (Admin)
const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find({});
    
    const activeCount = subscribers.filter(s => s.isActive).length;
    const inactiveCount = subscribers.filter(s => !s.isActive).length;

    res.json({ 
      success: true, 
      subscribers: subscribers,
      stats: {
        total: subscribers.length,
        active: activeCount,
        inactive: inactiveCount
      }
    });
  } catch (error) {
    console.log('Get subscribers error:', error);
    res.json({ success: false, message: error.message });
  }
};

export {
  subscribeNewsletter,
  checkNewsletterEmail,
  unsubscribeNewsletter,
  getAllSubscribers
};