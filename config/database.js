// config/database.js
import mysql from 'mysql2/promise';

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
});

// Test connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected!');
    console.log('📊 Database:', process.env.DB_NAME);
    console.log('🖥️  Host:', process.env.DB_HOST);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    return false;
  }
};

// Initialize tables
export const initTables = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('📦 Creating database tables...');

    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT '',
        address TEXT,
        avatar VARCHAR(500) DEFAULT '',
        bio TEXT,
        role ENUM('user', 'admin') DEFAULT 'user',
        isVerified BOOLEAN DEFAULT FALSE,
        verificationToken VARCHAR(255),
        verificationTokenExpire DATETIME,
        resetPasswordToken VARCHAR(255),
        resetPasswordExpire DATETIME,
        linkedin VARCHAR(255) DEFAULT '',
        twitter VARCHAR(255) DEFAULT '',
        instagram VARCHAR(255) DEFAULT '',
        notifications JSON,
        lastLogin DATETIME,
        orders_count INT DEFAULT 0,
        profileCompletion INT DEFAULT 0,
        cartData JSON,
        passwordUpdatedAt DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Admins table
      `CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT 'Admin',
        role VARCHAR(50) DEFAULT 'admin',
        isActive BOOLEAN DEFAULT TRUE,
        lastLogin DATETIME,
        loginAttempts INT DEFAULT 0,
        lockUntil DATETIME,
        passwordChangedAt DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Products table
      `CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        longDescription JSON,
        price DECIMAL(10, 2) NOT NULL,
        comparePrice DECIMAL(10, 2) DEFAULT 0,
        images JSON,
        category ENUM('Ladies', 'Gents', 'Customize') NOT NULL,
        subCategory VARCHAR(100) NOT NULL,
        material VARCHAR(100) DEFAULT 'Artificial Gold Plated',
        sizes JSON,
        colors JSON,
        weight VARCHAR(50) DEFAULT '',
        stoneType VARCHAR(100) DEFAULT '',
        stoneColor VARCHAR(100) DEFAULT '',
        inStock BOOLEAN DEFAULT TRUE,
        stockQuantity INT DEFAULT 0,
        bestseller BOOLEAN DEFAULT FALSE,
        newArrival BOOLEAN DEFAULT FALSE,
        featured BOOLEAN DEFAULT FALSE,
        sku VARCHAR(100) DEFAULT '',
        rating DECIMAL(2,1) DEFAULT 0,
        reviews_count INT DEFAULT 0,
        date BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_bestseller (bestseller),
        INDEX idx_featured (featured)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ✅ Cart table - ADDED
      `CREATE TABLE IF NOT EXISTS cart (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        productId INT NOT NULL,
        quantity INT DEFAULT 1,
        size VARCHAR(50) DEFAULT 'defaultSize',
        color VARCHAR(50) DEFAULT 'defaultColor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (userId),
        INDEX idx_product (productId),
        UNIQUE KEY unique_cart_item (userId, productId, size, color)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Orders table
      `CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        items JSON NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        address JSON NOT NULL,
        status VARCHAR(50) DEFAULT 'Order Placed',
        paymentMethod VARCHAR(50) NOT NULL,
        payment BOOLEAN DEFAULT FALSE,
        paymentProof VARCHAR(500) DEFAULT '',
        paymentDetails JSON,
        paymentVerifiedAt DATETIME,
        adminNote TEXT,
        date BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_userId (userId),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Reviews table
      `CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        userId INT NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        rating INT NOT NULL,
        comment TEXT,
        images JSON,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_productId (productId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Newsletter table
      `CREATE TABLE IF NOT EXISTS newsletter (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) DEFAULT '',
        isActive BOOLEAN DEFAULT TRUE,
        subscribedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Custom orders table
      `CREATE TABLE IF NOT EXISTS custom_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        customerName VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(50) NOT NULL,
        customerWhatsApp VARCHAR(50) DEFAULT '',
        jewelleryType VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        referenceImages JSON,
        budgetMin DECIMAL(10,2) DEFAULT 0,
        budgetMax DECIMAL(10,2) DEFAULT 0,
        size VARCHAR(50) DEFAULT '',
        materialPreference VARCHAR(100) DEFAULT 'Artificial Gold Plated',
        requiredBy DATE,
        occasion VARCHAR(255) DEFAULT '',
        status VARCHAR(50) DEFAULT 'pending',
        adminQuote JSON,
        adminNote TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Returns table
      `CREATE TABLE IF NOT EXISTS returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        userId INT NOT NULL,
        productId INT NOT NULL,
        productDetails JSON NOT NULL,
        reason VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        proofImages JSON,
        shippingInfo JSON,
        status VARCHAR(50) DEFAULT 'pending',
        statusHistory JSON,
        refundMethod VARCHAR(50) DEFAULT 'easypaisa',
        refundDetails JSON,
        refundAmount DECIMAL(10,2) DEFAULT 0,
        refundTransactionId VARCHAR(255) DEFAULT '',
        refundDate DATETIME,
        adminNote TEXT,
        rejectionReason TEXT,
        returnAddress TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        type VARCHAR(100) NOT NULL,
        productId INT,
        meta JSON,
        ip VARCHAR(100) DEFAULT '',
        userAgent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // WhatsApp inquiries table
      `CREATE TABLE IF NOT EXISTS whatsapp_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        productId INT,
        productName VARCHAR(255) DEFAULT '',
        productPrice DECIMAL(10,2) DEFAULT 0,
        customerName VARCHAR(255) DEFAULT '',
        customerPhone VARCHAR(50) DEFAULT '',
        message TEXT,
        inquiryType VARCHAR(50) DEFAULT 'general',
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    // Execute all queries
    for (let i = 0; i < queries.length; i++) {
      await connection.query(queries[i]);
    }

    console.log('✅ All database tables created successfully!');
    connection.release();

    // Seed default admin
    await seedDefaultAdmin();

    // Seed default settings
    await seedDefaultSettings();

    return true;
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    return false;
  }
};

// Seed default admin
const seedDefaultAdmin = async () => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM admins');
    
    if (rows[0].count === 0) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.default.hash(process.env.Admin_PASSWORD || 'admin123', 12);
      
      await pool.query(
        'INSERT INTO admins (email, password, name, isActive) VALUES (?, ?, ?, ?)',
        [
          process.env.Admin_EMAIL || 'admin@rbjewellery.com',
          hashedPassword,
          'Admin',
          true
        ]
      );
      console.log('✅ Default admin created');
      console.log('📧 Email:', process.env.Admin_EMAIL || 'admin@rbjewellery.com');
    }
  } catch (error) {
    console.error('Admin seed error:', error.message);
  }
};

// Seed default settings
const seedDefaultSettings = async () => {
  try {
    const defaults = {
      whatsappNumber: process.env.WHATSAPP_NUMBER || '+923001234567',
      easypaisaNumber: process.env.EASYPAISA_NUMBER || '03001234567',
      easypaisaName: process.env.EASYPAISA_NAME || 'RB Jewellery',
      bankName: process.env.BANK_NAME || 'Meezan Bank',
      bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER || '1234567890',
      bankAccountTitle: process.env.BANK_ACCOUNT_TITLE || 'RB Jewellery',
      bankIBAN: process.env.BANK_IBAN || 'PK00MEZN0001234567890',
      deliveryCharges: parseInt(process.env.DELIVERY_CHARGES) || 250,
      freeDeliveryAbove: parseInt(process.env.FREE_DELIVERY_ABOVE) || 3000,
      currency: process.env.CURRENCY || 'Rs.',
      storeName: process.env.STORE_NAME || 'RB Jewellery',
      storeEmail: process.env.STORE_EMAIL || 'info@rbjewellery.com',
      storePhone: process.env.STORE_PHONE || '+923001234567',
      storeAddress: process.env.STORE_ADDRESS || 'Your Store Address'
    };

    for (const [key, value] of Object.entries(defaults)) {
      await pool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, JSON.stringify(value)]
      );
    }
    console.log('✅ Default settings initialized');
  } catch (error) {
    console.error('Settings seed error:', error.message);
  }
};

// Export pool as default
export default pool;