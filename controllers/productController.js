// controllers/productController.js - UPDATED
import productModel from "../models/productModel.js";
import Newsletter from "../models/Newsletter.js";
import nodemailer from "nodemailer";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl
} from "../config/cloudinary.js";
import { cleanTempFiles } from "../middleware/upload.js";

// Helper to get error message safely
var getErrorMessage = function(error, fallback) {
  if (!fallback) fallback = 'An error occurred';
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error.message && typeof error.message === 'string') return error.message;
  return fallback;
};

// Email transporter
var transporter = null;

var initTransporter = function() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD
      }
    });
  }
  return transporter;
};

// Delete Cloudinary images helper
var deleteCloudinaryImages = async function(images) {
  if (!images || images.length === 0) return;

  for (var i = 0; i < images.length; i++) {
    var imageUrl = images[i];
    if (imageUrl) {
      var publicId = getPublicIdFromUrl(imageUrl);
      if (publicId) {
        try {
          await deleteFromCloudinary(publicId);
          console.log('Deleted image:', publicId);
        } catch (err) {
          console.error('Failed to delete image:', err.message);
        }
      }
    }
  }
};

// Send new product emails
var sendNewProductEmails = async function(product) {
  try {
    var subscribers = await Newsletter.find({ isActive: true });
    if (!subscribers || subscribers.length === 0) return;

    var emailTransporter = initTransporter();
    var productId = product.id || product._id;
    var productUrl = process.env.FRONTEND_URL + '/product/' + productId;
    var imageUrl = product.images && product.images[0] ? product.images[0] : '';
    var priceFormatted = product.price ? product.price.toLocaleString() : '0';
    var comparePriceFormatted = product.comparePrice ? product.comparePrice.toLocaleString() : '0';

    var htmlContent = '<!DOCTYPE html><html><body style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; overflow: hidden;"><div style="background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 50%, #d4af37 100%); padding: 30px; text-align: center;"><h1 style="color: #1a1a1a; margin: 0; font-size: 28px;">NEW ARRIVAL</h1></div><div style="padding: 30px; color: #f4e5c2;">';
    
    if (imageUrl) {
      htmlContent += '<img src="' + imageUrl + '" alt="' + product.name + '" style="width: 100%; border-radius: 10px; margin-bottom: 20px; border: 2px solid #d4af37;" />';
    }
    
    htmlContent += '<h2 style="color: #d4af37; margin: 0 0 15px 0; font-size: 24px;">' + product.name + '</h2>';
    htmlContent += '<p style="color: #cccccc; line-height: 1.6; margin-bottom: 20px;">' + product.description + '</p>';
    htmlContent += '<div style="background: rgba(212, 175, 55, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #d4af37;">';
    htmlContent += '<p style="margin: 0; font-size: 24px; color: #d4af37; font-weight: bold;">Rs. ' + priceFormatted + '</p>';
    
    if (product.comparePrice > product.price) {
      htmlContent += '<p style="margin: 5px 0 0 0; color: #888; text-decoration: line-through;">Rs. ' + comparePriceFormatted + '</p>';
    }
    
    htmlContent += '</div><a href="' + productUrl + '" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 100%); color: #1a1a1a; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">SHOP NOW</a></div>';
    htmlContent += '<div style="background: #1a1a1a; padding: 20px; text-align: center; border-top: 1px solid #d4af37;"><p style="color: #888; margin: 0; font-size: 12px;">You received this email because you subscribed to our newsletter.</p></div></body></html>';

    var batchSize = 10;
    for (var i = 0; i < subscribers.length; i += batchSize) {
      var batch = subscribers.slice(i, i + batchSize);

      var promises = [];
      for (var j = 0; j < batch.length; j++) {
        var subscriber = batch[j];
        var promise = emailTransporter.sendMail({
          from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
          to: subscriber.email,
          subject: 'New Arrival: ' + product.name + ' - RB Jewellery',
          html: htmlContent
        }).catch(function(err) {
          console.error('Failed to send email:', err.message);
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      if (i + batchSize < subscribers.length) {
        await new Promise(function(resolve) {
          setTimeout(resolve, 1000);
        });
      }
    }

    console.log('New product emails sent to ' + subscribers.length + ' subscribers');
  } catch (error) {
    console.error("Error sending new product emails:", error);
  }
};

// Add Product
var addProduct = async function(req, res) {
  try {
    console.log('=== ADD PRODUCT ===');
    console.log('Body:', Object.keys(req.body));
    console.log('Files:', req.files ? Object.keys(req.files) : 'none');

    var name = req.body.name;
    var description = req.body.description;
    var price = req.body.price;
    var comparePrice = req.body.comparePrice;
    var category = req.body.category;
    var subCategory = req.body.subCategory;
    var material = req.body.material;
    var sizes = req.body.sizes;
    var colors = req.body.colors;
    var weight = req.body.weight;
    var stoneType = req.body.stoneType;
    var stoneColor = req.body.stoneColor;
    var inStock = req.body.inStock;
    var stockQuantity = req.body.stockQuantity;
    var bestseller = req.body.bestseller;
    var newArrival = req.body.newArrival;
    var featured = req.body.featured;
    var sku = req.body.sku;
    var longDescription = req.body.longDescription;
    var sendNotification = req.body.sendNotification;
    
    // Page visibility fields
    var showInNecklaces = req.body.showInNecklaces;
    var showInBangles = req.body.showInBangles;
    var showInUnder1000 = req.body.showInUnder1000;
    var showInKundan = req.body.showInKundan;

    // Collect uploaded files
    var imageFiles = [];
    var imageKeys = ['image1', 'image2', 'image3', 'image4'];

    for (var i = 0; i < imageKeys.length; i++) {
      var key = imageKeys[i];
      if (req.files && req.files[key] && req.files[key][0]) {
        imageFiles.push(req.files[key][0]);
      }
    }

    if (imageFiles.length === 0) {
      return res.status(400).json({ success: false, message: "At least one image is required" });
    }

    // Upload images to Cloudinary
    var uploadedImages = [];
    for (var j = 0; j < imageFiles.length; j++) {
      try {
        var result = await uploadToCloudinary(imageFiles[j].path, 'rb-jewellery/products');
        if (result && result.url) {
          uploadedImages.push(result.url);
          console.log('Uploaded image:', result.url);
        }
      } catch (uploadErr) {
        console.error('Image upload failed:', uploadErr.message);
      }
    }

    cleanTempFiles(req.files);

    if (uploadedImages.length === 0) {
      return res.status(400).json({ success: false, message: "Failed to upload images" });
    }

    // Parse JSON fields safely
    var parsedSizes = [];
    var parsedColors = [];
    var parsedLongDescription = {};

    if (sizes) {
      if (typeof sizes === 'string') {
        try { parsedSizes = JSON.parse(sizes); } catch (e) { parsedSizes = []; }
      } else if (Array.isArray(sizes)) {
        parsedSizes = sizes;
      }
    }

    if (colors) {
      if (typeof colors === 'string') {
        try { parsedColors = JSON.parse(colors); } catch (e) { parsedColors = []; }
      } else if (Array.isArray(colors)) {
        parsedColors = colors;
      }
    }

    if (longDescription) {
      if (typeof longDescription === 'string') {
        try { parsedLongDescription = JSON.parse(longDescription); } catch (e) { parsedLongDescription = {}; }
      } else if (typeof longDescription === 'object') {
        parsedLongDescription = longDescription;
      }
    }

    var productData = {
      name: name,
      description: description || '',
      price: Number(price) || 0,
      comparePrice: Number(comparePrice) || 0,
      images: uploadedImages,
      category: category || '',
      subCategory: subCategory || '',
      material: material || "Artificial Gold Plated",
      sizes: parsedSizes,
      colors: parsedColors,
      weight: weight || "",
      stoneType: stoneType || "",
      stoneColor: stoneColor || "",
      inStock: inStock === "true" || inStock === true,
      stockQuantity: Number(stockQuantity) || 0,
      bestseller: bestseller === "true" || bestseller === true,
      newArrival: newArrival === "true" || newArrival === true,
      featured: featured === "true" || featured === true,
      sku: sku || "",
      longDescription: {
        overview: parsedLongDescription.overview || "",
        highlights: parsedLongDescription.highlights || [],
        specifications: parsedLongDescription.specifications || [],
        careInstructions: parsedLongDescription.careInstructions || "",
        keyFeatures: parsedLongDescription.keyFeatures || [],
        importantInfo: parsedLongDescription.importantInfo || "",
        productDetails: parsedLongDescription.productDetails || []
      },
      date: Date.now(),
      // Page visibility fields
      showInNecklaces: showInNecklaces === "true" || showInNecklaces === true,
      showInBangles: showInBangles === "true" || showInBangles === true,
      showInUnder1000: showInUnder1000 === "true" || showInUnder1000 === true,
      showInKundan: showInKundan === "true" || showInKundan === true
    };

    var product = await productModel.create(productData);

    if (!product) {
      return res.status(500).json({ success: false, message: "Failed to create product" });
    }

    console.log('Product created:', product.id || product._id);

    if (sendNotification === "true" || sendNotification === true) {
      sendNewProductEmails(product);
    }

    res.status(201).json({
      success: true,
      message: "Product Added Successfully",
      product: product
    });
  } catch (error) {
    cleanTempFiles(req.files);
    console.error('Add product error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to add product');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Update Product
var updateProduct = async function(req, res) {
  try {
    var id = req.params.id;
    console.log('=== UPDATE PRODUCT ===');
    console.log('Product ID:', id);
    console.log('Body keys:', Object.keys(req.body));
    console.log('Files:', req.files ? Object.keys(req.files) : 'none');

    // Find existing product
    var existingProduct = await productModel.findById(id);
    if (!existingProduct) {
      cleanTempFiles(req.files);
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log('Existing product images:', existingProduct.images);

    // Parse incoming data
    var updateData = {};

    // Basic fields
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.price !== undefined) updateData.price = Number(req.body.price) || 0;
    if (req.body.comparePrice !== undefined) updateData.comparePrice = Number(req.body.comparePrice) || 0;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.subCategory !== undefined) updateData.subCategory = req.body.subCategory;
    if (req.body.material !== undefined) updateData.material = req.body.material;
    if (req.body.weight !== undefined) updateData.weight = req.body.weight;
    if (req.body.stoneType !== undefined) updateData.stoneType = req.body.stoneType;
    if (req.body.stoneColor !== undefined) updateData.stoneColor = req.body.stoneColor;
    if (req.body.sku !== undefined) updateData.sku = req.body.sku;
    if (req.body.stockQuantity !== undefined) updateData.stockQuantity = Number(req.body.stockQuantity) || 0;

    // Boolean fields
    if (req.body.inStock !== undefined) {
      updateData.inStock = req.body.inStock === "true" || req.body.inStock === true;
    }
    if (req.body.bestseller !== undefined) {
      updateData.bestseller = req.body.bestseller === "true" || req.body.bestseller === true;
    }
    if (req.body.newArrival !== undefined) {
      updateData.newArrival = req.body.newArrival === "true" || req.body.newArrival === true;
    }
    if (req.body.featured !== undefined) {
      updateData.featured = req.body.featured === "true" || req.body.featured === true;
    }
    
    // Page visibility fields
    if (req.body.showInNecklaces !== undefined) {
      updateData.showInNecklaces = req.body.showInNecklaces === "true" || req.body.showInNecklaces === true;
    }
    if (req.body.showInBangles !== undefined) {
      updateData.showInBangles = req.body.showInBangles === "true" || req.body.showInBangles === true;
    }
    if (req.body.showInUnder1000 !== undefined) {
      updateData.showInUnder1000 = req.body.showInUnder1000 === "true" || req.body.showInUnder1000 === true;
    }
    if (req.body.showInKundan !== undefined) {
      updateData.showInKundan = req.body.showInKundan === "true" || req.body.showInKundan === true;
    }

    // Parse JSON fields
    if (req.body.sizes) {
      if (typeof req.body.sizes === 'string') {
        try { updateData.sizes = JSON.parse(req.body.sizes); } catch (e) { updateData.sizes = []; }
      } else if (Array.isArray(req.body.sizes)) {
        updateData.sizes = req.body.sizes;
      }
    }

    if (req.body.colors) {
      if (typeof req.body.colors === 'string') {
        try { updateData.colors = JSON.parse(req.body.colors); } catch (e) { updateData.colors = []; }
      } else if (Array.isArray(req.body.colors)) {
        updateData.colors = req.body.colors;
      }
    }

    if (req.body.longDescription) {
      if (typeof req.body.longDescription === 'string') {
        try { updateData.longDescription = JSON.parse(req.body.longDescription); } catch (e) { updateData.longDescription = {}; }
      } else if (typeof req.body.longDescription === 'object') {
        updateData.longDescription = req.body.longDescription;
      }
    }

    // ============ IMAGE HANDLING ============
    var existingImagesFromFrontend = [null, null, null, null];
    if (req.body.existingImages) {
      try {
        var parsed = typeof req.body.existingImages === 'string' 
          ? JSON.parse(req.body.existingImages) 
          : req.body.existingImages;
        
        if (Array.isArray(parsed)) {
          existingImagesFromFrontend = parsed;
        }
      } catch (e) {
        console.error('Failed to parse existingImages:', e.message);
      }
    }

    console.log('Existing images from frontend:', existingImagesFromFrontend);

    var finalImages = [null, null, null, null];
    
    for (var i = 0; i < 4; i++) {
      if (existingImagesFromFrontend[i]) {
        finalImages[i] = existingImagesFromFrontend[i];
      }
    }

    var imagesToDelete = [];

    var hasNewFiles = req.files && Object.keys(req.files).length > 0;
    
    if (hasNewFiles) {
      console.log('Processing new image uploads...');
      
      for (var j = 0; j < 4; j++) {
        var key = 'image' + (j + 1);
        
        if (req.files[key] && req.files[key][0]) {
          console.log('New image for slot', j, ':', req.files[key][0].originalname);
          
          if (existingProduct.images && existingProduct.images[j]) {
            imagesToDelete.push(existingProduct.images[j]);
          }
          
          try {
            var result = await uploadToCloudinary(req.files[key][0].path, 'rb-jewellery/products');
            if (result && result.url) {
              finalImages[j] = result.url;
              console.log('Uploaded new image to slot', j, ':', result.url);
            }
          } catch (uploadErr) {
            console.error('Image upload failed for slot', j, ':', uploadErr.message);
          }
        }
      }
      
      cleanTempFiles(req.files);
    }

    for (var k = 0; k < 4; k++) {
      var oldImage = existingProduct.images ? existingProduct.images[k] : null;
      var newImage = existingImagesFromFrontend[k];
      
      if (oldImage && !newImage && !finalImages[k]) {
        imagesToDelete.push(oldImage);
      }
    }

    var cleanImages = [];
    for (var m = 0; m < finalImages.length; m++) {
      if (finalImages[m]) {
        cleanImages.push(finalImages[m]);
      }
    }

    if (cleanImages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "At least one image is required" 
      });
    }

    updateData.images = cleanImages;
    console.log('Final images array:', cleanImages);

    if (imagesToDelete.length > 0) {
      console.log('Deleting old images:', imagesToDelete);
      await deleteCloudinaryImages(imagesToDelete);
    }

    console.log('Update data:', Object.keys(updateData));
    
    var updatedProduct = await productModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedProduct) {
      return res.status(500).json({ success: false, message: "Failed to update product" });
    }

    console.log('Product updated successfully:', updatedProduct.id || updatedProduct._id);
    console.log('Updated images:', updatedProduct.images);

    res.json({
      success: true,
      message: "Product Updated Successfully",
      product: updatedProduct
    });

  } catch (error) {
    cleanTempFiles(req.files);
    console.error('Update product error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to update product');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// List Products
var listProducts = async function(req, res) {
  try {
    console.log('=== LIST PRODUCTS ===');
    var products = await productModel.find({});
    console.log('Found', products.length, 'products');
    res.json({ success: true, products: products });
  } catch (error) {
    console.error('List products error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to fetch products');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Remove Product
var removeProduct = async function(req, res) {
  try {
    var productId = req.body.id;
    console.log('=== REMOVE PRODUCT ===');
    console.log('Product ID:', productId);

    var product = await productModel.findById(productId);
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await deleteCloudinaryImages(product.images);

    await productModel.findByIdAndDelete(productId);

    console.log('Product removed successfully');
    res.json({ success: true, message: "Product Removed" });
  } catch (error) {
    console.error('Remove product error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to remove product');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Single Product
var singleProduct = async function(req, res) {
  try {
    var id = req.params.id;
    console.log('=== GET SINGLE PRODUCT ===');
    console.log('Product ID:', id);

    var product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: product });
  } catch (error) {
    console.error('Single product error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to fetch product');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get Products by Category
var getProductsByCategory = async function(req, res) {
  try {
    var category = req.query.category;
    var subCategory = req.query.subCategory;
    var limit = req.query.limit;

    var query = {};
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;

    var products = await productModel.find(query);

    if (limit) {
      products = products.slice(0, parseInt(limit));
    }

    res.json({ success: true, products: products });
  } catch (error) {
    console.error('Get products by category error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to fetch products');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get Featured Products
var getFeaturedProducts = async function(req, res) {
  try {
    var type = req.query.type;
    var limit = parseInt(req.query.limit) || 10;

    var query = {};
    if (type === 'bestseller') query.bestseller = true;
    else if (type === 'newArrival') query.newArrival = true;
    else if (type === 'featured') query.featured = true;

    var products = await productModel.find(query);
    products = products.slice(0, limit);

    res.json({ success: true, products: products });
  } catch (error) {
    console.error('Get featured products error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to fetch products');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Search Products
var searchProducts = async function(req, res) {
  try {
    var q = req.query.q;
    var category = req.query.category;
    var subCategory = req.query.subCategory;
    var minPrice = req.query.minPrice;
    var maxPrice = req.query.maxPrice;
    var material = req.query.material;

    var query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (material) query.material = material;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    var products = await productModel.find(query);
    res.json({ success: true, products: products });
  } catch (error) {
    console.error('Search products error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to search products');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// Get Latest Images
var getLatestImages = async function(req, res) {
  try {
    var limit = parseInt(req.query.limit) || 5;
    var products = await productModel.find({ inStock: true });
    products = products.slice(0, limit);

    var result = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      result.push({
        _id: p.id || p._id,
        name: p.name,
        description: p.description,
        images: p.images,
        price: p.price
      });
    }

    res.json({ success: true, products: result });
  } catch (error) {
    console.error('Get latest images error:', error);
    res.status(500).json({ success: false, message: "Failed to fetch latest images" });
  }
};

// Get products for special pages
var getPageProducts = async function(req, res) {
  try {
    var page = req.query.page;
    var query = {};

    if (page === 'necklaces') {
      query.showInNecklaces = true;
    } else if (page === 'bangles') {
      query.showInBangles = true;
    } else if (page === 'under1000') {
      query.showInUnder1000 = true;
    } else if (page === 'kundan') {
      query.showInKundan = true;
    }

    var products = await productModel.find(query);
    res.json({ success: true, products: products });
  } catch (error) {
    console.error('Get page products error:', error);
    var errorMsg = getErrorMessage(error, 'Failed to fetch products');
    res.status(500).json({ success: false, message: errorMsg });
  }
};

export {
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
};