import pool from '../config/database.js';

const settingsModel = {
  // Safe JSON parse
  _parseValue: function(value) {
    if (value === null || value === undefined) return null;
    
    // If it's already not a string, return as is
    if (typeof value !== 'string') return value;
    
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      // If parsing fails, return the raw string value
      return value;
    }
  },

  // Safe JSON stringify
  _stringifyValue: function(value) {
    if (value === null || value === undefined) return JSON.stringify(null);
    
    // If it's already a string that looks like a primitive, just stringify it
    if (typeof value === 'string') {
      return JSON.stringify(value);
    }
    
    return JSON.stringify(value);
  },

  // Find all or by query
  find: async function(query) {
    if (!query) query = {};
    
    try {
      let sql = 'SELECT * FROM settings WHERE 1=1';
      const params = [];

      // Handle key query (single key or array of keys)
      if (query.key) {
        // MongoDB-style $in query
        if (query.key.$in && Array.isArray(query.key.$in)) {
          const placeholders = query.key.$in.map(() => '?').join(',');
          sql += ` AND setting_key IN (${placeholders})`;
          params.push(...query.key.$in);
        } else if (typeof query.key === 'string') {
          // Simple key query
          sql += ' AND setting_key = ?';
          params.push(query.key);
        }
      }

      console.log('Settings find SQL:', sql);
      console.log('Settings find params:', params);

      const [rows] = await pool.query(sql, params);

      console.log('Settings found rows:', rows.length);

      const self = this;
      return rows.map(function(row) {
        return {
          _id: row.id,
          id: row.id,
          key: row.setting_key,
          value: self._parseValue(row.setting_value)
        };
      });
    } catch (error) {
      console.error('Settings find error:', error);
      return [];
    }
  },

  // Find one setting by key
  findOne: async function(query) {
    try {
      if (!query || !query.key) {
        console.error('findOne requires a key');
        return null;
      }

      const [rows] = await pool.query(
        'SELECT * FROM settings WHERE setting_key = ? LIMIT 1', 
        [query.key]
      );

      if (rows && rows[0]) {
        return {
          _id: rows[0].id,
          id: rows[0].id,
          key: rows[0].setting_key,
          value: this._parseValue(rows[0].setting_value)
        };
      }
      return null;
    } catch (error) {
      console.error('Settings findOne error:', error);
      return null;
    }
  },

  // Find one and update (or insert if upsert)
  findOneAndUpdate: async function(filter, updateData, options) {
    if (!options) options = {};
    
    try {
      const key = filter.key;
      
      if (!key) {
        console.error('findOneAndUpdate requires filter.key');
        return null;
      }

      // Extract value - handle both { value: x } and { $set: { value: x } }
      let value;
      if (updateData.value !== undefined) {
        value = updateData.value;
      } else if (updateData.$set && updateData.$set.value !== undefined) {
        value = updateData.$set.value;
      } else {
        value = updateData;
      }

      const stringifiedValue = this._stringifyValue(value);

      console.log('Updating setting:', key, '=', value);

      // Check if exists
      const existing = await this.findOne({ key: key });

      if (existing) {
        // Update existing
        await pool.query(
          'UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
          [stringifiedValue, key]
        );
        console.log('Updated existing setting:', key);
      } else if (options.upsert) {
        // Insert new
        await pool.query(
          'INSERT INTO settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          [key, stringifiedValue]
        );
        console.log('Inserted new setting:', key);
      } else {
        console.log('Setting not found and upsert is false:', key);
        return null;
      }

      // Return updated/inserted document
      if (options.new !== false) {
        return this.findOne({ key: key });
      }
      return existing;
    } catch (error) {
      console.error('Settings findOneAndUpdate error:', error);
      throw error;
    }
  },

  // Bulk write operations
  bulkWrite: async function(operations) {
    if (!operations || !Array.isArray(operations)) {
      return { ok: 0, nModified: 0 };
    }

    let modified = 0;
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      try {
        if (op.updateOne) {
          await this.findOneAndUpdate(
            op.updateOne.filter,
            op.updateOne.update,
            { upsert: op.updateOne.upsert || false, new: true }
          );
          modified++;
        }
      } catch (err) {
        console.error('Bulk write operation failed:', err);
      }
    }

    console.log('Bulk write completed:', modified, 'operations');
    return { ok: 1, nModified: modified };
  },

  // Get all settings as object
  getAllAsObject: async function() {
    try {
      const settings = await this.find({});
      const obj = {};
      
      for (let i = 0; i < settings.length; i++) {
        obj[settings[i].key] = settings[i].value;
      }
      
      return obj;
    } catch (error) {
      console.error('getAllAsObject error:', error);
      return {};
    }
  },

  // Set a single setting
  set: async function(key, value) {
    return this.findOneAndUpdate(
      { key: key },
      { value: value },
      { upsert: true, new: true }
    );
  },

  // Get a single setting value
  get: async function(key, defaultValue) {
    try {
      const setting = await this.findOne({ key: key });
      if (setting) {
        return setting.value;
      }
      return defaultValue !== undefined ? defaultValue : null;
    } catch (error) {
      console.error('Settings get error:', error);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }
};

export default settingsModel;