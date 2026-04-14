// models/Cart.js
import pool from '../config/database.js';

// Safe JSON parse helper
const safeParseJSON = (value, defaultValue = []) => {
  if (value === null || value === undefined) return defaultValue;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  if (value === '') return defaultValue;
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.error('JSON parse error:', e.message);
        return defaultValue;
      }
    }
    if (trimmed.length > 0) {
      return [trimmed];
    }
  }
  
  return defaultValue;
};

const Cart = {
  // Add to cart
  async add(userId, productId, quantity = 1, size = 'defaultSize', color = 'defaultColor') {
    try {
      const sizeVal = size || 'defaultSize';
      const colorVal = color || 'defaultColor';

      console.log('Cart.add called:', { userId, productId, quantity, sizeVal, colorVal });

      // Check if item already exists
      const [existing] = await pool.query(
        'SELECT * FROM cart WHERE userId = ? AND productId = ? AND size = ? AND color = ?',
        [userId, productId, sizeVal, colorVal]
      );

      console.log('Existing cart item:', existing.length > 0 ? existing[0] : 'None');

      if (existing && existing.length > 0) {
        // Update quantity
        const newQty = existing[0].quantity + quantity;
        await pool.query(
          'UPDATE cart SET quantity = ? WHERE id = ?',
          [newQty, existing[0].id]
        );
        console.log('Updated existing cart item, new quantity:', newQty);
      } else {
        // Insert new item
        const [result] = await pool.query(
          'INSERT INTO cart (userId, productId, quantity, size, color) VALUES (?, ?, ?, ?, ?)',
          [userId, productId, quantity, sizeVal, colorVal]
        );
        console.log('Inserted new cart item, ID:', result.insertId);
      }

      return true;
    } catch (error) {
      console.error('Cart.add error:', error);
      throw error;
    }
  },

  // Find by user - returns cart items with product details
  async findByUser(userId) {
    try {
      console.log('Cart.findByUser called for userId:', userId);

      // First, check if there are any items in cart table
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as count FROM cart WHERE userId = ?',
        [userId]
      );
      console.log('Total cart items for user:', countResult[0].count);

      // Get cart items with product details
      const [rows] = await pool.query(
        `SELECT c.id, c.userId, c.productId, c.quantity, c.size, c.color,
                p.name, p.price, p.images, p.inStock 
         FROM cart c 
         LEFT JOIN products p ON c.productId = p.id 
         WHERE c.userId = ?
         ORDER BY c.created_at DESC`,
        [userId]
      );

      console.log('Cart rows with products:', rows.length);
      
      if (rows.length > 0) {
        console.log('First row:', rows[0]);
      }

      return rows.map(row => ({
        id: row.id,
        userId: row.userId,
        productId: String(row.productId),
        quantity: row.quantity || 1,
        size: row.size || 'defaultSize',
        color: row.color || 'defaultColor',
        name: row.name,
        price: row.price,
        images: safeParseJSON(row.images, []),
        inStock: row.inStock
      }));
    } catch (error) {
      console.error('Cart.findByUser error:', error);
      throw error;
    }
  },

  // Update quantity
  async updateQuantity(userId, productId, quantity, size = 'defaultSize', color = 'defaultColor') {
    try {
      const sizeVal = size || 'defaultSize';
      const colorVal = color || 'defaultColor';
      const qty = parseInt(quantity) || 0;

      console.log('Cart.updateQuantity:', { userId, productId, qty, sizeVal, colorVal });

      if (qty <= 0) {
        return this.remove(userId, productId, sizeVal, colorVal);
      }

      // Check if item exists
      const [existing] = await pool.query(
        'SELECT * FROM cart WHERE userId = ? AND productId = ? AND size = ? AND color = ?',
        [userId, productId, sizeVal, colorVal]
      );

      if (existing && existing.length > 0) {
        await pool.query(
          'UPDATE cart SET quantity = ? WHERE id = ?',
          [qty, existing[0].id]
        );
        console.log('Updated cart quantity');
      } else {
        await pool.query(
          'INSERT INTO cart (userId, productId, quantity, size, color) VALUES (?, ?, ?, ?, ?)',
          [userId, productId, qty, sizeVal, colorVal]
        );
        console.log('Created new cart item');
      }

      return true;
    } catch (error) {
      console.error('Cart.updateQuantity error:', error);
      throw error;
    }
  },

  // Remove from cart
  async remove(userId, productId, size = 'defaultSize', color = 'defaultColor') {
    try {
      const sizeVal = size || 'defaultSize';
      const colorVal = color || 'defaultColor';

      console.log('Cart.remove:', { userId, productId, sizeVal, colorVal });

      await pool.query(
        'DELETE FROM cart WHERE userId = ? AND productId = ? AND size = ? AND color = ?',
        [userId, productId, sizeVal, colorVal]
      );

      console.log('Removed cart item');
      return true;
    } catch (error) {
      console.error('Cart.remove error:', error);
      throw error;
    }
  },

  // Clear cart
  async clear(userId) {
    try {
      console.log('Cart.clear for userId:', userId);
      
      await pool.query('DELETE FROM cart WHERE userId = ?', [userId]);
      
      console.log('Cart cleared');
      return true;
    } catch (error) {
      console.error('Cart.clear error:', error);
      throw error;
    }
  },

  // Count items
  async count(userId) {
    try {
      const [rows] = await pool.query(
        'SELECT COALESCE(SUM(quantity), 0) as count FROM cart WHERE userId = ?',
        [userId]
      );
      return rows[0].count || 0;
    } catch (error) {
      console.error('Cart.count error:', error);
      return 0;
    }
  }
};

export default Cart;