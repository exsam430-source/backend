import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// MySQL Database
import { testConnection, initTables } from "./config/database.js";

// Routes
import userRouter        from "./routes/userRouter.js";
import productRouter     from "./routes/productRoute.js";
import cartRouter        from "./routes/cartRoute.js";
import goldPriceRouter   from "./routes/goldPriceRoute.js";
import orderRouter       from "./routes/orderRoute.js";
import newsletterRoutes  from "./routes/newsletterRoutes.js";
import profileRoutes     from "./routes/profileRoutes.js";
import reviewsRoutes     from "./routes/reviewsRoutes.js";
import analyticsRoutes   from "./routes/analyticsRoutes.js";
import returnRouter      from "./routes/returnRoute.js";
import customOrderRouter from "./routes/customOrderRoute.js";
import whatsappRouter    from "./routes/whatsappRoute.js";
import settingsRouter    from "./routes/settingsRoute.js";

// Cloudinary
import ConnectCloud from "./config/cloudinary.js";

var app  = express();
var PORT = process.env.PORT || 3000;

// ── Site Configuration ──
var SITE_DOMAIN = process.env.SITE_DOMAIN || "meerabluxejewellers.rbjewellry.pk";
var SITE_NAME   = process.env.STORE_NAME  || "Meera Bluxe Jewellers";
var SITE_URL    = "https://" + SITE_DOMAIN;

const __filename         = fileURLToPath(import.meta.url);
const __dirname          = path.dirname(__filename);

// ── Frontend Path Configuration ──
// In cPanel, frontend files are usually placed ONE level up from backend folder
// Structure: meerabluxejewellers.rbjewellry.pk/
//            ├── index.html        ← frontend
//            ├── assets/
//            └── backend/          ← this server.js is here
//                ├── server.js
//                └── ...

const frontendPath      = path.join(__dirname, "..");        // Parent folder
const frontendIndexPath = path.join(frontendPath, "index.html");

// Fallback to old "frontend-dist" folder inside backend (if you prefer that structure)
const altFrontendPath      = path.join(__dirname, "frontend-dist");
const altFrontendIndexPath = path.join(altFrontendPath, "index.html");

// Pick whichever exists
var actualFrontendPath      = frontendPath;
var actualFrontendIndexPath = frontendIndexPath;

if (!fs.existsSync(frontendIndexPath) && fs.existsSync(altFrontendIndexPath)) {
  actualFrontendPath      = altFrontendPath;
  actualFrontendIndexPath = altFrontendIndexPath;
}

console.log("=================================");
console.log("Backend - " + SITE_NAME);
console.log("Environment :", process.env.NODE_ENV || "production");
console.log("Node        :", process.version);
console.log("Port        :", PORT);
console.log("Site Domain :", SITE_DOMAIN);
console.log("Site URL    :", SITE_URL);
console.log("Frontend    :", actualFrontendPath);
console.log("Index found :", fs.existsSync(actualFrontendIndexPath));
console.log("=================================");

// ── Security Middleware ──
app.use(
  helmet({
    contentSecurityPolicy:     false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ── CORS ──
var allowedOrigins = [
  // Subdomain (production)
  "https://meerabluxejewellers.rbjewellry.pk",
  "http://meerabluxejewellers.rbjewellry.pk",

  // Main domain
  "https://rbjewellry.pk",
  "https://www.rbjewellry.pk",
  "http://rbjewellry.pk",
  "http://www.rbjewellry.pk",

  // Local development
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, postman)
      if (!origin) {
        return callback(null, true);
      }

      var isAllowed = allowedOrigins.some(function (allowedOrigin) {
        return origin === allowedOrigin;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      // Allow any subdomain of rbjewellry.pk
      if (/^https?:\/\/[a-z0-9-]+\.rbjewellry\.pk$/i.test(origin)) {
        return callback(null, true);
      }

      console.warn("CORS blocked origin:", origin);
      return callback(null, false);
    },
    credentials:    true,
    methods:        ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// ── Body Parsers ──
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ── Sanitization ──
app.use(function (req, res, next) {
  if (req.body && typeof req.body === "object") {
    var sanitize = function (obj) {
      if (!obj || typeof obj !== "object") return obj;
      var clean = Array.isArray(obj) ? [] : {};
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (!key.startsWith("$") && !key.includes(".")) {
            clean[key] =
              typeof obj[key] === "object" ? sanitize(obj[key]) : obj[key];
          }
        }
      }
      return clean;
    };
    req.body = sanitize(req.body);
  }
  next();
});

// ── Database Status ──
var dbConnected = false;

// ── API Root ──
app.get("/api", function (req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    success:      true,
    status:       "running",
    message:      SITE_NAME + " API - MySQL",
    site:         SITE_NAME,
    domain:       SITE_DOMAIN,
    url:          SITE_URL,
    version:      "2.0.0",
    database:     dbConnected ? "connected" : "disconnected",
    databaseType: "MySQL",
    environment:  process.env.NODE_ENV || "production",
    timestamp:    new Date().toISOString(),
    uptime:       Math.floor(process.uptime()) + "s",
  });
});

// ── Health Check ──
app.get("/api/health", function (req, res) {
  testConnection()
    .then(function (currentDbStatus) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).json({
        success:      true,
        status:       "healthy",
        site:         SITE_NAME,
        domain:       SITE_DOMAIN,
        database:     currentDbStatus ? "connected" : "disconnected",
        databaseType: "MySQL",
        host:         process.env.DB_HOST || "localhost",
        uptime:       Math.floor(process.uptime()),
        memory:       Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        timestamp:    new Date().toISOString(),
      });
    })
    .catch(function (err) {
      res.status(500).json({
        success:  false,
        status:   "error",
        database: "disconnected",
        message:  err.message,
      });
    });
});

// ── API Routes ──
app.use("/api/user",         userRouter);
app.use("/api/product",      productRouter);
app.use("/api/cart",         cartRouter);
app.use("/api/order",        orderRouter);
app.use("/api/newsletter",   newsletterRoutes);
app.use("/api/profile",      profileRoutes);
app.use("/api/reviews",      reviewsRoutes);
app.use("/api/analytics",    analyticsRoutes);
app.use("/api/return",       returnRouter);
app.use("/api/custom-order", customOrderRouter);
app.use("/api/whatsapp",     whatsappRouter);
app.use("/api/settings",     settingsRouter);
app.use("/api/gold-price",   goldPriceRouter);

// ── Serve Frontend Build ──
if (process.env.NODE_ENV === "production") {
  // Serve static files from frontend folder
  app.use(express.static(actualFrontendPath, {
    maxAge:    "1d",
    etag:      true,
    lastModified: true,
  }));

  // Home route
  app.get("/", function (req, res) {
    if (fs.existsSync(actualFrontendIndexPath)) {
      return res.sendFile(actualFrontendIndexPath);
    }

    return res.status(500).json({
      success: false,
      message: "Frontend build not found at: " + actualFrontendIndexPath,
      hint:    "Upload your React build files to the frontend folder",
    });
  });

  // React Router - all non-API routes serve index.html
  app.get(/^\/(?!api).*/, function (req, res) {
    if (fs.existsSync(actualFrontendIndexPath)) {
      return res.sendFile(actualFrontendIndexPath);
    }

    return res.status(500).json({
      success: false,
      message: "Frontend build not found at: " + actualFrontendIndexPath,
    });
  });
}

// ── 404 Handler ──
app.use(function (req, res) {
  res.status(404).json({
    success: false,
    message: "Route " + req.originalUrl + " not found",
    site:    SITE_NAME,
  });
});

// ── Error Handler ──
app.use(function (err, req, res, next) {
  console.error("Error:", err.message);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large",
    });
  }

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(400).json({
      success: false,
      message: "Duplicate entry exists",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Server error"
        : err.message,
  });
});

// ── Start Server ──
var startServer = function () {
  console.log("Connecting to MySQL database...");

  testConnection()
    .then(function (connected) {
      dbConnected = connected;

      if (dbConnected) {
        console.log("✅ Database connected!");
        return initTables();
      } else {
        console.log("⚠️  Server continuing without database");
        return Promise.resolve();
      }
    })
    .then(function () {
      try {
        ConnectCloud();
        console.log("✅ Cloudinary configured");
      } catch (cloudErr) {
        console.warn("⚠️  Cloudinary warning:", cloudErr.message);
      }
    })
    .catch(function (err) {
      console.error("❌ Startup error:", err.message);
    })
    .finally(function () {
      var server = app.listen(PORT, "0.0.0.0", function () {
        console.log("=================================");
        console.log("✅ " + SITE_NAME + " - Server Running!");
        console.log("🌐 URL     :", SITE_URL);
        console.log("🚀 Port    :", PORT);
        console.log("💾 Database:", dbConnected ? "Connected" : "Disconnected");
        console.log("=================================");
      });

      server.on("error", function (error) {
        console.error("❌ Server error:", error.message);
        process.exit(1);
      });
    });
};

startServer();