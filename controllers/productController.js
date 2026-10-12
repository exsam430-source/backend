import productModel from '../models/productModel.js'
import Newsletter   from '../models/Newsletter.js'
import nodemailer   from 'nodemailer'
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
} from '../config/cloudinary.js'
import { cleanTempFiles } from '../middleware/upload.js'

var getErrorMessage = function (error, fallback) {
  if (!fallback) fallback = 'An error occurred'
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.message) return error.message
  return fallback
}

var parseBool = function (v) {
  if (v === 'true'  || v === true  || v === 1 || v === '1') return true
  if (v === 'false' || v === false || v === 0 || v === '0') return false
  return false
}

var parseJSONField = function (value, fallback) {
  if (fallback === undefined) fallback = []
  if (!value) return fallback
  if (Buffer.isBuffer(value)) {
    try { return JSON.parse(value.toString()) } catch (e) { return fallback }
  }
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch (e) { return fallback }
}

var transporter = null
var initTransporter = function () {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASSWORD },
    })
  }
  return transporter
}

var deleteCloudinaryImages = async function (images) {
  if (!images || !images.length) return
  for (var i = 0; i < images.length; i++) {
    if (!images[i]) continue
    var pid = getPublicIdFromUrl(images[i])
    if (pid) {
      try { await deleteFromCloudinary(pid) }
      catch (e) { console.error('cloudinary delete error:', e.message) }
    }
  }
}

var sendNewProductEmails = async function (product) {
  try {
    var subscribers = await Newsletter.find({ isActive: true })
    if (!subscribers || !subscribers.length) return
    var t          = initTransporter()
    var productUrl = (process.env.FRONTEND_URL || '') + '/product/' + (product.id || product._id)
    var img        = product.images && product.images[0] ? product.images[0] : ''
    var price      = product.price ? Number(product.price).toLocaleString() : '0'
    var html = '<!DOCTYPE html><html><body style="font-family:Georgia,serif;max-width:600px;margin:0 auto">' +
      '<div style="background:linear-gradient(135deg,#d4af37,#f4e5c2);padding:30px;text-align:center">' +
      '<h1 style="color:#1a1a1a;margin:0">NEW ARRIVAL</h1></div><div style="padding:30px">' +
      (img ? '<img src="' + img + '" style="width:100%;border-radius:10px;margin-bottom:20px"/>' : '') +
      '<h2 style="color:#d4af37">' + product.name + '</h2>' +
      '<p>' + (product.description || '') + '</p>' +
      '<p style="font-size:24px;color:#d4af37;font-weight:bold">Rs. ' + price + '</p>' +
      '<a href="' + productUrl + '" style="display:inline-block;background:#d4af37;color:#1a1a1a;' +
      'padding:15px 40px;border-radius:30px;font-weight:bold;text-decoration:none">SHOP NOW</a>' +
      '</div></body></html>'
    for (var i = 0; i < subscribers.length; i += 10) {
      var batch = subscribers.slice(i, i + 10)
      await Promise.all(batch.map(function (s) {
        return t.sendMail({
          from: '"RB Jewellery" <' + process.env.GMAIL_USER + '>',
          to: s.email,
          subject: 'New Arrival: ' + product.name,
          html: html,
        }).catch(function (e) { console.error('email send error:', e.message) })
      }))
    }
  } catch (e) { console.error('sendNewProductEmails error:', e) }
}

// ============ ADD PRODUCT ============
var addProduct = async function (req, res) {
  try {
    var imageFiles = []
    var imgKeys    = ['image1', 'image2', 'image3', 'image4']
    for (var i = 0; i < imgKeys.length; i++) {
      if (req.files && req.files[imgKeys[i]] && req.files[imgKeys[i]][0]) {
        imageFiles.push(req.files[imgKeys[i]][0])
      }
    }
    if (!imageFiles.length) {
      return res.status(400).json({ success: false, message: 'At least one image is required' })
    }

    var uploadedImages = []
    for (var j = 0; j < imageFiles.length; j++) {
      try {
        var r = await uploadToCloudinary(imageFiles[j].path, 'rb-jewellery/products')
        if (r && r.url) uploadedImages.push(r.url)
      } catch (e) { console.error('image upload error:', e.message) }
    }
    cleanTempFiles(req.files)

    if (!uploadedImages.length) {
      return res.status(400).json({ success: false, message: 'Failed to upload images' })
    }

    var productData = {
      name:            req.body.name        || '',
      description:     req.body.description || '',
      price:           Number(req.body.price)        || 0,
      comparePrice:    Number(req.body.comparePrice) || 0,
      images:          uploadedImages,
      category:        req.body.category    || '',
      subCategory:     req.body.subCategory || '',
      material:        req.body.material    || 'Artificial Gold Plated',
      weight:          req.body.weight      || '',
      stoneType:       req.body.stoneType   || '',
      stoneColor:      req.body.stoneColor  || '',
      sku:             req.body.sku         || '',
      stockQuantity:   Number(req.body.stockQuantity) || 0,
      date:            Date.now(),
      sizes:           parseJSONField(req.body.sizes,           []),
      colors:          parseJSONField(req.body.colors,          []),
      longDescription: parseJSONField(req.body.longDescription, {}),
      inStock:         parseBool(req.body.inStock),
      bestseller:      parseBool(req.body.bestseller),
      newArrival:      parseBool(req.body.newArrival),
      featured:        parseBool(req.body.featured),
      showInNecklaces: parseBool(req.body.showInNecklaces),
      showInBangles:   parseBool(req.body.showInBangles),
      showInUnder1000: parseBool(req.body.showInUnder1000),
      showInKundan:    parseBool(req.body.showInKundan),
      showInBridalSet: parseBool(req.body.showInBridalSet),
      // ✅ NEW
      showInPartyWear: parseBool(req.body.showInPartyWear),
    }

    var product = await productModel.create(productData)
    if (!product) return res.status(500).json({ success: false, message: 'Failed to create product' })
    if (parseBool(req.body.sendNotification)) sendNewProductEmails(product)
    return res.status(201).json({ success: true, message: 'Product Added Successfully', product: product })
  } catch (error) {
    cleanTempFiles(req.files)
    console.error('addProduct error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to add product') })
  }
}

// ============ UPDATE PRODUCT ============
var updateProduct = async function (req, res) {
  try {
    var id = req.params.id

    var existingProduct = await productModel.findById(id)
    if (!existingProduct) {
      cleanTempFiles(req.files)
      return res.status(404).json({ success: false, message: 'Product not found' })
    }

    var updateData = {}

    var textFields = [
      'name', 'description', 'category', 'subCategory',
      'material', 'weight', 'stoneType', 'stoneColor', 'sku',
    ]
    textFields.forEach(function (f) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f]
    })

    if (req.body.price         !== undefined) updateData.price         = Number(req.body.price)         || 0
    if (req.body.comparePrice  !== undefined) updateData.comparePrice  = Number(req.body.comparePrice)  || 0
    if (req.body.stockQuantity !== undefined) updateData.stockQuantity = Number(req.body.stockQuantity) || 0

    if (req.body.inStock         !== undefined) updateData.inStock         = parseBool(req.body.inStock)
    if (req.body.bestseller      !== undefined) updateData.bestseller      = parseBool(req.body.bestseller)
    if (req.body.newArrival      !== undefined) updateData.newArrival      = parseBool(req.body.newArrival)
    if (req.body.featured        !== undefined) updateData.featured        = parseBool(req.body.featured)
    if (req.body.showInNecklaces !== undefined) updateData.showInNecklaces = parseBool(req.body.showInNecklaces)
    if (req.body.showInBangles   !== undefined) updateData.showInBangles   = parseBool(req.body.showInBangles)
    if (req.body.showInUnder1000 !== undefined) updateData.showInUnder1000 = parseBool(req.body.showInUnder1000)
    if (req.body.showInKundan    !== undefined) updateData.showInKundan    = parseBool(req.body.showInKundan)
    if (req.body.showInBridalSet !== undefined) updateData.showInBridalSet = parseBool(req.body.showInBridalSet)
    // ✅ NEW
    if (req.body.showInPartyWear !== undefined) updateData.showInPartyWear = parseBool(req.body.showInPartyWear)

    if (req.body.sizes)           updateData.sizes           = parseJSONField(req.body.sizes,           [])
    if (req.body.colors)          updateData.colors          = parseJSONField(req.body.colors,          [])
    if (req.body.longDescription) updateData.longDescription = parseJSONField(req.body.longDescription, {})

    var existingImagesFromFE = [null, null, null, null]
    if (req.body.existingImages) {
      var parsedImgs = parseJSONField(req.body.existingImages, [])
      if (Array.isArray(parsedImgs)) existingImagesFromFE = parsedImgs
    }

    var finalImages    = [null, null, null, null]
    var imagesToDelete = []

    for (var i = 0; i < 4; i++) {
      if (existingImagesFromFE[i]) finalImages[i] = existingImagesFromFE[i]
    }

    if (req.files && Object.keys(req.files).length) {
      for (var j = 0; j < 4; j++) {
        var key = 'image' + (j + 1)
        if (req.files[key] && req.files[key][0]) {
          if (existingProduct.images && existingProduct.images[j]) {
            imagesToDelete.push(existingProduct.images[j])
          }
          try {
            var up = await uploadToCloudinary(req.files[key][0].path, 'rb-jewellery/products')
            if (up && up.url) finalImages[j] = up.url
          } catch (e) { console.error('upload error slot', j, e.message) }
        }
      }
      cleanTempFiles(req.files)
    }

    for (var k = 0; k < 4; k++) {
      var old = existingProduct.images ? existingProduct.images[k] : null
      if (old && !existingImagesFromFE[k] && !finalImages[k]) imagesToDelete.push(old)
    }

    var cleanImages = finalImages.filter(function (x) { return x !== null })
    if (!cleanImages.length) {
      return res.status(400).json({ success: false, message: 'At least one image is required' })
    }
    updateData.images = cleanImages

    if (imagesToDelete.length) await deleteCloudinaryImages(imagesToDelete)

    var updatedProduct = await productModel.findByIdAndUpdate(id, updateData)
    if (!updatedProduct) {
      return res.status(500).json({ success: false, message: 'Failed to update product' })
    }

    return res.json({
      success: true,
      message: 'Product Updated Successfully',
      product: updatedProduct,
    })
  } catch (error) {
    cleanTempFiles(req.files)
    console.error('updateProduct error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to update product') })
  }
}

// ============ LIST PRODUCTS ============
var listProducts = async function (req, res) {
  try {
    var products = await productModel.find({})
    return res.json({ success: true, products: products })
  } catch (error) {
    console.error('listProducts error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to fetch products') })
  }
}

// ============ REMOVE PRODUCT ============
var removeProduct = async function (req, res) {
  try {
    var productId = req.body.id
    var product   = await productModel.findById(productId)
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' })
    await deleteCloudinaryImages(product.images)
    await productModel.findByIdAndDelete(productId)
    return res.json({ success: true, message: 'Product Removed' })
  } catch (error) {
    console.error('removeProduct error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to remove product') })
  }
}

// ============ SINGLE PRODUCT ============
var singleProduct = async function (req, res) {
  try {
    var product = await productModel.findById(req.params.id)
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' })
    return res.json({ success: true, product: product })
  } catch (error) {
    console.error('singleProduct error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to fetch product') })
  }
}

// ============ GET BY CATEGORY ============
var getProductsByCategory = async function (req, res) {
  try {
    var query = {}
    if (req.query.category)    query.category    = req.query.category
    if (req.query.subCategory) query.subCategory = req.query.subCategory
    var products = await productModel.find(query)
    if (req.query.limit) products = products.slice(0, parseInt(req.query.limit))
    return res.json({ success: true, products: products })
  } catch (error) {
    console.error('getProductsByCategory error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to fetch products') })
  }
}

// ============ GET FEATURED ============
var getFeaturedProducts = async function (req, res) {
  try {
    var type  = req.query.type
    var limit = parseInt(req.query.limit) || 10
    var query = {}
    if (type === 'bestseller') query.bestseller = true
    else if (type === 'newArrival') query.newArrival = true
    else if (type === 'featured')   query.featured   = true
    var products = await productModel.find(query)
    products     = products.slice(0, limit)
    return res.json({ success: true, products: products })
  } catch (error) {
    console.error('getFeaturedProducts error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to fetch products') })
  }
}

// ============ SEARCH ============
var searchProducts = async function (req, res) {
  try {
    var query = {}
    if (req.query.q) {
      query.$or = [
        { name:        { $regex: req.query.q, $options: 'i' } },
        { description: { $regex: req.query.q, $options: 'i' } },
      ]
    }
    if (req.query.category)    query.category    = req.query.category
    if (req.query.subCategory) query.subCategory = req.query.subCategory
    if (req.query.material)    query.material    = req.query.material
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {}
      if (req.query.minPrice) query.price.$gte = Number(req.query.minPrice)
      if (req.query.maxPrice) query.price.$lte = Number(req.query.maxPrice)
    }
    var products = await productModel.find(query)
    return res.json({ success: true, products: products })
  } catch (error) {
    console.error('searchProducts error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to search products') })
  }
}

// ============ LATEST IMAGES ============
var getLatestImages = async function (req, res) {
  try {
    var limit    = parseInt(req.query.limit) || 5
    var products = await productModel.find({ inStock: true })
    products     = products.slice(0, limit)
    var result   = products.map(function (p) {
      return {
        _id:         p.id || p._id,
        name:        p.name,
        description: p.description,
        images:      p.images,
        price:       p.price,
      }
    })
    return res.json({ success: true, products: result })
  } catch (error) {
    console.error('getLatestImages error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch latest images' })
  }
}

// ============ GET PAGE PRODUCTS ============
var getPageProducts = async function (req, res) {
  try {
    var page  = req.query.page
    var query = {}

    if      (page === 'necklaces')     query.showInNecklaces = true
    else if (page === 'bangles')       query.showInBangles   = true
    else if (page === 'under1000')     query.showInUnder1000 = true
    else if (page === 'kundan')        query.showInKundan    = true
    else if (page === 'bridalset')     query.showInBridalSet = true
    // ✅ NEW
    else if (page === 'partywear')     query.showInPartyWear = true

    var products = await productModel.find(query)
    return res.json({ success: true, products: products })
  } catch (error) {
    console.error('getPageProducts error:', error)
    return res.status(500).json({ success: false, message: getErrorMessage(error, 'Failed to fetch products') })
  }
}

export {
  addProduct, updateProduct, listProducts, removeProduct,
  singleProduct, getProductsByCategory, getFeaturedProducts,
  searchProducts, getLatestImages, getPageProducts,
}