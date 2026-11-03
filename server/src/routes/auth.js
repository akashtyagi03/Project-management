const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { User } = require('../models');
const { authenticate, signToken } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const validate = require('../utils/validate');
const { serializeUser } = require('../utils/users');
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

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const name = validate.text(req.body.name, 'Name', { min: 2, max: 80 });
  const email = validate.email(req.body.email);
  const password = validate.password(req.body.password);

  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, 'An account with that email already exists');
  }

  const count = await User.countDocuments();
  const role = count === 0 ? 'ADMIN' : 'TEAM_MEMBER';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email,
    password_hash: passwordHash,
    role,
  });

  recordAudit({
    actorId: user._id,
    action: 'user.registered',
    entityType: 'user',
    entityId: String(user._id),
    details: { role },
  });

  res.status(201).json({ token: signToken(user), user: serializeUser(user) });
})
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const email = validate.email(req.body.email);

    if (typeof req.body.password !== 'string' || !req.body.password) {
      throw new HttpError(400, 'Password is required');
    }

    const user = await User.findOne({ email });
    const passwordOk = user ? await bcrypt.compare(req.body.password, user.password_hash) : false;

    if (!user || !passwordOk) {
      throw new HttpError(401, 'Email or password is incorrect');
    }

    res.json({ token: signToken(user), user: serializeUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password_hash');
    res.json({ user: serializeUser(user) });
  })
);

module.exports = router;
