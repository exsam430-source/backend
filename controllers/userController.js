import validator from 'validator';
import userModel from "../models/userModel.js";
import adminModel from "../models/adminModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// ==================== EMAIL SETUP ====================
var transporter = null;
var emailReady = false;
var emailProvider = 'none';

var initializeEmailTransporter = async function() {
  if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
    var gmailConfigs = [
      {
        name: 'Gmail Service',
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD
        }
      },
      {
        name: 'Gmail SMTP 587',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD
        },
        tls: { rejectUnauthorized: false }
      },
      {
        name: 'Gmail SMTP 465',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD
        }
      }
    ];

    for (var i = 0; i < gmailConfigs.length; i++) {
      var config = gmailConfigs[i];
      try {
        console.log('Trying: ' + config.name + '...');
        var testTransporter = nodemailer.createTransport(config);

        await Promise.race([
          testTransporter.verify(),
          new Promise(function(resolve, reject) {
            setTimeout(function() {
              reject(new Error('Connection timeout'));
            }, 10000);
          })
        ]);

        transporter = testTransporter;
        emailReady = true;
        emailProvider = 'gmail';
        console.log(config.name + ' - Email Ready!');
        return true;
      } catch (error) {
        console.log(config.name + ' failed:', error.message);
      }
    }
  }

  console.log('Email not configured - users will be auto-verified');
  emailReady = false;
  return false;
};

setTimeout(function() {
  initializeEmailTransporter();
}, 2000);

// ==================== SEND EMAIL HELPER ====================
var sendEmail = async function(to, subject, html) {
  if (!emailReady || !transporter) {
    console.log('Email skipped - service not ready');
    return false;
  }

  try {
    var info = await transporter.sendMail({
      from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
      to: to,
      subject: subject,
      html: html
    });

    console.log('Email sent successfully!');
    console.log('To:', to);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return false;
  }
};

// ==================== EMAIL TEMPLATES ====================
var getVerificationEmailHTML = function(verificationUrl) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"><tr><td style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 50%, #d4af37 100%); padding: 40px; text-align: center;"><h1 style="margin: 0; color: #1a1a1a; font-size: 28px;">Welcome to RB Jewellery!</h1><p style="margin: 10px 0 0; color: #333; font-size: 14px;">Verify your email to get started</p></td></tr><tr><td style="padding: 40px 30px;"><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Hello,<br><br>Thank you for registering with <strong>RB Jewellery</strong>! Please verify your email address by clicking the button below:</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;"><a href="' + verificationUrl + '" style="background: linear-gradient(135deg, #d4af37 0%, #b8963c 100%); color: #1a1a1a; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Verify Email Address</a></td></tr></table><p style="color: #666; font-size: 13px; margin-top: 25px; line-height: 1.5;">Or copy and paste this link into your browser:<br><a href="' + verificationUrl + '" style="color: #d4af37; word-break: break-all;">' + verificationUrl + '</a></p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="color: #999; font-size: 12px; text-align: center; margin: 0;">This link expires in 24 hours.</p></td></tr></table></td></tr></table></body></html>';
};

var getResetPasswordEmailHTML = function(resetUrl) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"><tr><td style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 40px; text-align: center;"><h1 style="margin: 0; color: #d4af37; font-size: 28px;">Password Reset</h1></td></tr><tr><td style="padding: 40px 30px;"><p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Hello,<br><br>We received a request to reset your password. Click the button below:</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding: 20px 0;"><a href="' + resetUrl + '" style="background: linear-gradient(135deg, #d4af37 0%, #b8963c 100%); color: #1a1a1a; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Reset Password</a></td></tr></table><p style="color: #666; font-size: 13px; margin-top: 25px; line-height: 1.5;">Or copy this link:<br><a href="' + resetUrl + '" style="color: #d4af37; word-break: break-all;">' + resetUrl + '</a></p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="color: #999; font-size: 12px; text-align: center; margin: 0;">This link expires in 1 hour.</p></td></tr></table></td></tr></table></body></html>';
};

// ==================== HELPER FUNCTION ====================
var getErrorMessage = function(error, fallback) {
  if (!fallback) fallback = 'An error occurred';
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  return fallback;
};

// ==================== TOKEN CREATION ====================
var createToken = function(user) {
  var id = user.id || user._id;
  return jwt.sign({
    id: id,
    _id: id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || ""
  }, process.env.JWT_Secret, { expiresIn: "30d" });
};

var createAdminToken = function(admin) {
  var id = admin.id || admin._id;
  return jwt.sign({
    id: id,
    _id: id,
    email: admin.email,
    name: admin.name,
    role: 'admin',
    isAdmin: true
  }, process.env.JWT_Secret, { expiresIn: "7d" });
};

// ==================== REGISTER USER ====================
var registerUser = async function(req, res) {
  try {
    var name = req.body.name;
    var email = req.body.email;
    var password = req.body.password;
    var phone = req.body.phone;
    var address = req.body.address;

    // Validate inputs
    if (!name || !email || !password) {
      return res.json({ success: false, message: "Name, email, and password are required" });
    }

    // Check admin email
    var existingAdmin = await adminModel.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.json({ success: false, message: "This email is reserved for admin." });
    }

    var exist = await userModel.findOne({ email: email.toLowerCase() });
    if (exist) {
      return res.json({ success: false, message: "User already exists" });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter a valid email" });
    }

    if (password.length < 8) {
      return res.json({ success: false, message: "Password must be at least 8 characters" });
    }

    // Hash password ONCE here
    var salt = await bcrypt.genSalt(10);
    var hashPassword = await bcrypt.hash(password, salt);

    var verificationToken = crypto.randomBytes(32).toString('hex');
    var verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    var userData = {
      name: name,
      email: email.toLowerCase(),
      password: hashPassword,
      phone: phone || '',
      address: address || '',
      isVerified: !emailReady,
      verificationToken: emailReady ? verificationTokenHash : null,
      verificationTokenExpire: emailReady ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
    };

    var user = await userModel.create(userData);

    if (!user) {
      return res.json({ success: false, message: "Failed to create user" });
    }

    if (emailReady) {
      var verificationUrl = process.env.FRONTEND_URL + '/verify-email?token=' + verificationToken;
      var emailSent = await sendEmail(
        email,
        'Verify Your Email - Welcome to RB Jewellery!',
        getVerificationEmailHTML(verificationUrl)
      );

      if (emailSent) {
        return res.json({
          success: true,
          message: "Registration successful! Check your email to verify your account.",
          requiresVerification: true,
          user: {
            _id: user.id || user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar || ""
          }
        });
      }
    }

    var token = createToken(user);
    res.json({
      success: true,
      message: "Account created successfully!",
      token: token,
      requiresVerification: false,
      user: {
        _id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || ""
      }
    });
  } catch (error) {
    console.log('Registration error:', error);
    var errorMsg = getErrorMessage(error, 'Registration failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== VERIFY EMAIL ====================
var verifyEmail = async function(req, res) {
  try {
    var token = req.body.token;

    if (!token) {
      return res.json({ success: false, message: "Verification token is required" });
    }

    var tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    var user = await userModel.findOne({
      verificationToken: tokenHash
    });

    if (!user) {
      return res.json({ success: false, message: "Invalid or expired verification token" });
    }

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpire: null
    });

    var updatedUser = await userModel.findById(userId);
    var authToken = createToken(updatedUser);

    res.json({
      success: true,
      message: "Email verified successfully!",
      token: authToken,
      user: {
        _id: updatedUser.id || updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar || ""
      }
    });
  } catch (error) {
    console.log('Email verification error:', error);
    var errorMsg = getErrorMessage(error, 'Email verification failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== LOGIN USER ====================
var loginUser = async function(req, res) {
  try {
    var email = req.body.email;
    var password = req.body.password;

    if (!email || !password) {
      return res.json({ success: false, message: "Email and password are required" });
    }

    // Check admin
    var isAdminEmail = await adminModel.findOne({ email: email.toLowerCase() });
    if (isAdminEmail) {
      return res.json({
        success: false,
        message: "Admin account detected",
        useAdminLogin: true
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: false, message: "User does not exist" });
    }

    var isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid email or password" });
    }

    if (emailReady && !user.isVerified) {
      return res.json({
        success: false,
        message: "Please verify your email first",
        requiresVerification: true,
        email: user.email
      });
    }

    var userId = user.id || user._id;

    if (!emailReady && !user.isVerified) {
      await userModel.findByIdAndUpdate(userId, { isVerified: true });
    }

    await userModel.findByIdAndUpdate(userId, { lastLogin: new Date() });

    var token = createToken(user);

    res.json({
      success: true,
      message: "Login Successful",
      token: token,
      user: {
        _id: userId,
        name: user.name,
        email: user.email,
        avatar: user.avatar || ""
      }
    });
  } catch (error) {
    console.log("Login error:", error);
    var errorMsg = getErrorMessage(error, 'Login failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== FORGOT PASSWORD ====================
var forgotPassword = async function(req, res) {
  try {
    var email = req.body.email;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    if (!emailReady) {
      return res.json({
        success: false,
        message: "Password reset is currently unavailable. Please contact support."
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists with this email, a reset link will be sent."
      });
    }

    var resetToken = crypto.randomBytes(32).toString('hex');
    var resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      resetPasswordToken: resetTokenHash,
      resetPasswordExpire: new Date(Date.now() + 60 * 60 * 1000)
    });

    var resetUrl = process.env.FRONTEND_URL + '/reset-password?token=' + resetToken;
    var emailSent = await sendEmail(
      email,
      'Reset Your Password - RB Jewellery',
      getResetPasswordEmailHTML(resetUrl)
    );

    var message = emailSent
      ? "Password reset link sent to your email"
      : "If an account exists with this email, a reset link will be sent.";

    res.json({
      success: true,
      message: message
    });
  } catch (error) {
    console.log('Forgot password error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to process request');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== RESET PASSWORD ====================
var resetPassword = async function(req, res) {
  try {
    var token = req.body.token;
    var password = req.body.password;
    var confirmPassword = req.body.confirmPassword;

    if (!token || !password || !confirmPassword) {
      return res.json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.json({ success: false, message: "Passwords do not match" });
    }

    if (password.length < 8) {
      return res.json({ success: false, message: "Password must be at least 8 characters" });
    }

    var tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    var user = await userModel.findOne({
      resetPasswordToken: tokenHash
    });

    if (!user) {
      return res.json({ success: false, message: "Invalid or expired reset token" });
    }

    var salt = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(password, salt);

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpire: null,
      passwordUpdatedAt: new Date()
    });

    res.json({
      success: true,
      message: "Password reset successfully!"
    });
  } catch (error) {
    console.log('Reset password error:', error);
    var errorMsg = getErrorMessage(error, 'Password reset failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== GOOGLE LOGIN ====================
var googleLogin = async function(req, res) {
  try {
    var email = req.body.email;
    var name = req.body.name;
    var profileImage = req.body.profileImage;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    var isAdminEmail = await adminModel.findOne({ email: email.toLowerCase() });
    if (isAdminEmail) {
      return res.json({ success: false, message: "Admin cannot use Google Sign-In" });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      var randomPassword = crypto.randomBytes(16).toString('hex');
      var hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await userModel.create({
        name: name || "User",
        email: email.toLowerCase(),
        avatar: profileImage || "",
        isVerified: true,
        password: hashedPassword,
        phone: '',
        address: ""
      });
    } else {
      var userId = user.id || user._id;
      var updateData = { lastLogin: new Date() };
      if (!user.avatar && profileImage) {
        updateData.avatar = profileImage;
      }
      await userModel.findByIdAndUpdate(userId, updateData);
      user = await userModel.findById(userId);
    }

    var token = createToken(user);

    res.json({
      success: true,
      message: "Google login successful",
      token: token,
      user: {
        _id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || ""
      }
    });
  } catch (error) {
    console.log('Google login error:', error);
    var errorMsg = getErrorMessage(error, 'Google login failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== ADMIN LOGIN ====================
var adminLogin = async function(req, res) {
  try {
    var email = req.body.email;
    var password = req.body.password;

    if (!email || !password) {
      return res.json({ success: false, message: "Email and password are required" });
    }

    var admin = await adminModel.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    if (admin.isLocked && admin.isLocked()) {
      var lockTime = new Date(admin.lockUntil).getTime();
      var now = Date.now();
      var lockTimeRemaining = Math.ceil((lockTime - now) / 60000);
      return res.json({
        success: false,
        message: 'Account locked. Try again in ' + lockTimeRemaining + ' minutes.'
      });
    }

    if (!admin.isActive) {
      return res.json({ success: false, message: "Admin account is deactivated" });
    }

    var isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      if (admin.incrementLoginAttempts) {
        await admin.incrementLoginAttempts();
      }

      var attempts = (admin.loginAttempts || 0) + 1;
      var attemptsLeft = 5 - attempts;

      var message = attemptsLeft > 0
        ? 'Invalid credentials. ' + attemptsLeft + ' attempts remaining.'
        : "Invalid credentials. Account will be locked.";

      return res.json({
        success: false,
        message: message
      });
    }

    if (admin.resetLoginAttempts) {
      await admin.resetLoginAttempts();
    }

    var token = createAdminToken(admin);

    res.json({
      success: true,
      token: token,
      message: "Admin login successful",
      admin: {
        _id: admin.id || admin._id,
        email: admin.email,
        name: admin.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    var errorMsg = getErrorMessage(error, 'Admin login failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== ADMIN CHANGE PASSWORD ====================
var adminChangePassword = async function(req, res) {
  try {
    var currentPassword = req.body.currentPassword;
    var newPassword = req.body.newPassword;
    var confirmPassword = req.body.confirmPassword;
    var adminId = req.admin.id || req.admin._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: "New passwords do not match" });
    }

    if (newPassword.length < 8) {
      return res.json({ success: false, message: "Password must be at least 8 characters" });
    }

    var admin = await adminModel.findById(adminId);
    if (!admin) {
      return res.json({ success: false, message: "Admin not found" });
    }

    var isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.json({ success: false, message: "Current password is incorrect" });
    }

    var salt = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(newPassword, salt);

    await adminModel.findByIdAndUpdate(adminId, {
      password: hashedPassword,
      passwordChangedAt: new Date()
    });

    res.json({
      success: true,
      message: "Password changed successfully!"
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    var errorMsg = getErrorMessage(error, 'Password change failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== GET ADMIN PROFILE ====================
var getAdminProfile = async function(req, res) {
  try {
    var adminId = req.admin.id || req.admin._id;

    var admin = await adminModel.findById(adminId);

    if (!admin) {
      return res.json({ success: false, message: "Admin not found" });
    }

    res.json({
      success: true,
      admin: {
        _id: admin.id || admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role || 'admin',
        lastLogin: admin.lastLogin,
        createdAt: admin.created_at
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to get profile');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== CHECK IF ADMIN EXISTS ====================
var checkAdminExists = async function(req, res) {
  try {
    var adminCount = await adminModel.countDocuments();
    res.json({
      success: true,
      adminExists: adminCount > 0,
      message: adminCount > 0 ? "Admin is set up" : "No admin exists - run seed script"
    });
  } catch (error) {
    var errorMsg = getErrorMessage(error, 'Check failed');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== RESEND VERIFICATION ====================
var resendVerificationEmail = async function(req, res) {
  try {
    var email = req.body.email;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    if (!emailReady) {
      return res.json({
        success: false,
        message: "Email service is currently unavailable."
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.json({ success: false, message: "Email already verified" });
    }

    var verificationToken = crypto.randomBytes(32).toString('hex');
    var verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      verificationToken: verificationTokenHash,
      verificationTokenExpire: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    var verificationUrl = process.env.FRONTEND_URL + '/verify-email?token=' + verificationToken;
    var emailSent = await sendEmail(
      email,
      'Verify Your Email - RB Jewellery',
      getVerificationEmailHTML(verificationUrl)
    );

    res.json({
      success: emailSent,
      message: emailSent ? "Verification email sent!" : "Failed to send email."
    });
  } catch (error) {
    console.log('Resend verification error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to resend verification');
    res.json({ success: false, message: errorMsg });
  }
};

// ==================== CHECK EMAIL STATUS ====================
var checkEmailStatus = async function(req, res) {
  var message = emailReady ? 'Email working via ' + emailProvider : "Email not configured";
  res.json({
    success: true,
    emailConfigured: emailReady,
    provider: emailProvider,
    message: message
  });
};

export {
  loginUser,
  registerUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleLogin,
  adminLogin,
  adminChangePassword,
  getAdminProfile,
  checkAdminExists,
  resendVerificationEmail,
  checkEmailStatus
};