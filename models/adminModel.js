import pool from '../config/database.js';
import bcrypt from 'bcrypt';

const adminModel = {
  // Create admin
  async create(data) {
    const { email, password, name = 'Admin' } = data;
    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO admins (email, password, name, passwordChangedAt) VALUES (?, ?, ?, NOW())`,
      [email.toLowerCase(), hashedPassword, name]
    );

    return this.findById(result.insertId);
  },

  // Find by ID
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]);
    if (rows[0]) {
      rows[0]._id = rows[0].id;
      // Add methods
      rows[0].comparePassword = async (pwd) => bcrypt.compare(pwd, rows[0].password);
      rows[0].isLocked = () => rows[0].lockUntil && new Date(rows[0].lockUntil) > new Date();
      rows[0].incrementLoginAttempts = async () => adminModel.incrementLoginAttempts(rows[0].id);
      rows[0].resetLoginAttempts = async () => adminModel.resetLoginAttempts(rows[0].id);
    }
    return rows[0] || null;
  },

  // Find one
  async findOne(query) {
    if (query.email) {
      const [rows] = await pool.query('SELECT * FROM admins WHERE email = ?', [query.email.toLowerCase()]);
      if (rows[0]) {
        rows[0]._id = rows[0].id;
        rows[0].comparePassword = async (pwd) => bcrypt.compare(pwd, rows[0].password);
        rows[0].isLocked = () => rows[0].lockUntil && new Date(rows[0].lockUntil) > new Date();
        rows[0].incrementLoginAttempts = async () => adminModel.incrementLoginAttempts(rows[0].id);
        rows[0].resetLoginAttempts = async () => adminModel.resetLoginAttempts(rows[0].id);
      }
      return rows[0] || null;
    }
    return null;
  },

  // Increment login attempts
  async incrementLoginAttempts(id) {
    const [rows] = await pool.query('SELECT loginAttempts, lockUntil FROM admins WHERE id = ?', [id]);
    const admin = rows[0];
    
    if (admin.lockUntil && new Date(admin.lockUntil) < new Date()) {
      await pool.query('UPDATE admins SET loginAttempts = 1, lockUntil = NULL WHERE id = ?', [id]);
      return;
    }

    const newAttempts = (admin.loginAttempts || 0) + 1;
    
    if (newAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      await pool.query('UPDATE admins SET loginAttempts = ?, lockUntil = ? WHERE id = ?', [newAttempts, lockUntil, id]);
    } else {
      await pool.query('UPDATE admins SET loginAttempts = ? WHERE id = ?', [newAttempts, id]);
    }
  },

  // Reset login attempts
  async resetLoginAttempts(id) {
    await pool.query('UPDATE admins SET loginAttempts = 0, lockUntil = NULL, lastLogin = NOW() WHERE id = ?', [id]);
  },

  // Count documents
  async countDocuments() {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM admins');
    return rows[0].count;
  },

  // Save
  async save(admin) {
    if (admin.password && !admin.password.startsWith('$2')) {
      admin.password = await bcrypt.hash(admin.password, 12);
    }
    
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(admin)) {
      if (value !== undefined && key !== 'id' && key !== '_id' && typeof value !== 'function') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    values.push(admin.id || admin._id);
    await pool.query(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(admin.id || admin._id);
  }
};

export default adminModel;