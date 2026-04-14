import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const authUser = async (req, res, next) => {
  var token = null;

  // Get token from headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers.token) {
    token = req.headers.token;
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized. Please login.' 
    });
  }

  try {
    if (!process.env.JWT_Secret) {
      console.error('CRITICAL: JWT_Secret is not defined!');
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error.' 
      });
    }

    var decoded = jwt.verify(token, process.env.JWT_Secret);
    
    // Handle admin tokens
    if (decoded.isAdmin || decoded.role === 'admin') {
      req.user = {
        _id: 'admin',
        id: 'admin',
        isAdmin: true,
        email: decoded.email
      };
      if (!req.body) {
        req.body = {};
      }
      req.body.userId = 'admin';
      return next();
    }

    // Find user (MySQL)
    var user = await userModel.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    // Remove password from user object
    delete user.password;

    req.user = user;
    if (!req.body) {
      req.body = {};
    }
    req.body.userId = user.id ? user.id : user._id;

    next();
  } catch (error) {
    console.error('Auth Error:', error.name, '-', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. Please login again.',
        errorType: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired. Please login again.',
        errorType: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({ 
      success: false, 
      message: 'Authentication failed.' 
    });
  }
};

export default authUser;