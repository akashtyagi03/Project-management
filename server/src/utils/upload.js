const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { HttpError } = require('./http');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.txt', '.md', '.csv',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip',
]);

fs.mkdirSync(config.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, config.uploadsDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return callback(
        new HttpError(
          400,
          'That file type is not supported. Use an image, PDF, Office document, text file, or zip.'
        )
      );
    }
    callback(null, true);
  },
});

function removeUpload(storedName) {
  if (!storedName) return;
  const filePath = path.join(config.uploadsDir, path.basename(storedName));
  fs.unlink(filePath, () => {});
}

module.exports = { upload, removeUpload, ALLOWED_EXTENSIONS };
