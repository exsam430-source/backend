// controllers/cartController.js
import Cart from "../models/Cart.js";

// Helper: Convert flat cart array to nested format for frontend
const convertToNestedFormat = (cartItems) => {
  const cartData = {};
  
  if (!cartItems || !Array.isArray(cartItems)) {
    return cartData;
  }
  
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    const itemId = String(item.productId);
    const sizeKey = item.size || "defaultSize";
    const colorKey = item.color || "defaultColor";
    
    if (!cartData[itemId]) {
      cartData[itemId] = {};
    }
    if (!cartData[itemId][sizeKey]) {
      cartData[itemId][sizeKey] = {};
    }
    
    cartData[itemId][sizeKey][colorKey] = {
      quantity: parseInt(item.quantity) || 1
    };
  }
  
  return cartData;
};

// Add to Cart
const addToCart = async (req, res) => {
  try {
    const { userId, itemId, size, color } = req.body;

    console.log('=== ADD TO CART ===');
    console.log('userId:', userId);
    console.log('itemId:', itemId);
    console.log('size:', size);
    console.log('color:', color);

    if (!userId || !itemId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID and Item ID are required" 
      });
    }

    const sizeKey = size || "defaultSize";
    const colorKey = color || "defaultColor";

    // Use Cart model to add item
    const result = await Cart.add(userId, itemId, 1, sizeKey, colorKey);
    
    console.log('Cart.add result:', result);

    res.json({ success: true, message: "Added To Cart" });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Cart
const updateCart = async (req, res) => {
  try {
    const { userId, itemId, size, color, quantity } = req.body;

    console.log('=== UPDATE CART ===');
    console.log('userId:', userId);
    console.log('itemId:', itemId);
    console.log('size:', size);
    console.log('color:', color);
    console.log('quantity:', quantity);

    if (!userId || !itemId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID and Item ID are required" 
      });
    }

    const sizeKey = size || "defaultSize";
    const colorKey = color || "defaultColor";
    const qty = parseInt(quantity) || 0;

    // Use Cart model to update quantity
    await Cart.updateQuantity(userId, itemId, qty, sizeKey, colorKey);

    res.json({ success: true, message: "Cart updated" });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Cart
const getUserCart = async (req, res) => {
  try {
    const { userId } = req.body;

    console.log('=== GET USER CART ===');
    console.log('userId:', userId);

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }

    // Get cart items from Cart model
    const cartItems = await Cart.findByUser(userId);

    console.log('Cart items from DB:', cartItems.length);
    console.log('Cart items:', JSON.stringify(cartItems, null, 2));

    // Convert to nested format that frontend expects
    const cartData = convertToNestedFormat(cartItems);

    console.log('Converted cart data:', JSON.stringify(cartData));

    res.json({ success: true, cartData: cartData });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear Cart
const clearCart = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }

    await Cart.clear(userId);

    res.json({ success: true, message: "Cart cleared" });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export { addToCart, updateCart, getUserCart, clearCart };