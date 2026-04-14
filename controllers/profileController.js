import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from "../config/cloudinary.js";
import { cleanTempFile } from "../middleware/upload.js";

// Get logged-in user profile
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    res.json({ success: true, user: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Upload Profile Image - CLOUDINARY
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const user = req.user;
    const userId = user.id || user._id;

    // Delete old image from Cloudinary if exists
    if (user.avatar && user.avatar.includes('cloudinary')) {
      const publicId = getPublicIdFromUrl(user.avatar);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }

    // Upload new image to Cloudinary
    const result = await uploadToCloudinary(req.file.path, 'rb-jewellery/profiles');

    // Clean temp file
    cleanTempFile(req.file.path);

    // Update user avatar
    await userModel.findByIdAndUpdate(userId, { avatar: result.url });

    res.json({ success: true, message: "Profile image uploaded", avatar: result.url });
  } catch (err) {
    cleanTempFile(req.file && req.file.path ? req.file.path : null);
    console.error('Upload image error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload image: ' + err.message });
  }
};

// Update profile info
export const updateProfile = async (req, res) => {
  try {
    const {
      name, email, phone, address, bio,
      linkedin, twitter, instagram,
      notifications
    } = req.body;

    const user = req.user;
    const userId = user.id || user._id;

    const updateData = {};
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (bio !== undefined) updateData.bio = bio;
    if (linkedin !== undefined) updateData.linkedin = linkedin;
    if (twitter !== undefined) updateData.twitter = twitter;
    if (instagram !== undefined) updateData.instagram = instagram;

    if (notifications) {
      const currentNotifications = user.notifications || { email: true, marketing: false, privacy: true };
      updateData.notifications = {
        email: notifications.email !== undefined ? notifications.email : currentNotifications.email,
        marketing: notifications.marketing !== undefined ? notifications.marketing : currentNotifications.marketing,
        privacy: notifications.privacy !== undefined ? notifications.privacy : currentNotifications.privacy
      };
    }

    // Calculate profile completion
    const fields = [
      user.avatar || updateData.avatar,
      updateData.name || user.name,
      updateData.email || user.email,
      updateData.phone || user.phone,
      updateData.address || user.address,
      updateData.bio || user.bio,
      updateData.linkedin || user.linkedin,
      updateData.twitter || user.twitter,
      updateData.instagram || user.instagram
    ];
    
    let filled = 0;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i] && fields[i] !== "") filled++;
    }
    
    updateData.profileCompletion = Math.round((filled / fields.length) * 100);

    const updatedUser = await userModel.findByIdAndUpdate(userId, updateData, { new: true });
    
    res.json({ success: true, message: "Profile updated", user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;
    const userId = user.id || user._id;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: "New password is required" });
    }

    if (user.password) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Old password incorrect" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordUpdatedAt: new Date()
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};