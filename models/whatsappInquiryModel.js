import pool from '../config/database.js';

const whatsappInquiryModel = {
  // Create
  async create(data) {
    const {
      userId = null, productId = null, productName = '', productPrice = 0,
      customerName = '', customerPhone = '', message = '', inquiryType = 'general'
    } = data;

    const [result] = await pool.query(
      `INSERT INTO whatsapp_inquiries 
       (userId, productId, productName, productPrice, customerName, customerPhone, message, inquiryType) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, productId, productName, productPrice, customerName, customerPhone, message, inquiryType]
    );

    return this.findById(result.insertId);
  },

  // Find by ID
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM whatsapp_inquiries WHERE id = ?', [id]);
    if (rows[0]) rows[0]._id = rows[0].id;
    return rows[0] || null;
  },

  // Find
  async find(query = {}) {
    let sql = 'SELECT * FROM whatsapp_inquiries WHERE 1=1';
    const params = [];

    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      row._id = row.id;
      return row;
    });
  },

  // Find by ID and update
  async findByIdAndUpdate(id, data, options = {}) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== '_id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    values.push(id);
    await pool.query(`UPDATE whatsapp_inquiries SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  },

  // Find by ID and delete
  async findByIdAndDelete(id) {
    await pool.query('DELETE FROM whatsapp_inquiries WHERE id = ?', [id]);
    return { deletedCount: 1 };
  },

  // Save
  async save() { return this; }
};

export default whatsappInquiryModel;