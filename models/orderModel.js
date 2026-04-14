// models/orderModel.js
import pool from '../config/database.js';

// ✅ Safe JSON parse helper
const safeParseJSON = (value, defaultValue = null) => {
  // If null/undefined, return default
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  // If already an object/array, return it
  if (typeof value === 'object') {
    return value;
  }
  
  // If empty string, return default
  if (value === '' || value === 'null' || value === 'undefined') {
    return defaultValue;
  }
  
  // If it's "[object Object]", return default (corrupted data)
  if (value === '[object Object]') {
    console.warn('Found corrupted JSON data: [object Object]');
    return defaultValue;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Check if it looks like JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.error('JSON parse error:', e.message, 'Value:', value.substring(0, 100));
        return defaultValue;
      }
    }
  }
  
  return defaultValue;
};

// ✅ Safe JSON stringify helper
const safeStringifyJSON = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If already a string that looks like JSON, return it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      // Validate it's valid JSON
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch (e) {
        // Not valid JSON string, stringify it
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }
  
  // If object/array, stringify it
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      console.error('JSON stringify error:', e.message);
      return null;
    }
  }
  
  return JSON.stringify(value);
};

const orderModel = {
  // Create
  async create(data) {
    try {
      const {
        userId,
        items,
        amount,
        address,
        status = 'Order Placed',
        paymentMethod,
        payment = false,
        paymentProof = '',
        paymentDetails = {},
        adminNote = ''
      } = data;

      console.log('Creating order for user:', userId);
      console.log('Items count:', Array.isArray(items) ? items.length : 'not array');
      console.log('Amount:', amount);
      console.log('Payment method:', paymentMethod);

      // ✅ Safely stringify JSON fields
      const itemsJSON = safeStringifyJSON(items) || '[]';
      const addressJSON = safeStringifyJSON(address) || '{}';
      const paymentDetailsJSON = safeStringifyJSON(paymentDetails) || '{}';

      console.log('Items JSON length:', itemsJSON.length);

      const [result] = await pool.query(
        `INSERT INTO orders 
         (userId, items, amount, address, status, paymentMethod, payment, paymentProof, paymentDetails, adminNote, date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          itemsJSON,
          amount,
          addressJSON,
          status,
          paymentMethod,
          payment ? 1 : 0,
          paymentProof || '',
          paymentDetailsJSON,
          adminNote || '',
          Date.now()
        ]
      );

      console.log('Order created with ID:', result.insertId);

      return this.findById(result.insertId);
    } catch (error) {
      console.error('Order create error:', error);
      throw error;
    }
  },

  // Find by ID
  async findById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
      
      if (rows[0]) {
        const row = rows[0];
        
        return {
          _id: row.id,
          id: row.id,
          userId: row.userId,
          items: safeParseJSON(row.items, []),
          amount: parseFloat(row.amount) || 0,
          address: safeParseJSON(row.address, {}),
          status: row.status || 'Order Placed',
          paymentMethod: row.paymentMethod,
          payment: Boolean(row.payment),
          paymentProof: row.paymentProof || '',
          paymentDetails: safeParseJSON(row.paymentDetails, {}),
          paymentVerifiedAt: row.paymentVerifiedAt,
          adminNote: row.adminNote || '',
          date: row.date,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      }
      
      return null;
    } catch (error) {
      console.error('Order findById error:', error);
      throw error;
    }
  },

  // Find
  async find(query = {}) {
    try {
      let sql = 'SELECT * FROM orders WHERE 1=1';
      const params = [];

      if (query.userId) {
        sql += ' AND userId = ?';
        params.push(query.userId);
      }
      
      if (query.status) {
        if (query.status.$nin && Array.isArray(query.status.$nin)) {
          const placeholders = query.status.$nin.map(() => '?').join(',');
          sql += ` AND status NOT IN (${placeholders})`;
          params.push(...query.status.$nin);
        } else if (typeof query.status === 'string') {
          sql += ' AND status = ?';
          params.push(query.status);
        }
      }

      sql += ' ORDER BY date DESC';

      const [rows] = await pool.query(sql, params);
      
      return rows.map(row => ({
        _id: row.id,
        id: row.id,
        userId: row.userId,
        items: safeParseJSON(row.items, []),
        amount: parseFloat(row.amount) || 0,
        address: safeParseJSON(row.address, {}),
        status: row.status || 'Order Placed',
        paymentMethod: row.paymentMethod,
        payment: Boolean(row.payment),
        paymentProof: row.paymentProof || '',
        paymentDetails: safeParseJSON(row.paymentDetails, {}),
        paymentVerifiedAt: row.paymentVerifiedAt,
        adminNote: row.adminNote || '',
        date: row.date,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Order find error:', error);
      throw error;
    }
  },

  // Find by ID and update
  async findByIdAndUpdate(id, data, options = {}) {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || key === 'id' || key === '_id') {
          continue;
        }
        
        // Handle JSON fields
        if (['items', 'address', 'paymentDetails'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(safeStringifyJSON(value) || '{}');
        } 
        // Handle boolean
        else if (typeof value === 'boolean') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        }
        // Handle other fields
        else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (fields.length === 0) {
        return this.findById(id);
      }
      
      values.push(id);
      
      await pool.query(
        `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      
      return this.findById(id);
    } catch (error) {
      console.error('Order findByIdAndUpdate error:', error);
      throw error;
    }
  },

  // Count documents
  async countDocuments(query = {}) {
    try {
      let sql = 'SELECT COUNT(*) as count FROM orders';
      const params = [];
      
      if (Object.keys(query).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined) {
            conditions.push(`${key} = ?`);
            params.push(value);
          }
        }
        if (conditions.length > 0) {
          sql += ' WHERE ' + conditions.join(' AND ');
        }
      }
      
      const [rows] = await pool.query(sql, params);
      return rows[0].count || 0;
    } catch (error) {
      console.error('Order countDocuments error:', error);
      return 0;
    }
  },

  // Aggregate (simplified for MySQL)
  async aggregate(pipeline) {
    try {
      // Handle orders items aggregation for analytics
      if (pipeline[0]?.$unwind) {
        const [rows] = await pool.query('SELECT * FROM orders');
        let results = [];
        
        for (const row of rows) {
          const items = safeParseJSON(row.items, []);
          for (const item of items) {
            results.push({ 
              ...row, 
              items: item,
              date: row.date 
            });
          }
        }
        
        // Apply match filter (date range)
        if (pipeline[1]?.$match?.date?.$gte) {
          const minDate = pipeline[1].$match.date.$gte;
          results = results.filter(r => r.date >= minDate);
        }
        
        // Apply group
        if (pipeline[2]?.$group) {
          const grouped = {};
          for (const r of results) {
            const key = r.items?.productId || r.items?._id || 'unknown';
            if (!grouped[key]) {
              grouped[key] = {
                _id: key,
                name: r.items?.name || 'Unknown',
                totalQty: 0,
                revenue: 0
              };
            }
            grouped[key].totalQty += parseInt(r.items?.quantity) || 1;
            grouped[key].revenue += (parseInt(r.items?.quantity) || 1) * (parseFloat(r.items?.price) || 0);
          }
          results = Object.values(grouped);
        }
        
        // Sort by totalQty descending
        results.sort((a, b) => (b.totalQty || 0) - (a.totalQty || 0));
        
        // Apply limit
        if (pipeline[4]?.$limit) {
          results = results.slice(0, pipeline[4].$limit);
        }
        
        return results;
      }
      
      // Simple group by userId (for unique customers count)
      if (pipeline[0]?.$group?._id === '$userId') {
        const [rows] = await pool.query('SELECT DISTINCT userId FROM orders');
        return rows.map(r => ({ _id: r.userId }));
      }
      
      return [];
    } catch (error) {
      console.error('Order aggregate error:', error);
      return [];
    }
  },

  // Delete by ID
  async findByIdAndDelete(id) {
    try {
      const order = await this.findById(id);
      if (order) {
        await pool.query('DELETE FROM orders WHERE id = ?', [id]);
      }
      return order;
    } catch (error) {
      console.error('Order findByIdAndDelete error:', error);
      throw error;
    }
  }
};

export default orderModel;