// routes/productRoute.js - UPDATED
import express from 'express';
import {
  addProduct,
  updateProduct,
  listProducts,
  removeProduct,
  singleProduct,
  getProductsByCategory,
  getFeaturedProducts,
  searchProducts,
  getLatestImages,
  getPageProducts
} from '../controllers/productController.js';
import upload from '../middleware/upload.js';
import adminAuth from '../middleware/adminAuth.js';

const productRouter = express.Router();

// Public routes
productRouter.get('/list', listProducts);
productRouter.get('/single/:id', singleProduct);
productRouter.get('/category', getProductsByCategory);
productRouter.get('/featured', getFeaturedProducts);
productRouter.get('/search', searchProducts);
productRouter.get('/latest-images', getLatestImages);
productRouter.get('/page-products', getPageProducts);

// Admin routes
productRouter.post(
  '/add',
  adminAuth,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]),
  addProduct
);

productRouter.put(
  '/update/:id',
  adminAuth,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
    { name: 'image4', maxCount: 1 },
  ]),
  updateProduct
);

productRouter.post('/remove', adminAuth, removeProduct);

export default productRouter;