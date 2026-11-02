const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDatabase } = require('../db');
const { HttpError } = require('../utils/http');

function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'groundwork',
  });
}

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Sign in to continue'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: 'groundwork' });
    const user = getDatabase()
      .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
      .get(payload.sub);

    if (!user) return next(new HttpError(401, 'Your session is no longer valid'));

    req.user = user;
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to do that'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole, signToken };
