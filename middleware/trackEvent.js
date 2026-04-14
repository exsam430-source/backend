import EventModel from "../models/eventModel.js";

var trackEvent = function(type) {
  return function(req, res, next) {
    var productId = null;
    var userId = null;
    var ip = "";
    var userAgent = "";

    // Get productId
    if (req.params && req.params.id) {
      productId = req.params.id;
    } else if (req.body && req.body.productId) {
      productId = req.body.productId;
    }

    // Get userId
    if (req.user) {
      if (req.user.id) {
        userId = req.user.id;
      } else if (req.user._id) {
        userId = req.user._id;
      }
    }

    // Get IP
    if (req.ip) {
      ip = req.ip;
    }

    // Get User Agent
    if (req.get) {
      var ua = req.get("user-agent");
      if (ua) {
        userAgent = ua;
      }
    }

    // If no productId, skip tracking
    if (!productId) {
      return next();
    }

    // Create event data
    var eventData = {
      type: type,
      productId: productId,
      userId: userId,
      ip: ip,
      userAgent: userAgent
    };

    // Track the event
    if (type === "view") {
      // For views, check if recent view exists first
      EventModel.findOne({ type: "view", productId: productId })
        .then(function(recentView) {
          if (!recentView) {
            return EventModel.create(eventData);
          }
          return null;
        })
        .then(function() {
          next();
        })
        .catch(function(err) {
          console.error("Track event error:", err);
          next();
        });
    } else {
      // For other events, just create
      EventModel.create(eventData)
        .then(function() {
          next();
        })
        .catch(function(err) {
          console.error("Track event error:", err);
          next();
        });
    }
  };
};

export { trackEvent };