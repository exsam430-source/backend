// models/Review.js
import pool from '../config/database.js';

// Safe JSON parse helper - handles all edge cases
const safeParseJSON = (value, defaultValue = []) => {
  // If null/undefined, return default
  if (value === null || value === undefined) return defaultValue;
  
  // If already an array, return it
  if (Array.isArray(value)) return value;
  
  // If it's an object (already parsed), return it
  if (typeof value === 'object') return value;
  
  // If it's an empty string, return default
  if (value === '') return defaultValue;
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // Check if it looks like JSON (starts with [ or {)
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.error('JSON parse error:', e.message);
        return defaultValue;
      }
    }
    
    // If it's a URL or comma-separated string, convert to array
    if (trimmed.startsWith('http') || trimmed.includes(',')) {
      return trimmed.split(',').map(s => s.trim()).filter(s => s);
    }
    
    // Single value, return as array with one item
    if (trimmed.length > 0) {
      return [trimmed];
    }
  }
  
  return defaultValue;
};

const Review = {
  // Create
  async create(data) {
    const { productId, userId, name, email, rating, comment = '', images = [] } = data;
    
    // Ensure images is an array and stringify it
    const imagesArray = Array.isArray(images) ? images : [images].filter(Boolean);

    const [result] = await pool.query(
      `INSERT INTO reviews (productId, userId, name, email, rating, comment, images, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [productId, userId, name, email, rating, comment, JSON.stringify(imagesArray)]
    );

    return this.findById(result.insertId);
  },

  // Find by ID
  async findById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM reviews WHERE id = ?', [id]);
      if (rows[0]) {
        rows[0]._id = rows[0].id;
        rows[0].images = safeParseJSON(rows[0].images, []);
        rows[0].date = rows[0].date || rows[0].created_at;
      }
      return rows[0] || null;
    } catch (err) {
      console.error('Review findById error:', err);
      throw err;
    }
  },

  // Find
  async find(query = {}) {
    try {
      let sql = `
        SELECT r.*, u.name as userName, u.avatar 
        FROM reviews r 
        LEFT JOIN users u ON r.userId = u.id 
        WHERE 1=1
      `;
      const params = [];

      if (query.productId) {
        sql += ' AND r.productId = ?';
        params.push(query.productId);
      }

      sql += ' ORDER BY r.created_at DESC';

      const [rows] = await pool.query(sql, params);
      
      return rows.map(row => {
        return {
          _id: row.id,
          id: row.id,
          productId: row.productId,
          rating: row.rating,
          comment: row.comment || '',
          name: row.name,
          email: row.email,
          images: safeParseJSON(row.images, []),
          date: row.date || row.created_at,
          created_at: row.created_at,
          userId: {
            _id: row.userId,
            name: row.userName || row.name,
            avatar: row.avatar || null
          }
        };
      });
    } catch (err) {
      console.error('Review find error:', err);
      throw err;
    }
  },

  // Find one
  async findOne(query) {
    try {
      let sql = 'SELECT * FROM reviews WHERE 1=1';
      const params = [];

      if (query._id) {
        sql += ' AND id = ?';
        params.push(query._id);
      }
      if (query.productId) {
        sql += ' AND productId = ?';
        params.push(query.productId);
      }

      sql += ' LIMIT 1';

      const [rows] = await pool.query(sql, params);
      if (rows[0]) {
        rows[0]._id = rows[0].id;
        rows[0].images = safeParseJSON(rows[0].images, []);
        rows[0].date = rows[0].date || rows[0].created_at;
      }
      return rows[0] || null;
    } catch (err) {
      console.error('Review findOne error:', err);
      throw err;
    }
  },

  // Delete one
  async deleteOne(query) {
    try {
      const [result] = await pool.query('DELETE FROM reviews WHERE id = ?', [query._id]);
      return { deletedCount: result.affectedRows };
    } catch (err) {
      console.error('Review deleteOne error:', err);
      throw err;
    }
  }
};

export default Review;