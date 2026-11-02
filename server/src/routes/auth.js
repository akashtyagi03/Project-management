const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { getDatabase } = require('../db');
const { authenticate, signToken } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const validate = require('../utils/validate');
const { findUserByEmail, serializeUser } = require('../utils/users');
const { recordAudit } = require('../utils/audit');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const name = validate.text(req.body.name, 'Name', { min: 2, max: 80 });
    const email = validate.email(req.body.email);
    const password = validate.password(req.body.password);

    if (findUserByEmail(db, email)) {
      throw new HttpError(409, 'An account with that email already exists');
    }

    const isFirstUser = db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0;
    const role = isFirstUser ? 'ADMIN' : 'TEAM_MEMBER';
    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
      )
      .run(name, email, passwordHash, role);

    const user = db
      .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    recordAudit(db, {
      actorId: user.id,
      action: 'user.registered',
      entityType: 'user',
      entityId: user.id,
      details: { role },
    });

    res.status(201).json({ token: signToken(user), user: serializeUser(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const email = validate.email(req.body.email);

    if (typeof req.body.password !== 'string' || !req.body.password) {
      throw new HttpError(400, 'Password is required');
    }

    const record = findUserByEmail(db, email);
    const passwordOk = record
      ? await bcrypt.compare(req.body.password, record.password_hash)
      : false;

    if (!record || !passwordOk) {
      throw new HttpError(401, 'Email or password is incorrect');
    }

    const user = {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      created_at: record.created_at,
    };

    res.json({ token: signToken(user), user: serializeUser(user) });
  })
);

router.get('/me', authenticate, (req, res) => {
  const user = getDatabase()
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({ user: serializeUser(user) });
});

module.exports = router;
