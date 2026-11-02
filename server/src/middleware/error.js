const multer = require('multer');
const config = require('../config');
const { HttpError } = require('../utils/http');

function apiNotFound(_req, res) {
  res.status(404).json({ error: 'API route not found' });
}

function errorHandler(error, req, res, _next) {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'The file is too large. The limit is 10 MB.'
        : 'The file could not be uploaded';
    return res.status(400).json({ error: message });
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const status = error.status || 500;
  const body = {
    error: status >= 500 ? 'Something went wrong on our side' : error.message,
  };

  if (error.details) body.details = error.details;

  if (status >= 500 && config.env !== 'test') {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  return res.status(status).json(body);
}

module.exports = { apiNotFound, errorHandler, HttpError };
