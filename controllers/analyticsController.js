import EventModel from "../models/eventModel.js";
import OrderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

// Date range helper
const rangeToStartDate = (range) => {
  const now = new Date();
  const rangeStr = (range || "1w").toLowerCase();
  
  if (rangeStr === "1d") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (rangeStr === "7d" || rangeStr === "1w") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (rangeStr === "30d" || rangeStr === "1m") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (rangeStr === "90d" || rangeStr === "3m") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
};

// Create Event
const createEvent = async (req, res) => {
  try {
    const {
      userId,
      type,
      productId,
      meta,
      ip,
      userAgent
    } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: "type required" });
    }

    const ev = await EventModel.create({
      userId: userId || null,
      type: type,
      productId: productId || null,
      meta: meta || {},
      ip: ip || "",
      userAgent: userAgent || ""
    });

    res.json({ success: true, event: ev });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Total Users
const totalUsers = async (req, res) => {
  try {
    const count = await userModel.countDocuments();
    res.json({ success: true, totalUsers: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Total Orders
const totalOrders = async (req, res) => {
  try {
    const count = await OrderModel.countDocuments();
    res.json({ success: true, totalOrders: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Unique Visitors
const visitors = async (req, res) => {
  try {
    const range = req.query.range || "1w";
    const start = rangeToStartDate(range);

    const eventVisitors = await EventModel.aggregate([
      { $match: { createdAt: { $gte: start }, type: { $in: ["view", "click"] } } },
      {
        $project: {
          visitor: {
            $cond: [
              { $ifNull: ["$userId", false] },
              { $toString: "$userId" },
              "$ip"
            ]
          }
        }
      },
      { $group: { _id: "$visitor" } }
    ]);

    const orderVisitors = await OrderModel.aggregate([
      { $group: { _id: "$userId" } }
    ]);

    const uniqueSet = new Set();
    for (let i = 0; i < eventVisitors.length; i++) {
      uniqueSet.add(eventVisitors[i]._id);
    }
    for (let i = 0; i < orderVisitors.length; i++) {
      uniqueSet.add(orderVisitors[i]._id);
    }

    res.json({ success: true, uniqueVisitors: uniqueSet.size });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Top Products
const topProducts = async (req, res) => {
  try {
    const range = req.query.range || "1m";
    const limit = parseInt(req.query.limit) || 10;
    const start = rangeToStartDate(range);

    const agg = await OrderModel.aggregate([
      { $unwind: "$items" },
      { $match: { date: { $gte: start.getTime() } } },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQty: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: limit }
    ]);

    res.json({ success: true, results: agg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Overall Stats
const overallStats = async (req, res) => {
  try {
    const events = await EventModel.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    const orders = await OrderModel.aggregate([
      { $unwind: "$items" },
      { $group: { _id: null, count: { $sum: "$items.quantity" } } }
    ]);

    let viewCount = 0;
    let addToCartCount = 0;
    let purchaseFromEvents = 0;

    for (let i = 0; i < events.length; i++) {
      if (events[i]._id === "view") viewCount = events[i].count;
      if (events[i]._id === "add_to_cart") addToCartCount = events[i].count;
      if (events[i]._id === "purchase") purchaseFromEvents = events[i].count;
    }

    const fromOrders = orders[0] ? orders[0].count : 0;

    res.json({
      success: true,
      views: viewCount,
      addToCarts: addToCartCount,
      purchases: purchaseFromEvents + fromOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Overall Conversion
const overallConversion = async (req, res) => {
  try {
    const viewersAgg = await EventModel.aggregate([
      { $match: { type: "view" } },
      {
        $project: {
          visitor: {
            $cond: [
              { $ifNull: ["$userId", false] },
              { $toString: "$userId" },
              "$ip"
            ]
          }
        }
      },
      { $group: { _id: "$visitor" } }
    ]);

    const purchasersAgg = await OrderModel.aggregate([
      { $group: { _id: "$userId" } }
    ]);

    const viewers = viewersAgg.length;
    const purchasers = purchasersAgg.length;
    const rate = viewers > 0 ? (purchasers / viewers) * 100 : 0;

    res.json({ success: true, viewers: viewers, purchasers: purchasers, conversionRate: rate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Events by Date
const eventsByDate = async (req, res) => {
  try {
    const range = req.query.range || "7d";
    const start = rangeToStartDate(range);

    const events = await EventModel.find({ 
      createdAt: { $gte: start } 
    });

    if (!events || events.length === 0) {
      return res.json({ 
        success: true, 
        events: [],
        message: "No events found for this date range" 
      });
    }

    res.json({ success: true, events: events });
  } catch (err) {
    console.error("Error fetching events by date:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export {
  createEvent,
  totalUsers,
  totalOrders,
  visitors,
  topProducts,
  overallStats,
  overallConversion,
  eventsByDate
};