const path = require('path');
const multer = require('multer');
const { UPLOAD_DIR, ensureUploadDir } = require('../config/paths');

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // ไม่เกิน 10 MB ต่อไฟล์
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error('รองรับเฉพาะไฟล์ JPG, PNG, GIF, WEBP หรือ PDF'));
    }
    cb(null, true);
  }
});

module.exports = { upload, UPLOAD_DIR };
