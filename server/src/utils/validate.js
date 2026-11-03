const { HttpError } = require('./http');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(value, field, { min = 1, max = 255, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new HttpError(400, `${field} is required`);
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be text`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new HttpError(400, `${field} must be at least ${min} characters`);
  }
  if (trimmed.length > max) {
    throw new HttpError(400, `${field} must be ${max} characters or fewer`);
  }

  return trimmed;
}

function email(value) {
  const normalized = text(value, 'Email', { max: 160 }).toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return normalized;
}

function password(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }
  if (value.length > 72) {
    throw new HttpError(400, 'Password must be 72 characters or fewer');
  }
  return value;
}

function oneOf(value, field, allowed, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new HttpError(400, `${field} is required`);
  }
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function date(value, field, { optional = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new HttpError(400, `${field} is required`);
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new HttpError(400, `${field} must use the YYYY-MM-DD format`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} is not a valid date`);
  }
  return value;
}

const mongoose = require('mongoose');

function id(value, field) {
  if (!value || typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
    throw new HttpError(400, `${field} must be a valid id`);
  }
  return value;
}

function optionalId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return id(value, field);
}

function boolean(value) {
  return value === true || value === 'true' || value === '1';
}

module.exports = { text, email, password, oneOf, date, id, optionalId, boolean };
