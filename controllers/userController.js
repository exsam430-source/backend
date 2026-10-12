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
  // ✅ Try cPanel SMTP first
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    var smtpConfigs = [
      {
        name: 'cPanel SMTP 465 SSL',
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      },
      {
        name: 'cPanel SMTP 587 TLS',
        host: process.env.SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      },
      {
        name: 'cPanel SMTP 995',
        host: process.env.SMTP_HOST,
        port: 995,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      },
    ];

    for (var i = 0; i < smtpConfigs.length; i++) {
      var config = smtpConfigs[i];
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
        emailProvider = 'cpanel-smtp';
        console.log('✅ ' + config.name + ' - Email Ready!');
        console.log('📧 From:', process.env.SMTP_USER);
        return true;
      } catch (error) {
        console.log('❌ ' + config.name + ' failed:', error.message);
      }
    }
  }

  // ✅ Fallback to Gmail if cPanel fails
  if (process.env.GMAIL_USER && process.env.GMAIL_PASSWORD) {
    var gmailConfigs = [
      {
        name: 'Gmail Service',
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD,
        },
      },
      {
        name: 'Gmail SMTP 587',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      },
    ];

    for (var j = 0; j < gmailConfigs.length; j++) {
      var gmailConfig = gmailConfigs[j];
      try {
        console.log('Trying: ' + gmailConfig.name + '...');
        var gmailTransporter = nodemailer.createTransport(gmailConfig);

        await Promise.race([
          gmailTransporter.verify(),
          new Promise(function(resolve, reject) {
            setTimeout(function() {
              reject(new Error('Connection timeout'));
            }, 10000);
          })
        ]);

        transporter = gmailTransporter;
        emailReady = true;
        emailProvider = 'gmail';
        console.log('✅ ' + gmailConfig.name + ' - Email Ready!');
        return true;
      } catch (error) {
        console.log('❌ ' + gmailConfig.name + ' failed:', error.message);
      }
    }
  }

  console.log('⚠️ Email not configured - users will be auto-verified');
  emailReady = false;
  return false;
};

// Initialize after 2 seconds
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
    var fromName = process.env.SMTP_FROM_NAME || process.env.STORE_NAME || 'RB Jewellery';
    var fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER;

    var info = await transporter.sendMail({
      from: '"' + fromName + '" <' + fromEmail + '>',
      to: to,
      subject: subject,
      html: html,
    });

    console.log('✅ Email sent successfully!');
    console.log('📧 To:', to);
    console.log('🆔 Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);

    // ✅ Retry with other provider if first fails
    if (emailProvider === 'cpanel-smtp' && process.env.GMAIL_USER) {
      console.log('Retrying with Gmail...');
      try {
        var gmailFallback = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASSWORD,
          },
        });
        await gmailFallback.sendMail({
          from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
          to: to,
          subject: subject,
          html: html,
        });
        console.log('✅ Email sent via Gmail fallback!');
        return true;
      } catch (fallbackError) {
        console.error('❌ Gmail fallback also failed:', fallbackError.message);
      }
    }

    return false;
  }
};

// ==================== EMAIL TEMPLATES ====================
var getVerificationEmailHTML = function(verificationUrl, userName) {
  var name = userName || 'Valued Customer';
  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Verify Your Email</title></head>' +
    '<body style="margin:0;padding:0;font-family:Georgia,serif;background:#f4f4f4;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +

    // Header
    '<tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:40px;text-align:center;">' +
    '<h1 style="margin:0;color:#d4af37;font-size:28px;letter-spacing:2px;">RB JEWELLER\'S</h1>' +
    '<p style="margin:6px 0 0;color:#a0a0a0;font-size:12px;letter-spacing:4px;">RANA BROTHER\'S GOLD SMITH</p>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:40px 35px;">' +
    '<h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Welcome, ' + name + '! 🎉</h2>' +
    '<p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px;">' +
    'Thank you for registering with <strong>Rana Brother\'s Gold Smith</strong>. ' +
    'Please verify your email address to complete your registration and start shopping our premium gold-plated jewellery.' +
    '</p>' +

    // Button
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td align="center" style="padding:20px 0;">' +
    '<a href="' + verificationUrl + '" ' +
    'style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8960c);color:#1a1a1a;' +
    'padding:16px 48px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;' +
    'font-family:Arial,sans-serif;letter-spacing:1px;">' +
    'Verify My Email ✓' +
    '</a>' +
    '</td></tr></table>' +

    // Link fallback
    '<p style="color:#888;font-size:13px;margin:16px 0 0;line-height:1.6;">' +
    'If the button doesn\'t work, copy and paste this link:<br>' +
    '<a href="' + verificationUrl + '" style="color:#d4af37;word-break:break-all;">' + verificationUrl + '</a>' +
    '</p>' +

    // Warning
    '<div style="background:#f9f5e7;border-left:4px solid #d4af37;padding:14px 18px;margin:24px 0;border-radius:0 8px 8px 0;">' +
    '<p style="margin:0;color:#7a6a2a;font-size:13px;">⏰ This link expires in <strong>24 hours</strong>.</p>' +
    '</div>' +

    '</td></tr>' +

    // Footer
    '<tr><td style="background:#1a1a1a;padding:24px;text-align:center;">' +
    '<p style="margin:0;color:#d4af37;font-size:13px;font-weight:bold;">Rana Brother\'s Gold Smith</p>' +
    '<p style="margin:6px 0 0;color:#6b7280;font-size:12px;">Shop D184 Yasir Market, New Sarafa Bazaar, Rawalpindi</p>' +
    '<p style="margin:4px 0 0;color:#6b7280;font-size:12px;">📞 +92 319 7000727 | 🌐 rbjewellry.pk</p>' +
    '</td></tr>' +

    '</table></td></tr></table>' +
    '</body></html>';
};

var getResetPasswordEmailHTML = function(resetUrl, userName) {
  var name = userName || 'Valued Customer';
  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>Reset Your Password</title></head>' +
    '<body style="margin:0;padding:0;font-family:Georgia,serif;background:#f4f4f4;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px;">' +
    '<tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +

    // Header
    '<tr><td style="background:linear-gradient(135deg,#1a1a1a 0%,#2d2d2d 100%);padding:40px;text-align:center;">' +
    '<h1 style="margin:0;color:#d4af37;font-size:28px;letter-spacing:2px;">RB JEWELLER\'S</h1>' +
    '<p style="margin:6px 0 0;color:#a0a0a0;font-size:12px;letter-spacing:4px;">PASSWORD RESET REQUEST</p>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:40px 35px;">' +
    '<h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Hello, ' + name + '</h2>' +
    '<p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px;">' +
    'We received a request to reset your password for your <strong>Rana Brother\'s Gold Smith</strong> account. ' +
    'Click the button below to reset your password.' +
    '</p>' +

    // Button
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td align="center" style="padding:20px 0;">' +
    '<a href="' + resetUrl + '" ' +
    'style="display:inline-block;background:linear-gradient(135deg,#d4af37,#b8960c);color:#1a1a1a;' +
    'padding:16px 48px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;' +
    'font-family:Arial,sans-serif;letter-spacing:1px;">' +
    'Reset My Password 🔐' +
    '</a>' +
    '</td></tr></table>' +

    // Link fallback
    '<p style="color:#888;font-size:13px;margin:16px 0 0;line-height:1.6;">' +
    'If the button doesn\'t work, copy and paste this link:<br>' +
    '<a href="' + resetUrl + '" style="color:#d4af37;word-break:break-all;">' + resetUrl + '</a>' +
    '</p>' +

    // Warning
    '<div style="background:#fff3f3;border-left:4px solid #ef4444;padding:14px 18px;margin:24px 0;border-radius:0 8px 8px 0;">' +
    '<p style="margin:0;color:#dc2626;font-size:13px;">⚠️ This link expires in <strong>1 hour</strong>. ' +
    'If you didn\'t request this, please ignore this email.</p>' +
    '</div>' +

    '</td></tr>' +

    // Footer
    '<tr><td style="background:#1a1a1a;padding:24px;text-align:center;">' +
    '<p style="margin:0;color:#d4af37;font-size:13px;font-weight:bold;">Rana Brother\'s Gold Smith</p>' +
    '<p style="margin:6px 0 0;color:#6b7280;font-size:12px;">Shop D184 Yasir Market, New Sarafa Bazaar, Rawalpindi</p>' +
    '<p style="margin:4px 0 0;color:#6b7280;font-size:12px;">📞 +92 319 7000727 | 🌐 rbjewellry.pk</p>' +
    '</td></tr>' +

    '</table></td></tr></table>' +
    '</body></html>';
};

// ==================== HELPER FUNCTIONS ====================
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
    avatar: user.avatar || '',
  }, process.env.JWT_Secret, { expiresIn: '30d' });
};

var createAdminToken = function(admin) {
  var id = admin.id || admin._id;
  return jwt.sign({
    id: id,
    _id: id,
    email: admin.email,
    name: admin.name,
    role: 'admin',
    isAdmin: true,
  }, process.env.JWT_Secret, { expiresIn: '7d' });
};

// ==================== REGISTER USER ====================
var registerUser = async function(req, res) {
  try {
    var name     = req.body.name;
    var email    = req.body.email;
    var password = req.body.password;
    var phone    = req.body.phone;
    var address  = req.body.address;

    if (!name || !email || !password) {
      return res.json({ success: false, message: 'Name, email, and password are required' });
    }

    var existingAdmin = await adminModel.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.json({ success: false, message: 'This email is reserved for admin.' });
    }

    var exist = await userModel.findOne({ email: email.toLowerCase() });
    if (exist) {
      return res.json({ success: false, message: 'User already exists' });
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: 'Please enter a valid email' });
    }

    if (password.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters' });
    }

    var salt         = await bcrypt.genSalt(10);
    var hashPassword = await bcrypt.hash(password, salt);

    var verificationToken     = crypto.randomBytes(32).toString('hex');
    var verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    var userData = {
      name:                    name,
      email:                   email.toLowerCase(),
      password:                hashPassword,
      phone:                   phone || '',
      address:                 address || '',
      isVerified:              !emailReady,
      verificationToken:       emailReady ? verificationTokenHash : null,
      verificationTokenExpire: emailReady ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
    };

    var user = await userModel.create(userData);
    if (!user) {
      return res.json({ success: false, message: 'Failed to create user' });
    }

    // ✅ Send verification email
    if (emailReady) {
      var verificationUrl = process.env.FRONTEND_URL + '/verify-email?token=' + verificationToken;
      var emailSent = await sendEmail(
        email,
        'Verify Your Email - Welcome to Rana Brother\'s Gold Smith!',
        getVerificationEmailHTML(verificationUrl, name)
      );

      if (emailSent) {
        return res.json({
          success: true,
          message: 'Registration successful! Please check your email to verify your account.',
          requiresVerification: true,
          user: {
            _id:    user.id || user._id,
            name:   user.name,
            email:  user.email,
            avatar: user.avatar || '',
          },
        });
      }
    }

    // ✅ Auto-verify if email not ready
    var token = createToken(user);
    res.json({
      success: true,
      message: 'Account created successfully!',
      token:   token,
      requiresVerification: false,
      user: {
        _id:    user.id || user._id,
        name:   user.name,
        email:  user.email,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    console.log('Registration error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Registration failed') });
  }
};

// ==================== VERIFY EMAIL ====================
var verifyEmail = async function(req, res) {
  try {
    var token = req.body.token;
    if (!token) {
      return res.json({ success: false, message: 'Verification token is required' });
    }

    var tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    var user      = await userModel.findOne({ verificationToken: tokenHash });

    if (!user) {
      return res.json({ success: false, message: 'Invalid or expired verification token' });
    }

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      isVerified:              true,
      verificationToken:       null,
      verificationTokenExpire: null,
    });

    var updatedUser = await userModel.findById(userId);
    var authToken   = createToken(updatedUser);

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to RB Jeweller\'s!',
      token:   authToken,
      user: {
        _id:    updatedUser.id || updatedUser._id,
        name:   updatedUser.name,
        email:  updatedUser.email,
        avatar: updatedUser.avatar || '',
      },
    });
  } catch (error) {
    console.log('Email verification error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Email verification failed') });
  }
};

// ==================== LOGIN USER ====================
var loginUser = async function(req, res) {
  try {
    var email    = req.body.email;
    var password = req.body.password;

    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password are required' });
    }

    var isAdminEmail = await adminModel.findOne({ email: email.toLowerCase() });
    if (isAdminEmail) {
      return res.json({
        success:       false,
        message:       'Admin account detected',
        useAdminLogin: true,
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: false, message: 'User does not exist' });
    }

    var isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    if (emailReady && !user.isVerified) {
      return res.json({
        success:                false,
        message:                'Please verify your email first',
        requiresVerification:   true,
        email:                  user.email,
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
      message: 'Login Successful',
      token:   token,
      user: {
        _id:    userId,
        name:   user.name,
        email:  user.email,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    console.log('Login error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Login failed') });
  }
};

// ==================== FORGOT PASSWORD ====================
var forgotPassword = async function(req, res) {
  try {
    var email = req.body.email;
    if (!email) {
      return res.json({ success: false, message: 'Email is required' });
    }

    if (!emailReady) {
      return res.json({
        success: false,
        message: 'Password reset is currently unavailable. Please contact support at +92 310 2442743.',
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // ✅ Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent.',
      });
    }

    var resetToken     = crypto.randomBytes(32).toString('hex');
    var resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      resetPasswordToken:  resetTokenHash,
      resetPasswordExpire: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    var resetUrl  = process.env.FRONTEND_URL + '/reset-password?token=' + resetToken;
    var emailSent = await sendEmail(
      email,
      'Reset Your Password - Rana Brother\'s Gold Smith',
      getResetPasswordEmailHTML(resetUrl, user.name)
    );

    res.json({
      success: true,
      message: emailSent
        ? 'Password reset link sent to your email!'
        : 'If an account exists with this email, a reset link will be sent.',
    });
  } catch (error) {
    console.log('Forgot password error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Failed to process request') });
  }
};

// ==================== RESET PASSWORD ====================
var resetPassword = async function(req, res) {
  try {
    var token           = req.body.token;
    var password        = req.body.password;
    var confirmPassword = req.body.confirmPassword;

    if (!token || !password || !confirmPassword) {
      return res.json({ success: false, message: 'All fields are required' });
    }
    if (password !== confirmPassword) {
      return res.json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters' });
    }

    var tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    var user      = await userModel.findOne({ resetPasswordToken: tokenHash });

    if (!user) {
      return res.json({ success: false, message: 'Invalid or expired reset token' });
    }

    var salt           = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(password, salt);

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      password:            hashedPassword,
      resetPasswordToken:  null,
      resetPasswordExpire: null,
      passwordUpdatedAt:   new Date(),
    });

    res.json({ success: true, message: 'Password reset successfully! You can now login.' });
  } catch (error) {
    console.log('Reset password error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Password reset failed') });
  }
};

// ==================== GOOGLE LOGIN ====================
var googleLogin = async function(req, res) {
  try {
    var email        = req.body.email;
    var name         = req.body.name;
    var profileImage = req.body.profileImage;

    if (!email) {
      return res.json({ success: false, message: 'Email is required' });
    }

    var isAdminEmail = await adminModel.findOne({ email: email.toLowerCase() });
    if (isAdminEmail) {
      return res.json({ success: false, message: 'Admin cannot use Google Sign-In' });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      var randomPassword = crypto.randomBytes(16).toString('hex');
      var hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await userModel.create({
        name:       name || 'User',
        email:      email.toLowerCase(),
        avatar:     profileImage || '',
        isVerified: true,
        password:   hashedPassword,
        phone:      '',
        address:    '',
      });
    } else {
      var userId     = user.id || user._id;
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
      message: 'Google login successful',
      token:   token,
      user: {
        _id:    user.id || user._id,
        name:   user.name,
        email:  user.email,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    console.log('Google login error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Google login failed') });
  }
};

// ==================== ADMIN LOGIN ====================
var adminLogin = async function(req, res) {
  try {
    var email    = req.body.email;
    var password = req.body.password;

    if (!email || !password) {
      return res.json({ success: false, message: 'Email and password are required' });
    }

    var admin = await adminModel.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    if (admin.isLocked && admin.isLocked()) {
      var lockTime          = new Date(admin.lockUntil).getTime();
      var lockTimeRemaining = Math.ceil((lockTime - Date.now()) / 60000);
      return res.json({
        success: false,
        message: 'Account locked. Try again in ' + lockTimeRemaining + ' minutes.',
      });
    }

    if (!admin.isActive) {
      return res.json({ success: false, message: 'Admin account is deactivated' });
    }

    var isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      if (admin.incrementLoginAttempts) {
        await admin.incrementLoginAttempts();
      }
      var attempts     = (admin.loginAttempts || 0) + 1;
      var attemptsLeft = 5 - attempts;
      return res.json({
        success: false,
        message: attemptsLeft > 0
          ? 'Invalid credentials. ' + attemptsLeft + ' attempts remaining.'
          : 'Invalid credentials. Account will be locked.',
      });
    }

    if (admin.resetLoginAttempts) {
      await admin.resetLoginAttempts();
    }

    var token = createAdminToken(admin);
    res.json({
      success: true,
      token:   token,
      message: 'Admin login successful',
      admin: {
        _id:   admin.id || admin._id,
        email: admin.email,
        name:  admin.name,
        role:  'admin',
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Admin login failed') });
  }
};

// ==================== ADMIN CHANGE PASSWORD ====================
var adminChangePassword = async function(req, res) {
  try {
    var currentPassword = req.body.currentPassword;
    var newPassword     = req.body.newPassword;
    var confirmPassword = req.body.confirmPassword;
    var adminId         = req.admin.id || req.admin._id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'New passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.json({ success: false, message: 'Password must be at least 8 characters' });
    }

    var admin = await adminModel.findById(adminId);
    if (!admin) {
      return res.json({ success: false, message: 'Admin not found' });
    }

    var isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.json({ success: false, message: 'Current password is incorrect' });
    }

    var salt           = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(newPassword, salt);

    await adminModel.findByIdAndUpdate(adminId, {
      password:          hashedPassword,
      passwordChangedAt: new Date(),
    });

    res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Admin change password error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Password change failed') });
  }
};

// ==================== GET ADMIN PROFILE ====================
var getAdminProfile = async function(req, res) {
  try {
    var adminId = req.admin.id || req.admin._id;
    var admin   = await adminModel.findById(adminId);

    if (!admin) {
      return res.json({ success: false, message: 'Admin not found' });
    }

    res.json({
      success: true,
      admin: {
        _id:       admin.id || admin._id,
        email:     admin.email,
        name:      admin.name,
        role:      admin.role || 'admin',
        lastLogin: admin.lastLogin,
        createdAt: admin.created_at,
      },
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Failed to get profile') });
  }
};

// ==================== CHECK IF ADMIN EXISTS ====================
var checkAdminExists = async function(req, res) {
  try {
    var adminCount = await adminModel.countDocuments();
    res.json({
      success:     true,
      adminExists: adminCount > 0,
      message:     adminCount > 0 ? 'Admin is set up' : 'No admin exists',
    });
  } catch (error) {
    res.json({ success: false, message: getErrorMessage(error, 'Check failed') });
  }
};

// ==================== RESEND VERIFICATION ====================
var resendVerificationEmail = async function(req, res) {
  try {
    var email = req.body.email;
    if (!email) {
      return res.json({ success: false, message: 'Email is required' });
    }

    if (!emailReady) {
      return res.json({
        success: false,
        message: 'Email service is currently unavailable.',
      });
    }

    var user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    if (user.isVerified) {
      return res.json({ success: false, message: 'Email already verified' });
    }

    var verificationToken     = crypto.randomBytes(32).toString('hex');
    var verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');

    var userId = user.id || user._id;
    await userModel.findByIdAndUpdate(userId, {
      verificationToken:       verificationTokenHash,
      verificationTokenExpire: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    var verificationUrl = process.env.FRONTEND_URL + '/verify-email?token=' + verificationToken;
    var emailSent = await sendEmail(
      email,
      'Verify Your Email - Rana Brother\'s Gold Smith',
      getVerificationEmailHTML(verificationUrl, user.name)
    );

    res.json({
      success: emailSent,
      message: emailSent ? 'Verification email sent!' : 'Failed to send email. Please try again.',
    });
  } catch (error) {
    console.log('Resend verification error:', error);
    res.json({ success: false, message: getErrorMessage(error, 'Failed to resend verification') });
  }
};

// ==================== CHECK EMAIL STATUS ====================
var checkEmailStatus = async function(req, res) {
  res.json({
    success:         true,
    emailConfigured: emailReady,
    provider:        emailProvider,
    message:         emailReady
      ? '✅ Email working via ' + emailProvider
      : '⚠️ Email not configured',
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
  checkEmailStatus,
};