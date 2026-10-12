import goldPriceModel from '../models/goldPriceModel.js'
import productModel   from '../models/productModel.js'
import pool           from '../config/database.js'

var getErrorMessage = function (error, fallback) {
  if (!fallback) fallback = 'An error occurred'
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.message) return error.message
  return fallback
}

// GET /api/gold-price/latest
var getLatestPrice = async function (req, res) {
  try {
    var price = await goldPriceModel.getLatest()
    return res.json({
      success: true,
      goldPrice: price,
    })
  } catch (error) {
    console.error('getLatestPrice error:', error)
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error, 'Failed to fetch gold price'),
    })
  }
}

// GET /api/gold-price/history
var getPriceHistory = async function (req, res) {
  try {
    var limit   = parseInt(req.query.limit) || 30
    var history = await goldPriceModel.getHistory(limit)
    return res.json({
      success: true,
      history: history,
    })
  } catch (error) {
    console.error('getPriceHistory error:', error)
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error, 'Failed to fetch price history'),
    })
  }
}

// POST /api/gold-price/update (Admin only)
var updateGoldPrice = async function (req, res) {
  try {
    var goldPricePerGram   = req.body.goldPricePerGram
    var goldPricePerTola   = req.body.goldPricePerTola
    var silverPricePerGram = req.body.silverPricePerGram
    var silverPricePerTola = req.body.silverPricePerTola
    var note               = req.body.note || ''

    // At least one gold price is required
    if (!goldPricePerGram && !goldPricePerTola) {
      return res.status(400).json({
        success: false,
        message: 'Gold price per gram or per tola is required',
      })
    }

    var newPrice = await goldPriceModel.create({
      goldPricePerGram,
      goldPricePerTola,
      silverPricePerGram,
      silverPricePerTola,
      updatedBy: 'admin',
      note,
    })

    // ✅ Auto-recalculate prices of all gold products
    if (newPrice && newPrice.goldPricePerGram) {
      try {
        var goldProducts = await pool.query(
          'SELECT * FROM products WHERE isGoldProduct = 1 AND goldWeightGrams > 0'
        )
        var rows = goldProducts[0] || []

        for (var i = 0; i < rows.length; i++) {
          var p            = rows[i]
          var newCalcPrice = goldPriceModel.calculatePrice(
            newPrice.goldPricePerGram,
            p.goldKarat,
            parseFloat(p.goldWeightGrams) || 0,
            parseFloat(p.makingCharges)   || 0,
            parseFloat(p.stoneCost)       || 0,
          )

          if (newCalcPrice > 0) {
            await pool.query(
              'UPDATE products SET price = ?, updated_at = NOW() WHERE id = ?',
              [newCalcPrice, p.id]
            )
          }
        }
        console.log('Auto-recalculated prices for', rows.length, 'gold products')
      } catch (recalcErr) {
        console.error('Price recalculation error:', recalcErr.message)
      }
    }

    return res.json({
      success: true,
      message: 'Gold price updated successfully! Product prices recalculated.',
      goldPrice: newPrice,
    })
  } catch (error) {
    console.error('updateGoldPrice error:', error)
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error, 'Failed to update gold price'),
    })
  }
}

// GET /api/gold-price/calculate - Calculate price for given params
var calculateGoldPrice = async function (req, res) {
  try {
    var karat          = req.query.karat
    var weightGrams    = parseFloat(req.query.weightGrams)    || 0
    var makingCharges  = parseFloat(req.query.makingCharges)  || 0
    var stoneCost      = parseFloat(req.query.stoneCost)      || 0

    var latestPrice = await goldPriceModel.getLatest()
    if (!latestPrice) {
      return res.status(404).json({
        success: false,
        message: 'Gold price not set. Please update gold price first.',
      })
    }

    var calculatedPrice = goldPriceModel.calculatePrice(
      latestPrice.goldPricePerGram,
      karat,
      weightGrams,
      makingCharges,
      stoneCost,
    )

    return res.json({
      success:          true,
      calculatedPrice:  calculatedPrice,
      goldPricePerGram: latestPrice.goldPricePerGram,
      karat,
      weightGrams,
      makingCharges,
      stoneCost,
    })
  } catch (error) {
    console.error('calculateGoldPrice error:', error)
    return res.status(500).json({
      success: false,
      message: getErrorMessage(error, 'Failed to calculate price'),
    })
  }
}

export {
  getLatestPrice,
  getPriceHistory,
  updateGoldPrice,
  calculateGoldPrice,
}