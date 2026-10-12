import express           from 'express'
import adminAuth         from '../middleware/adminAuth.js'
import {
  getLatestPrice,
  getPriceHistory,
  updateGoldPrice,
  calculateGoldPrice,
} from '../controllers/goldPriceController.js'

var goldPriceRouter = express.Router()

// Public - anyone can see latest gold price
goldPriceRouter.get('/latest',    getLatestPrice)
goldPriceRouter.get('/history',   getPriceHistory)
goldPriceRouter.get('/calculate', calculateGoldPrice)

// Admin only
goldPriceRouter.post('/update', adminAuth, updateGoldPrice)

export default goldPriceRouter