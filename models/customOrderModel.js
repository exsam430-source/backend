import pool from '../config/database.js';

var customOrderModel = {
  // Safe JSON parsing helper
  _parseJSON: function(value, fallback) {
    if (fallback === undefined) fallback = {};
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return fallback;
    }
  },

  // Convert userId to consistent format
  _normalizeUserId: function(userId) {
    if (!userId) return null;
    if (userId === 'admin') return null;
    
    // If it's a number or numeric string, return as number
    if (typeof userId === 'number') return userId;
    if (typeof userId === 'string' && /^\d+$/.test(userId)) {
      return parseInt(userId, 10);
    }
    
    // Return as string for MongoDB-style IDs
    return String(userId);
  },

  // Create custom order
  create: async function(data) {
    try {
      var userId = this._normalizeUserId(data.userId);
      var customerName = data.customerName || '';
      var customerEmail = data.customerEmail || '';
      var customerPhone = data.customerPhone || '';
      var customerWhatsApp = data.customerWhatsApp || data.customerPhone || '';
      var jewelleryType = data.jewelleryType || '';
      var description = data.description || '';
      var referenceImages = data.referenceImages || [];
      var budgetMin = Number(data.budgetMin) || 0;
      var budgetMax = Number(data.budgetMax) || 0;
      var size = data.size || '';
      var materialPreference = data.materialPreference || 'Artificial Gold Plated';
      var requiredBy = data.requiredBy || null;
      var occasion = data.occasion || '';
      var status = data.status || 'pending';

      var referenceImagesStr = typeof referenceImages === 'string' 
        ? referenceImages 
        : JSON.stringify(referenceImages);
      var adminQuoteStr = JSON.stringify({ price: 0, estimatedDays: 0, notes: '' });

      console.log('Creating custom order for userId:', userId, 'Type:', typeof userId);

      var result = await pool.query(
        `INSERT INTO custom_orders (
          userId, customerName, customerEmail, customerPhone, customerWhatsApp, 
          jewelleryType, description, referenceImages, budgetMin, budgetMax, 
          size, materialPreference, requiredBy, occasion, status, 
          adminQuote, adminNote, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          customerName,
          customerEmail,
          customerPhone,
          customerWhatsApp,
          jewelleryType,
          description,
          referenceImagesStr,
          budgetMin,
          budgetMax,
          size,
          materialPreference,
          requiredBy,
          occasion,
          status,
          adminQuoteStr,
          ''
        ]
      );

      var insertId = result[0].insertId;
      console.log('Custom order created with ID:', insertId);
      
      return this.findById(insertId);
    } catch (error) {
      console.error('Create custom order error:', error);
      throw error;
    }
  },

  // Find by ID
  findById: async function(id) {
    try {
      if (!id) return null;
      
      var result = await pool.query('SELECT * FROM custom_orders WHERE id = ?', [id]);
      var rows = result[0];

      if (rows && rows[0]) {
        var row = rows[0];
        row._id = row.id;
        row.referenceImages = this._parseJSON(row.referenceImages, []);
        row.adminQuote = this._parseJSON(row.adminQuote, { price: 0, estimatedDays: 0, notes: '' });
        return row;
      }
      return null;
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  },

  // Find with query - FIXED
  find: async function(query) {
    if (!query) query = {};

    try {
      var sql = 'SELECT * FROM custom_orders WHERE 1=1';
      var params = [];

      // Handle userId query - support both number and string
      if (query.userId !== undefined && query.userId !== null && query.userId !== 'admin') {
        var normalizedUserId = this._normalizeUserId(query.userId);
        
        if (normalizedUserId !== null) {
          // Check if column is INT or VARCHAR and handle accordingly
          if (typeof normalizedUserId === 'number') {
            sql += ' AND (userId = ? OR userId = ?)';
            params.push(normalizedUserId);
            params.push(String(normalizedUserId));
          } else {
            sql += ' AND userId = ?';
            params.push(normalizedUserId);
          }
          
          console.log('Query userId:', normalizedUserId, 'Type:', typeof normalizedUserId);
        }
      }

      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }

      if (query.customerEmail) {
        sql += ' AND customerEmail = ?';
        params.push(query.customerEmail);
      }

      sql += ' ORDER BY created_at DESC';

      console.log('Executing SQL:', sql);
      console.log('With params:', params);

      var result = await pool.query(sql, params);
      var rows = result[0];
      var self = this;

      console.log('Found rows:', rows.length);

      var orders = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        row._id = row.id;
        row.referenceImages = self._parseJSON(row.referenceImages, []);
        row.adminQuote = self._parseJSON(row.adminQuote, { price: 0, estimatedDays: 0, notes: '' });
        orders.push(row);
      }

      return orders;
    } catch (error) {
      console.error('find error:', error);
      return [];
    }
  },

  // Find one
  findOne: async function(query) {
    try {
      var results = await this.find(query);
      return results[0] || null;
    } catch (error) {
      console.error('findOne error:', error);
      return null;
    }
  },

  // Find by ID and update
  findByIdAndUpdate: async function(id, data, options) {
    if (!options) options = {};

    try {
      var fields = [];
      var values = [];
      var key;
      var value;

      var jsonFields = ['referenceImages', 'adminQuote'];

      for (key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          value = data[key];

          if (value !== undefined && key !== 'id' && key !== '_id') {
            if (jsonFields.indexOf(key) !== -1) {
              fields.push(key + ' = ?');
              if (typeof value === 'string') {
                values.push(value);
              } else {
                values.push(JSON.stringify(value));
              }
            } else {
              fields.push(key + ' = ?');
              values.push(value);
            }
          }
        }
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      var sql = 'UPDATE custom_orders SET ' + fields.join(', ') + ' WHERE id = ?';
      
      console.log('Update SQL:', sql);
      await pool.query(sql, values);

      return this.findById(id);
    } catch (error) {
      console.error('findByIdAndUpdate error:', error);
      return null;
    }
  },

  // Find by ID and delete
  findByIdAndDelete: async function(id) {
    try {
      var order = await this.findById(id);
      if (order) {
        await pool.query('DELETE FROM custom_orders WHERE id = ?', [id]);
      }
      return order;
    } catch (error) {
      console.error('findByIdAndDelete error:', error);
      return null;
    }
  },

  // Count documents
  countDocuments: async function(query) {
    if (!query) query = {};

    try {
      var sql = 'SELECT COUNT(*) as count FROM custom_orders';
      var params = [];
      var conditions = [];

      if (query.status) {
        conditions.push('status = ?');
        params.push(query.status);
      }
      
      if (query.userId !== undefined && query.userId !== null && query.userId !== 'admin') {
        var normalizedUserId = this._normalizeUserId(query.userId);
        if (normalizedUserId !== null) {
          if (typeof normalizedUserId === 'number') {
            conditions.push('(userId = ? OR userId = ?)');
            params.push(normalizedUserId);
            params.push(String(normalizedUserId));
          } else {
            conditions.push('userId = ?');
            params.push(normalizedUserId);
          }
        }
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      var result = await pool.query(sql, params);
      return result[0][0].count;
    } catch (error) {
      console.error('countDocuments error:', error);
      return 0;
    }
  },

  // Get all orders (for admin)
  findAll: async function() {
    try {
      var sql = 'SELECT * FROM custom_orders ORDER BY created_at DESC';
      var result = await pool.query(sql);
      var rows = result[0];
      var self = this;

      var orders = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        row._id = row.id;
        row.referenceImages = self._parseJSON(row.referenceImages, []);
        row.adminQuote = self._parseJSON(row.adminQuote, { price: 0, estimatedDays: 0, notes: '' });
        orders.push(row);
      }

      return orders;
    } catch (error) {
      console.error('findAll error:', error);
      return [];
    }
  }
};

export default customOrderModel;