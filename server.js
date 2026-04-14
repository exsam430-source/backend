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
import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import reviewsRoutes from "./routes/reviewsRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import returnRouter from "./routes/returnRoute.js";
import customOrderRouter from "./routes/customOrderRoute.js";
import whatsappRouter from "./routes/whatsappRoute.js";
import settingsRouter from "./routes/settingsRoute.js";

// Cloudinary
import ConnectCloud from "./config/cloudinary.js";

var app = express();
var PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "frontend-dist");
const frontendIndexPath = path.join(frontendPath, "index.html");

console.log("=================================");
console.log("RB Jewellery Backend - MySQL");
console.log("Environment:", process.env.NODE_ENV || "production");
console.log("Node:", process.version);
console.log("Port:", PORT);
console.log("Frontend path:", frontendPath);
console.log("Frontend index exists:", fs.existsSync(frontendIndexPath));
console.log("=================================");

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CORS
var allowedOrigins = [
  "https://rbjewellry.pk",
  "https://www.rbjewellry.pk",
  "http://rbjewellry.pk",
  "http://www.rbjewellry.pk",
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      var isAllowed = allowedOrigins.some(function (allowedOrigin) {
        return origin === allowedOrigin;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsers
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Sanitization
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

// Database status
var dbConnected = false;

// API root
app.get("/api", function (req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    success: true,
    status: "running",
    message: "RB Jewellery API - MySQL Version",
    version: "2.0.0",
    database: dbConnected ? "connected" : "disconnected",
    databaseType: "MySQL",
    environment: process.env.NODE_ENV || "production",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// Health check
app.get("/api/health", function (req, res) {
  testConnection()
    .then(function (currentDbStatus) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.status(200).json({
        success: true,
        status: "healthy",
        database: currentDbStatus ? "connected" : "disconnected",
        databaseType: "MySQL",
        host: process.env.DB_HOST || "localhost",
        uptime: Math.floor(process.uptime()),
        memory:
          Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        timestamp: new Date().toISOString(),
      });
    })
    .catch(function (err) {
      res.status(500).json({
        success: false,
        status: "error",
        database: "disconnected",
        message: err.message,
      });
    });
});

// API Routes
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/return", returnRouter);
app.use("/api/custom-order", customOrderRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/settings", settingsRouter);

// Serve frontend build
if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendPath));

  // Home route
  app.get("/", function (req, res) {
    if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }

    return res.status(500).json({
      success: false,
      message: "Frontend build not found. index.html is missing.",
    });
  });

  // React routes except /api/*
  app.get(/^\/(?!api).*/, function (req, res) {
    if (fs.existsSync(frontendIndexPath)) {
      return res.sendFile(frontendIndexPath);
    }

    return res.status(500).json({
      success: false,
      message: "Frontend build not found. index.html is missing.",
    });
  });
}

// 404 handler
app.use(function (req, res) {
  res.status(404).json({
    success: false,
    message: "Route " + req.originalUrl + " not found",
  });
});

// Error handler
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
      process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Start server
var startServer = function () {
  console.log("Connecting to MySQL database...");

  testConnection()
    .then(function (connected) {
      dbConnected = connected;

      if (dbConnected) {
        console.log("Database connected!");
        return initTables();
      } else {
        console.log("Server continuing without database");
        return Promise.resolve();
      }
    })
    .then(function () {
      try {
        ConnectCloud();
        console.log("Cloudinary configured");
      } catch (cloudErr) {
        console.warn("Cloudinary warning:", cloudErr.message);
      }
    })
    .catch(function (err) {
      console.error("Startup error:", err.message);
    })
    .finally(function () {
      var server = app.listen(PORT, "0.0.0.0", function () {
        console.log("=================================");
        console.log("Server running successfully!");
        console.log("URL: https://rbjewellry.pk");
        console.log("Database:", dbConnected ? "Connected" : "Disconnected");
        console.log("=================================");
      });

      server.on("error", function (error) {
        console.error("Server error:", error.message);
        process.exit(1);
      });
    });
};

startServer();