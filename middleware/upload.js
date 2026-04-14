import multer from "multer";
import path from "path";
import fs from "fs";

// Temporary upload directory
var tempDir = path.join(process.cwd(), "temp");

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Store files temporarily before uploading to Cloudinary
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    var uniqueName = Date.now() + "-" + Math.random().toString(36).substring(7) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter for images only
var fileFilter = function(req, file, cb) {
  var allowedTypes = /jpeg|jpg|png|gif|webp/;
  var mimetype = allowedTypes.test(file.mimetype);
  var extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
};

// Multer upload configuration
var upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Helper to clean temp files
var cleanTempFile = function(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning temp file:', error);
  }
};

// Clean multiple temp files
var cleanTempFiles = function(files) {
  if (!files) return;
  
  if (Array.isArray(files)) {
    files.forEach(function(file) {
      cleanTempFile(file.path);
    });
  } else if (typeof files === 'object') {
    var keys = Object.keys(files);
    keys.forEach(function(key) {
      var fileArray = files[key];
      if (Array.isArray(fileArray)) {
        fileArray.forEach(function(file) {
          cleanTempFile(file.path);
        });
      }
    });
  }
};

export { cleanTempFile, cleanTempFiles };
export default upload;