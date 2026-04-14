import pool from '../config/database.js';

const Newsletter = {
  // Create/Subscribe
  async create(data) {
    const { email, name = '', isActive = true } = data;
    
    const [result] = await pool.query(
      'INSERT INTO newsletter (email, name, isActive) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE isActive = TRUE, name = VALUES(name)',
      [email.toLowerCase(), name, isActive]
    );

    return this.findOne({ email });
  },

  // Find one
  async findOne(query) {
    let sql = 'SELECT * FROM newsletter WHERE 1=1';
    const params = [];

    if (query.email) {
      sql += ' AND email = ?';
      params.push(query.email.toLowerCase());
    }

    sql += ' LIMIT 1';

    const [rows] = await pool.query(sql, params);
    if (rows[0]) rows[0]._id = rows[0].id;
    return rows[0] || null;
  },

  // Find
  async find(query = {}) {
    let sql = 'SELECT * FROM newsletter WHERE 1=1';
    const params = [];

    if (query.isActive !== undefined) {
      sql += ' AND isActive = ?';
      params.push(query.isActive);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      row._id = row.id;
      return row;
    });
  },

  // Find one and update
  async findOneAndUpdate(query, data, options = {}) {
    const existing = await this.findOne(query);
    if (!existing && !options.upsert) return null;

    if (existing) {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && key !== 'id' && key !== '_id') {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      values.push(existing.id);
      await pool.query(`UPDATE newsletter SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findOne({ email: existing.email });
    }

    if (options.upsert) {
      return this.create({ ...query, ...data });
    }

    return null;
  }
};

export default Newsletter;