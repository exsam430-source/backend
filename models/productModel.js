// models/productModel.js - UPDATED
import pool from '../config/database.js';

var productModel = {
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

  // Transform row to product object
  _transformRow: function(row) {
    if (!row) return null;
    
    row._id = row.id;
    row.images = this._parseJSON(row.images, []);
    row.sizes = this._parseJSON(row.sizes, []);
    row.colors = this._parseJSON(row.colors, []);
    row.longDescription = this._parseJSON(row.longDescription, {});
    
    // Convert tinyint to boolean
    row.inStock = row.inStock === 1 || row.inStock === true;
    row.bestseller = row.bestseller === 1 || row.bestseller === true;
    row.newArrival = row.newArrival === 1 || row.newArrival === true;
    row.featured = row.featured === 1 || row.featured === true;
    
    // Page visibility fields
    row.showInNecklaces = row.showInNecklaces === 1 || row.showInNecklaces === true;
    row.showInBangles = row.showInBangles === 1 || row.showInBangles === true;
    row.showInUnder1000 = row.showInUnder1000 === 1 || row.showInUnder1000 === true;
    row.showInKundan = row.showInKundan === 1 || row.showInKundan === true;
    
    return row;
  },

  // Create product
  create: async function(data) {
    try {
      var name = data.name;
      var description = data.description || '';
      var longDescription = data.longDescription || {};
      var price = Number(data.price) || 0;
      var comparePrice = Number(data.comparePrice) || 0;
      var images = data.images || [];
      var category = data.category || '';
      var subCategory = data.subCategory || '';
      var material = data.material || 'Artificial Gold Plated';
      var sizes = data.sizes || [];
      var colors = data.colors || [];
      var weight = data.weight || '';
      var stoneType = data.stoneType || '';
      var stoneColor = data.stoneColor || '';
      var inStock = data.inStock !== false;
      var stockQuantity = Number(data.stockQuantity) || 0;
      var bestseller = data.bestseller === true;
      var newArrival = data.newArrival === true;
      var featured = data.featured === true;
      var sku = data.sku || '';
      var date = data.date || Date.now();
      
      // Page visibility fields
      var showInNecklaces = data.showInNecklaces === true;
      var showInBangles = data.showInBangles === true;
      var showInUnder1000 = data.showInUnder1000 === true;
      var showInKundan = data.showInKundan === true;

      // Stringify JSON fields
      var longDescStr = typeof longDescription === 'string' ? longDescription : JSON.stringify(longDescription);
      var imagesStr = typeof images === 'string' ? images : JSON.stringify(images);
      var sizesStr = typeof sizes === 'string' ? sizes : JSON.stringify(sizes);
      var colorsStr = typeof colors === 'string' ? colors : JSON.stringify(colors);

      var result = await pool.query(
        `INSERT INTO products (
          name, description, longDescription, price, comparePrice, images, 
          category, subCategory, material, sizes, colors, weight, 
          stoneType, stoneColor, inStock, stockQuantity, bestseller, 
          newArrival, featured, sku, date, showInNecklaces, showInBangles, showInUnder1000, showInKundan, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name,
          description,
          longDescStr,
          price,
          comparePrice,
          imagesStr,
          category,
          subCategory,
          material,
          sizesStr,
          colorsStr,
          weight,
          stoneType,
          stoneColor,
          inStock ? 1 : 0,
          stockQuantity,
          bestseller ? 1 : 0,
          newArrival ? 1 : 0,
          featured ? 1 : 0,
          sku,
          date,
          showInNecklaces ? 1 : 0,
          showInBangles ? 1 : 0,
          showInUnder1000 ? 1 : 0,
          showInKundan ? 1 : 0
        ]
      );

      var insertId = result[0].insertId;
      console.log('Product created with ID:', insertId);
      return this.findById(insertId);
    } catch (error) {
      console.error('Create product error:', error);
      throw error;
    }
  },

  // Find by ID
  findById: async function(id) {
    try {
      if (!id) return null;
      
      var result = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
      var rows = result[0];

      if (rows && rows[0]) {
        return this._transformRow(rows[0]);
      }
      return null;
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  },

  // Find all with query
  find: async function(query) {
    if (!query) query = {};
    
    try {
      var sql = 'SELECT * FROM products WHERE 1=1';
      var params = [];

      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }
      if (query.subCategory) {
        sql += ' AND subCategory = ?';
        params.push(query.subCategory);
      }
      if (query.bestseller) {
        sql += ' AND bestseller = 1';
      }
      if (query.newArrival) {
        sql += ' AND newArrival = 1';
      }
      if (query.featured) {
        sql += ' AND featured = 1';
      }
      if (query.inStock) {
        sql += ' AND inStock = 1';
      }
      if (query.material) {
        sql += ' AND material = ?';
        params.push(query.material);
      }
      
      // Page visibility filters
      if (query.showInNecklaces) {
        sql += ' AND showInNecklaces = 1';
      }
      if (query.showInBangles) {
        sql += ' AND showInBangles = 1';
      }
      if (query.showInUnder1000) {
        sql += ' AND showInUnder1000 = 1';
      }
      if (query.showInKundan) {
        sql += ' AND showInKundan = 1';
      }

      // Handle search with $or
      if (query.$or && Array.isArray(query.$or)) {
        var orConditions = [];
        for (var i = 0; i < query.$or.length; i++) {
          var cond = query.$or[i];
          if (cond.name && cond.name.$regex) {
            params.push('%' + cond.name.$regex + '%');
            orConditions.push('name LIKE ?');
          }
          if (cond.description && cond.description.$regex) {
            params.push('%' + cond.description.$regex + '%');
            orConditions.push('description LIKE ?');
          }
        }
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }

      // Handle price range
      if (query.price) {
        if (query.price.$gte) {
          sql += ' AND price >= ?';
          params.push(query.price.$gte);
        }
        if (query.price.$lte) {
          sql += ' AND price <= ?';
          params.push(query.price.$lte);
        }
      }

      sql += ' ORDER BY created_at DESC';

      var result = await pool.query(sql, params);
      var rows = result[0];
      var self = this;

      var products = [];
      for (var j = 0; j < rows.length; j++) {
        products.push(self._transformRow(rows[j]));
      }

      return products;
    } catch (error) {
      console.error('find error:', error);
      return [];
    }
  },

  // Find by ID and update - FIXED
  findByIdAndUpdate: async function(id, data, options) {
    if (!options) options = {};

    try {
      if (!id) {
        console.error('findByIdAndUpdate: No ID provided');
        return null;
      }

      var fields = [];
      var values = [];

      var jsonFields = ['images', 'sizes', 'colors', 'longDescription'];
      var boolFields = ['inStock', 'bestseller', 'newArrival', 'featured', 'showInNecklaces', 'showInBangles', 'showInUnder1000', 'showInKundan'];
      var skipFields = ['id', '_id', 'created_at'];

      for (var key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          // Skip certain fields
          if (skipFields.indexOf(key) !== -1) continue;
          
          var value = data[key];
          
          if (value === undefined) continue;

          if (jsonFields.indexOf(key) !== -1) {
            fields.push(key + ' = ?');
            if (typeof value === 'string') {
              values.push(value);
            } else {
              values.push(JSON.stringify(value));
            }
          } else if (boolFields.indexOf(key) !== -1) {
            fields.push(key + ' = ?');
            values.push(value ? 1 : 0);
          } else {
            fields.push(key + ' = ?');
            values.push(value);
          }
        }
      }

      if (fields.length === 0) {
        console.log('No fields to update');
        return this.findById(id);
      }

      values.push(id);
      var sql = 'UPDATE products SET ' + fields.join(', ') + ' WHERE id = ?';
      
      console.log('Executing update SQL:', sql);
      console.log('Values count:', values.length);

      var result = await pool.query(sql, values);
      console.log('Update result:', result[0].affectedRows, 'rows affected');

      // Return updated product
      return this.findById(id);
    } catch (error) {
      console.error('findByIdAndUpdate error:', error);
      throw error;
    }
  },

  // Find by ID and delete
  findByIdAndDelete: async function(id) {
    try {
      var product = await this.findById(id);
      if (product) {
        await pool.query('DELETE FROM products WHERE id = ?', [id]);
        console.log('Product deleted:', id);
      }
      return product;
    } catch (error) {
      console.error('findByIdAndDelete error:', error);
      return null;
    }
  },

  // Count documents
  countDocuments: async function(query) {
    if (!query) query = {};
    
    try {
      var sql = 'SELECT COUNT(*) as count FROM products';
      var params = [];
      var conditions = [];

      if (query.category) {
        conditions.push('category = ?');
        params.push(query.category);
      }
      if (query.inStock) {
        conditions.push('inStock = 1');
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
  }
};

export default productModel;