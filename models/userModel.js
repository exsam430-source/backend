import pool from '../config/database.js';

const userModel = {
  // Safe JSON parsing helper
  _parseJSON: function(value, fallback) {
    if (fallback === undefined) fallback = {};
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('JSON parse error:', e.message);
      return fallback;
    }
  },

  // Create user
  create: async function(data) {
    var name = data.name;
    var email = data.email;
    var password = data.password;
    var phone = data.phone || '';
    var address = data.address || '';
    var avatar = data.avatar || '';
    var isVerified = data.isVerified || false;
    var verificationToken = data.verificationToken || null;
    var verificationTokenExpire = data.verificationTokenExpire || null;

    try {
      var result = await pool.query(
        'INSERT INTO users (name, email, password, phone, address, avatar, isVerified, verificationToken, verificationTokenExpire, notifications, cartData, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          name,
          email.toLowerCase(),
          password,
          phone,
          address,
          avatar,
          isVerified ? 1 : 0,
          verificationToken,
          verificationTokenExpire,
          JSON.stringify({ email: true, marketing: false, privacy: true }),
          JSON.stringify({})
        ]
      );

      var insertId = result[0].insertId;
      return this.findById(insertId);
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  // Find by ID
  findById: async function(id) {
    try {
      var result = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      var rows = result[0];

      if (rows && rows[0]) {
        var user = rows[0];
        user._id = user.id;
        user.notifications = this._parseJSON(user.notifications, {});
        user.cartData = this._parseJSON(user.cartData, {});
        return user;
      }
      return null;
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  },

  // Find by query
  findOne: async function(query) {
    try {
      var rows;
      var result;

      if (query.email) {
        result = await pool.query(
          'SELECT * FROM users WHERE email = ?',
          [query.email.toLowerCase()]
        );
        rows = result[0];

        if (rows && rows[0]) {
          var user = rows[0];
          user._id = user.id;
          user.notifications = this._parseJSON(user.notifications, {});
          user.cartData = this._parseJSON(user.cartData, {});
          return user;
        }
        return null;
      }

      if (query.verificationToken) {
        result = await pool.query(
          'SELECT * FROM users WHERE verificationToken = ? AND verificationTokenExpire > NOW()',
          [query.verificationToken]
        );
        rows = result[0];

        if (rows && rows[0]) {
          var user2 = rows[0];
          user2._id = user2.id;
          user2.notifications = this._parseJSON(user2.notifications, {});
          user2.cartData = this._parseJSON(user2.cartData, {});
          return user2;
        }
        return null;
      }

      if (query.resetPasswordToken) {
        result = await pool.query(
          'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpire > NOW()',
          [query.resetPasswordToken]
        );
        rows = result[0];

        if (rows && rows[0]) {
          var user3 = rows[0];
          user3._id = user3.id;
          user3.notifications = this._parseJSON(user3.notifications, {});
          user3.cartData = this._parseJSON(user3.cartData, {});
          return user3;
        }
        return null;
      }

      return null;
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

      for (key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          value = data[key];

          if (value !== undefined && key !== 'id' && key !== '_id') {
            if (key === 'notifications' || key === 'cartData') {
              fields.push(key + ' = ?');
              if (typeof value === 'string') {
                values.push(value);
              } else {
                values.push(JSON.stringify(value));
              }
            } else if (key === 'isVerified') {
              fields.push(key + ' = ?');
              values.push(value ? 1 : 0);
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
      var sql = 'UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?';
      await pool.query(sql, values);

      return this.findById(id);
    } catch (error) {
      console.error('findByIdAndUpdate error:', error);
      return null;
    }
  },

  // Count documents
  countDocuments: async function(query) {
    if (!query) query = {};

    try {
      var sql = 'SELECT COUNT(*) as count FROM users';
      var params = [];
      var conditions = [];
      var key;

      var keys = Object.keys(query);
      if (keys.length > 0) {
        for (var i = 0; i < keys.length; i++) {
          key = keys[i];
          conditions.push(key + ' = ?');
          params.push(query[key]);
        }
        sql = sql + ' WHERE ' + conditions.join(' AND ');
      }

      var result = await pool.query(sql, params);
      var rows = result[0];
      return rows[0].count;
    } catch (error) {
      console.error('countDocuments error:', error);
      return 0;
    }
  },

  // Save method for compatibility
  save: async function(user) {
    if (user.id || user._id) {
      var userId = user.id || user._id;
      return this.findByIdAndUpdate(userId, user, { new: true });
    }
    return this.create(user);
  }
};

export default userModel;