import pool from '../config/database.js'

var productModel = {

  _parseJSON: function (value, fallback) {
    if (fallback === undefined) fallback = {}
    if (value === null || value === undefined) return fallback
    if (Buffer.isBuffer(value)) {
      try { return JSON.parse(value.toString()) } catch (e) { return fallback }
    }
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return fallback
    try { return JSON.parse(value) } catch (e) { return fallback }
  },

  _toBool: function (value) {
    if (value === null || value === undefined) return false
    if (Buffer.isBuffer(value)) return value[0] === 1
    if (typeof value === 'bigint') return value === BigInt(1)
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') return value === '1' || value === 'true'
    if (typeof value === 'boolean') return value
    return false
  },

  _transformRow: function (row) {
    if (!row) return null
    row._id             = row.id
    row.images          = this._parseJSON(row.images, [])
    row.sizes           = this._parseJSON(row.sizes, [])
    row.colors          = this._parseJSON(row.colors, [])
    row.longDescription = this._parseJSON(row.longDescription, {})
    row.inStock         = this._toBool(row.inStock)
    row.bestseller      = this._toBool(row.bestseller)
    row.newArrival      = this._toBool(row.newArrival)
    row.featured        = this._toBool(row.featured)
    row.showInNecklaces = this._toBool(row.showInNecklaces)
    row.showInBangles   = this._toBool(row.showInBangles)
    row.showInUnder1000 = this._toBool(row.showInUnder1000)
    row.showInKundan    = this._toBool(row.showInKundan)
    row.showInBridalSet = this._toBool(row.showInBridalSet)
    row.showInPartyWear = this._toBool(row.showInPartyWear)
    row.isGoldProduct   = this._toBool(row.isGoldProduct)
    row.showInGold      = this._toBool(row.showInGold)
    row.price           = parseFloat(row.price)           || 0
    row.comparePrice    = parseFloat(row.comparePrice)    || 0
    row.goldWeightGrams = parseFloat(row.goldWeightGrams) || 0
    row.makingCharges   = parseFloat(row.makingCharges)   || 0
    row.stoneCost       = parseFloat(row.stoneCost)       || 0
    row.goldKarat       = row.goldKarat                   || ''
    return row
  },

  create: async function (data) {
    try {
      var imagesStr   = JSON.stringify(data.images          || [])
      var sizesStr    = JSON.stringify(data.sizes           || [])
      var colorsStr   = JSON.stringify(data.colors          || [])
      var longDescStr = JSON.stringify(data.longDescription || {})

      var bInStock         = data.inStock         === true ? 1 : 0
      var bBestseller      = data.bestseller      === true ? 1 : 0
      var bNewArrival      = data.newArrival      === true ? 1 : 0
      var bFeatured        = data.featured        === true ? 1 : 0
      var bShowInNecklaces = data.showInNecklaces === true ? 1 : 0
      var bShowInBangles   = data.showInBangles   === true ? 1 : 0
      var bShowInUnder1000 = data.showInUnder1000 === true ? 1 : 0
      var bShowInKundan    = data.showInKundan    === true ? 1 : 0
      var bShowInBridalSet = data.showInBridalSet === true ? 1 : 0
      var bShowInPartyWear = data.showInPartyWear === true ? 1 : 0
      var bIsGoldProduct   = data.isGoldProduct   === true ? 1 : 0
      var bShowInGold      = data.showInGold      === true ? 1 : 0

      var result = await pool.query(
        `INSERT INTO products (
          name, description, longDescription,
          price, comparePrice, images,
          category, subCategory, material,
          sizes, colors, weight, stoneType, stoneColor,
          inStock, stockQuantity, bestseller, newArrival,
          featured, sku, date,
          showInNecklaces, showInBangles, showInUnder1000,
          showInKundan, showInBridalSet, showInPartyWear,
          isGoldProduct, goldKarat, goldWeightGrams,
          makingCharges, stoneCost, showInGold,
          created_at
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          NOW()
        )`,
        [
          data.name        || '',
          data.description || '',
          longDescStr,
          Number(data.price)        || 0,
          Number(data.comparePrice) || 0,
          imagesStr,
          data.category    || '',
          data.subCategory || '',
          data.material    || 'Artificial Gold Plated',
          sizesStr,
          colorsStr,
          data.weight     || '',
          data.stoneType  || '',
          data.stoneColor || '',
          bInStock,
          Number(data.stockQuantity) || 0,
          bBestseller,
          bNewArrival,
          bFeatured,
          data.sku  || '',
          data.date || Date.now(),
          bShowInNecklaces,
          bShowInBangles,
          bShowInUnder1000,
          bShowInKundan,
          bShowInBridalSet,
          bShowInPartyWear,
          bIsGoldProduct,
          data.goldKarat || '',
          parseFloat(data.goldWeightGrams) || 0,
          parseFloat(data.makingCharges)   || 0,
          parseFloat(data.stoneCost)       || 0,
          bShowInGold,
        ]
      )

      var insertId = result[0].insertId
      return this.findById(insertId)
    } catch (error) {
      console.error('productModel.create error:', error)
      throw error
    }
  },

  findById: async function (id) {
    try {
      if (!id) return null
      var result = await pool.query('SELECT * FROM products WHERE id = ?', [id])
      var rows = result[0]
      if (rows && rows[0]) return this._transformRow(rows[0])
      return null
    } catch (error) {
      console.error('productModel.findById error:', error)
      return null
    }
  },

  find: async function (query) {
    if (!query) query = {}
    try {
      var sql    = 'SELECT * FROM products WHERE 1=1'
      var params = []

      if (query.category)    { sql += ' AND category = ?';    params.push(query.category) }
      if (query.subCategory) { sql += ' AND subCategory = ?'; params.push(query.subCategory) }
      if (query.material)    { sql += ' AND material = ?';    params.push(query.material) }
      if (query.goldKarat)   { sql += ' AND goldKarat = ?';   params.push(query.goldKarat) }

      if (query.bestseller    === true) sql += ' AND bestseller = 1'
      if (query.newArrival    === true) sql += ' AND newArrival = 1'
      if (query.featured      === true) sql += ' AND featured = 1'
      if (query.inStock       === true) sql += ' AND inStock = 1'
      if (query.isGoldProduct === true) sql += ' AND isGoldProduct = 1'
      if (query.showInGold    === true) sql += ' AND showInGold = 1'

      if (query.showInNecklaces === true) sql += ' AND showInNecklaces = 1'
      if (query.showInBangles   === true) sql += ' AND showInBangles = 1'
      if (query.showInUnder1000 === true) sql += ' AND showInUnder1000 = 1'
      if (query.showInKundan    === true) sql += ' AND showInKundan = 1'
      if (query.showInBridalSet === true) sql += ' AND showInBridalSet = 1'
      if (query.showInPartyWear === true) sql += ' AND showInPartyWear = 1'

      if (query.$or && Array.isArray(query.$or)) {
        var orParts = []
        for (var i = 0; i < query.$or.length; i++) {
          var cond = query.$or[i]
          if (cond.name && cond.name.$regex) {
            orParts.push('name LIKE ?')
            params.push('%' + cond.name.$regex + '%')
          }
          if (cond.description && cond.description.$regex) {
            orParts.push('description LIKE ?')
            params.push('%' + cond.description.$regex + '%')
          }
        }
        if (orParts.length > 0) sql += ' AND (' + orParts.join(' OR ') + ')'
      }

      if (query.price) {
        if (query.price.$gte !== undefined) { sql += ' AND price >= ?'; params.push(query.price.$gte) }
        if (query.price.$lte !== undefined) { sql += ' AND price <= ?'; params.push(query.price.$lte) }
      }

      sql += ' ORDER BY created_at DESC'

      var result = await pool.query(sql, params)
      var rows   = result[0]
      var self   = this
      var out    = []
      for (var j = 0; j < rows.length; j++) {
        out.push(self._transformRow(rows[j]))
      }
      return out
    } catch (error) {
      console.error('productModel.find error:', error)
      return []
    }
  },

  findByIdAndUpdate: async function (id, data) {
    try {
      if (!id) return null

      var setParts = []
      var values   = []

      if (data.name        !== undefined) { setParts.push('name = ?');        values.push(String(data.name        || '')) }
      if (data.description !== undefined) { setParts.push('description = ?'); values.push(String(data.description || '')) }
      if (data.category    !== undefined) { setParts.push('category = ?');    values.push(String(data.category    || '')) }
      if (data.subCategory !== undefined) { setParts.push('subCategory = ?'); values.push(String(data.subCategory || '')) }
      if (data.material    !== undefined) { setParts.push('material = ?');    values.push(String(data.material    || '')) }
      if (data.weight      !== undefined) { setParts.push('weight = ?');      values.push(String(data.weight      || '')) }
      if (data.stoneType   !== undefined) { setParts.push('stoneType = ?');   values.push(String(data.stoneType   || '')) }
      if (data.stoneColor  !== undefined) { setParts.push('stoneColor = ?');  values.push(String(data.stoneColor  || '')) }
      if (data.sku         !== undefined) { setParts.push('sku = ?');         values.push(String(data.sku         || '')) }
      if (data.goldKarat   !== undefined) { setParts.push('goldKarat = ?');   values.push(String(data.goldKarat   || '')) }

      if (data.price           !== undefined) { setParts.push('price = ?');           values.push(Number(data.price)           || 0) }
      if (data.comparePrice    !== undefined) { setParts.push('comparePrice = ?');    values.push(Number(data.comparePrice)    || 0) }
      if (data.stockQuantity   !== undefined) { setParts.push('stockQuantity = ?');   values.push(Number(data.stockQuantity)   || 0) }
      if (data.goldWeightGrams !== undefined) { setParts.push('goldWeightGrams = ?'); values.push(parseFloat(data.goldWeightGrams) || 0) }
      if (data.makingCharges   !== undefined) { setParts.push('makingCharges = ?');   values.push(parseFloat(data.makingCharges)   || 0) }
      if (data.stoneCost       !== undefined) { setParts.push('stoneCost = ?');       values.push(parseFloat(data.stoneCost)       || 0) }

      if (data.images !== undefined) {
        setParts.push('images = ?')
        values.push(typeof data.images === 'string' ? data.images : JSON.stringify(data.images))
      }
      if (data.sizes !== undefined) {
        setParts.push('sizes = ?')
        values.push(typeof data.sizes === 'string' ? data.sizes : JSON.stringify(data.sizes))
      }
      if (data.colors !== undefined) {
        setParts.push('colors = ?')
        values.push(typeof data.colors === 'string' ? data.colors : JSON.stringify(data.colors))
      }
      if (data.longDescription !== undefined) {
        setParts.push('longDescription = ?')
        values.push(typeof data.longDescription === 'string' ? data.longDescription : JSON.stringify(data.longDescription))
      }

      var boolFields = [
        'inStock', 'bestseller', 'newArrival', 'featured',
        'showInNecklaces', 'showInBangles', 'showInUnder1000',
        'showInKundan', 'showInBridalSet', 'showInPartyWear',
        'isGoldProduct', 'showInGold',
      ]

      for (var bi = 0; bi < boolFields.length; bi++) {
        var bf = boolFields[bi]
        if (data[bf] !== undefined) {
          setParts.push(bf + ' = ?')
          values.push(data[bf] === true ? 1 : 0)
        }
      }

      if (setParts.length === 0) return this.findById(id)

      values.push(Number(id))
      var sql = 'UPDATE products SET ' + setParts.join(', ') + ' WHERE id = ?'
      await pool.query(sql, values)
      return this.findById(id)

    } catch (error) {
      console.error('productModel.findByIdAndUpdate error:', error)
      throw error
    }
  },

  findByIdAndDelete: async function (id) {
    try {
      var product = await this.findById(id)
      if (product) {
        await pool.query('DELETE FROM products WHERE id = ?', [id])
      }
      return product
    } catch (error) {
      console.error('productModel.findByIdAndDelete error:', error)
      return null
    }
  },

  countDocuments: async function (query) {
    if (!query) query = {}
    try {
      var sql        = 'SELECT COUNT(*) as count FROM products'
      var params     = []
      var conditions = []
      if (query.category)           { conditions.push('category = ?');    params.push(query.category) }
      if (query.inStock === true)     conditions.push('inStock = 1')
      if (query.isGoldProduct === true) conditions.push('isGoldProduct = 1')
      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
      var result = await pool.query(sql, params)
      return result[0][0].count
    } catch (error) {
      console.error('productModel.countDocuments error:', error)
      return 0
    }
  },
}

export default productModel