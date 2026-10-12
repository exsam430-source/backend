import pool from '../config/database.js'

var goldPriceModel = {

  // Get latest gold price
  getLatest: async function () {
    try {
      var result = await pool.query(
        'SELECT * FROM gold_prices ORDER BY created_at DESC LIMIT 1'
      )
      var rows = result[0]
      if (rows && rows[0]) {
        var row = rows[0]
        row.goldPricePerGram   = parseFloat(row.goldPricePerGram)   || 0
        row.goldPricePerTola   = parseFloat(row.goldPricePerTola)   || 0
        row.silverPricePerGram = parseFloat(row.silverPricePerGram) || 0
        row.silverPricePerTola = parseFloat(row.silverPricePerTola) || 0
        return row
      }
      return null
    } catch (error) {
      console.error('goldPriceModel.getLatest error:', error)
      return null
    }
  },

  // Get price history (last 30 entries)
  getHistory: async function (limit) {
    if (!limit) limit = 30
    try {
      var result = await pool.query(
        'SELECT * FROM gold_prices ORDER BY created_at DESC LIMIT ?',
        [limit]
      )
      var rows = result[0]
      return rows.map(function (row) {
        row.goldPricePerGram   = parseFloat(row.goldPricePerGram)   || 0
        row.goldPricePerTola   = parseFloat(row.goldPricePerTola)   || 0
        row.silverPricePerGram = parseFloat(row.silverPricePerGram) || 0
        row.silverPricePerTola = parseFloat(row.silverPricePerTola) || 0
        return row
      })
    } catch (error) {
      console.error('goldPriceModel.getHistory error:', error)
      return []
    }
  },

  // Create new price entry
  create: async function (data) {
    try {
      var goldPricePerGram   = parseFloat(data.goldPricePerGram)   || 0
      var goldPricePerTola   = parseFloat(data.goldPricePerTola)   || 0
      var silverPricePerGram = parseFloat(data.silverPricePerGram) || 0
      var silverPricePerTola = parseFloat(data.silverPricePerTola) || 0

      // Auto-calculate tola from gram if not provided (1 tola = 11.6638 grams)
      if (goldPricePerGram && !goldPricePerTola) {
        goldPricePerTola = goldPricePerGram * 11.6638
      }
      if (goldPricePerTola && !goldPricePerGram) {
        goldPricePerGram = goldPricePerTola / 11.6638
      }
      if (silverPricePerGram && !silverPricePerTola) {
        silverPricePerTola = silverPricePerGram * 11.6638
      }
      if (silverPricePerTola && !silverPricePerGram) {
        silverPricePerGram = silverPricePerTola / 11.6638
      }

      var result = await pool.query(
        `INSERT INTO gold_prices 
         (goldPricePerGram, goldPricePerTola, silverPricePerGram, silverPricePerTola, currency, updatedBy, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          goldPricePerGram,
          goldPricePerTola,
          silverPricePerGram,
          silverPricePerTola,
          data.currency   || 'PKR',
          data.updatedBy  || 'admin',
          data.note       || '',
        ]
      )
      return this.getLatest()
    } catch (error) {
      console.error('goldPriceModel.create error:', error)
      throw error
    }
  },

  // Calculate product price based on gold price + karat + weight
  calculatePrice: function (goldPricePerGram, karat, weightGrams, makingCharges, stoneCost) {
    if (!goldPricePerGram || !karat || !weightGrams) return 0

    // Extract karat number (e.g. "22k" -> 22)
    var karatNum = parseInt(String(karat).replace('k', '').replace('K', '')) || 0
    if (karatNum <= 0 || karatNum > 24) return 0

    // Gold purity factor
    var purity = karatNum / 24

    // Base gold cost
    var goldCost = goldPricePerGram * purity * weightGrams

    // Total = gold cost + making charges + stone cost
    var total = goldCost + (parseFloat(makingCharges) || 0) + (parseFloat(stoneCost) || 0)

    return Math.round(total)
  },
}

export default goldPriceModel