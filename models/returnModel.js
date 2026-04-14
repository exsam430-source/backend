// models/returnModel.js
import pool from '../config/database.js';

var returnModel = {
  // Safe JSON parsing helper
  _parseJSON: function(value, fallback) {
    if (fallback === undefined) fallback = {};
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    
    // Handle [object Object] corruption
    if (value === '[object Object]') return fallback;
    
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return fallback;
    }
  },

  // Safe JSON stringify
  _stringifyJSON: function(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      // Check if already valid JSON string
      try {
        JSON.parse(value);
        return value;
      } catch (e) {
        return JSON.stringify(value);
      }
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      console.error('JSON stringify error:', e.message);
      return null;
    }
  },

  // Create return
  create: async function(data) {
    try {
      var orderId = data.orderId;
      var userId = data.userId;
      var productId = data.productId;
      var productDetails = data.productDetails || {};
      var reason = data.reason || '';
      var description = data.description || '';
      var proofImages = data.proofImages || [];
      var refundMethod = data.refundMethod || 'easypaisa';
      var refundDetails = data.refundDetails || {};
      var status = data.status || 'pending';
      var refundAmount = Number(data.refundAmount) || 0;

      var statusHistory = [{
        status: 'pending',
        date: new Date().toISOString(),
        note: 'Return request submitted',
        updatedBy: 'customer'
      }];

      var productDetailsStr = this._stringifyJSON(productDetails) || '{}';
      var proofImagesStr = this._stringifyJSON(proofImages) || '[]';
      var statusHistoryStr = this._stringifyJSON(statusHistory) || '[]';
      var refundDetailsStr = this._stringifyJSON(refundDetails) || '{}';
      var shippingInfoStr = '{}';

      var result = await pool.query(
        `INSERT INTO returns 
         (orderId, userId, productId, productDetails, reason, description, proofImages, statusHistory, refundMethod, refundDetails, shippingInfo, status, refundAmount, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderId,
          userId,
          productId,
          productDetailsStr,
          reason,
          description,
          proofImagesStr,
          statusHistoryStr,
          refundMethod,
          refundDetailsStr,
          shippingInfoStr,
          status,
          refundAmount
        ]
      );

      var insertId = result[0].insertId;
      console.log('Return created with ID:', insertId);
      return this.findById(insertId);
    } catch (error) {
      console.error('Create return error:', error);
      throw error;
    }
  },

  // Find by ID with joins
  findById: async function(id) {
    try {
      var result = await pool.query(
        `SELECT r.*, 
                o.status as orderStatus, o.amount as orderAmount, o.paymentMethod as orderPaymentMethod, o.date as orderDate, 
                u.name as userName, u.email as userEmail, u.phone as userPhone 
         FROM returns r 
         LEFT JOIN orders o ON r.orderId = o.id 
         LEFT JOIN users u ON r.userId = u.id 
         WHERE r.id = ?`,
        [id]
      );

      var rows = result[0];

      if (rows && rows[0]) {
        var row = rows[0];
        return this._formatReturnRow(row);
      }
      return null;
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  },

  // Format a return row with parsed JSON and nested objects
  _formatReturnRow: function(row) {
    if (!row) return null;

    row._id = row.id;
    row.productDetails = this._parseJSON(row.productDetails, {});
    row.proofImages = this._parseJSON(row.proofImages, []);
    row.shippingInfo = this._parseJSON(row.shippingInfo, {});
    row.statusHistory = this._parseJSON(row.statusHistory, []);
    row.refundDetails = this._parseJSON(row.refundDetails, {});

    // Create nested orderId object (like populate)
    if (row.orderId) {
      row.orderId = {
        _id: row.orderId,
        id: row.orderId,
        status: row.orderStatus,
        amount: row.orderAmount,
        paymentMethod: row.orderPaymentMethod,
        date: row.orderDate
      };
    }

    // Create nested userId object (like populate)
    var odId = row.userId;
    if (odId) {
      row.userId = {
        _id: odId,
        id: odId,
        name: row.userName,
        email: row.userEmail,
        phone: row.userPhone
      };
    }

    // Clean up extra fields
    delete row.orderStatus;
    delete row.orderAmount;
    delete row.orderPaymentMethod;
    delete row.orderDate;
    delete row.userName;
    delete row.userEmail;
    delete row.userPhone;

    return row;
  },

  // Find with query
  find: async function(query) {
    if (!query) query = {};

    try {
      var sql = `SELECT r.*, 
                        o.status as orderStatus, o.amount as orderAmount, o.paymentMethod as orderPaymentMethod, o.date as orderDate, 
                        u.name as userName, u.email as userEmail, u.phone as userPhone 
                 FROM returns r 
                 LEFT JOIN orders o ON r.orderId = o.id 
                 LEFT JOIN users u ON r.userId = u.id 
                 WHERE 1=1`;
      var params = [];

      if (query.userId) {
        sql += ' AND r.userId = ?';
        params.push(query.userId);
      }
      if (query.orderId) {
        sql += ' AND r.orderId = ?';
        params.push(query.orderId);
      }
      if (query.productId) {
        sql += ' AND r.productId = ?';
        params.push(query.productId);
      }
      if (query.status) {
        if (query.status.$nin && Array.isArray(query.status.$nin)) {
          var placeholders = query.status.$nin.map(function() { return '?'; }).join(',');
          sql += ' AND r.status NOT IN (' + placeholders + ')';
          for (var i = 0; i < query.status.$nin.length; i++) {
            params.push(query.status.$nin[i]);
          }
        } else if (typeof query.status === 'string') {
          sql += ' AND r.status = ?';
          params.push(query.status);
        }
      }

      sql += ' ORDER BY r.created_at DESC';

      var result = await pool.query(sql, params);
      var rows = result[0];
      var self = this;

      var returns = [];
      for (var j = 0; j < rows.length; j++) {
        var formatted = self._formatReturnRow(rows[j]);
        if (formatted) {
          returns.push(formatted);
        }
      }

      return returns;
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

  // Find by ID and update - FIXED
  findByIdAndUpdate: async function(id, data, options) {
    if (!options) options = {};

    try {
      console.log('findByIdAndUpdate called with ID:', id);
      console.log('Update data:', JSON.stringify(data, null, 2));

      var fields = [];
      var values = [];

      var jsonFields = ['productDetails', 'proofImages', 'shippingInfo', 'statusHistory', 'refundDetails'];
      var dateFields = ['refundDate'];

      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          var value = data[key];

          if (value !== undefined && key !== 'id' && key !== '_id') {
            // Handle JSON fields
            if (jsonFields.indexOf(key) !== -1) {
              fields.push(key + ' = ?');
              var jsonValue = this._stringifyJSON(value);
              values.push(jsonValue || '{}');
              console.log('JSON field:', key, '=', jsonValue ? jsonValue.substring(0, 50) + '...' : 'null');
            }
            // Handle date fields
            else if (dateFields.indexOf(key) !== -1) {
              fields.push(key + ' = ?');
              // Convert ISO string to MySQL datetime format
              if (value) {
                var dateValue = new Date(value);
                var mysqlDate = dateValue.toISOString().slice(0, 19).replace('T', ' ');
                values.push(mysqlDate);
                console.log('Date field:', key, '=', mysqlDate);
              } else {
                values.push(null);
              }
            }
            // Handle other fields
            else {
              fields.push(key + ' = ?');
              values.push(value);
              console.log('Field:', key, '=', value);
            }
          }
        }
      }

      if (fields.length === 0) {
        console.log('No fields to update');
        return this.findById(id);
      }

      values.push(id);
      var sql = 'UPDATE returns SET ' + fields.join(', ') + ' WHERE id = ?';
      
      console.log('SQL:', sql);
      console.log('Values count:', values.length);

      var result = await pool.query(sql, values);
      console.log('Update result:', result[0].affectedRows, 'rows affected');

      return this.findById(id);
    } catch (error) {
      console.error('findByIdAndUpdate error:', error);
      console.error('Error SQL State:', error.sqlState);
      console.error('Error Code:', error.code);
      throw error; // Re-throw so controller can catch it
    }
  },

  // Find by ID and delete
  findByIdAndDelete: async function(id) {
    try {
      var returnData = await this.findById(id);
      await pool.query('DELETE FROM returns WHERE id = ?', [id]);
      return returnData;
    } catch (error) {
      console.error('findByIdAndDelete error:', error);
      return null;
    }
  },

  // Count documents
  countDocuments: async function(query) {
    if (!query) query = {};

    try {
      var sql = 'SELECT COUNT(*) as count FROM returns';
      var params = [];
      var conditions = [];

      if (query.status) {
        conditions.push('status = ?');
        params.push(query.status);
      }
      if (query.userId) {
        conditions.push('userId = ?');
        params.push(query.userId);
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

  // Aggregate for stats
  aggregate: async function(pipeline) {
    try {
      // Stats by status
      if (pipeline[0] && pipeline[0].$group && pipeline[0].$group._id === '$status') {
        var result = await pool.query(
          'SELECT status as _id, COUNT(*) as count, COALESCE(SUM(refundAmount), 0) as totalAmount FROM returns GROUP BY status'
        );
        return result[0];
      }

      // Total refunded (completed)
      if (pipeline[0] && pipeline[0].$match && pipeline[0].$match.status === 'completed') {
        var result2 = await pool.query(
          'SELECT COALESCE(SUM(refundAmount), 0) as total FROM returns WHERE status = ?',
          ['completed']
        );
        return [{ total: result2[0][0].total || 0 }];
      }

      return [];
    } catch (error) {
      console.error('aggregate error:', error);
      return [];
    }
  }
};

export default returnModel;