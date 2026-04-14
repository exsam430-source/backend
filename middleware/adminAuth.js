import jwt from 'jsonwebtoken';
import adminModel from '../models/adminModel.js';

const adminAuth = async (req, res, next) => {
  try {
    // Get token from multiple sources
    var rawToken = null;
    
    if (req.headers.token) {
      rawToken = req.headers.token;
    } else if (req.headers.authorization) {
      var parts = req.headers.authorization.split(' ');
      if (parts.length === 2) {
        rawToken = parts[1];
      }
    } else if (req.body && req.body.token) {
      rawToken = req.body.token;
    }

    if (!rawToken) {
      console.warn('adminAuth: missing token');
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized - Token required' 
      });
    }

    var decoded = jwt.verify(rawToken, process.env.JWT_Secret);

    if (!decoded.isAdmin || decoded.role !== 'admin') {
      console.warn('adminAuth: Not an admin token');
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized - Admin access required' 
      });
    }

    // Verify admin still exists (MySQL)
    var admin = await adminModel.findById(decoded.id);
    
    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin account not found' 
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin account is deactivated' 
      });
    }

    if (admin.passwordChangedAt) {
      var tokenIssuedAt = decoded.iat * 1000;
      var passwordChangedTime = new Date(admin.passwordChangedAt).getTime();
      if (passwordChangedTime > tokenIssuedAt) {
        return res.status(401).json({ 
          success: false, 
          message: 'Password changed. Please login again.' 
        });
      }
    }

    req.admin = {
      id: admin.id ? admin.id : admin._id,
      _id: admin.id ? admin.id : admin._id,
      email: admin.email,
      name: admin.name,
      role: 'admin',
      isAdmin: true
    };

    next();
  } catch (error) {
    console.warn('adminAuth error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized - Invalid token' 
    });
  }
};

export default adminAuth;