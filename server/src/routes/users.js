const express = require('express');
const { User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const { serializeUser } = require('../utils/users');
const { recordAudit } = require('../utils/audit');
const validate = require('../utils/validate');

const router = express.Router();
const ROLES = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'];

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const role = req.query.role;

    if (role && !ROLES.includes(role)) {
      throw new HttpError(400, 'Invalid role filter');
    }

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ name: 1 })
      .limit(100);

    res.json({ data: users.map(serializeUser) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = validate.id(req.params.id, 'User id');
    const user = await User.findById(userId).select('-password_hash');

    if (!user) throw new HttpError(404, 'User not found');
    res.json({ data: serializeUser(user) });
  })
);

router.patch(
  '/:id/role',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const userId = validate.id(req.params.id, 'User id');
    const role = validate.oneOf(req.body.role, 'Role', ROLES);

    const user = await User.findById(userId);
    if (!user) throw new HttpError(404, 'User not found');

    if (String(user._id) === String(req.user.id)) {
      throw new HttpError(400, 'You cannot change your own role');
    }
    if (user.role === role) {
      return res.json({ data: serializeUser(user) });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    recordAudit({
      actorId: req.user.id,
      action: 'user.role_updated',
      entityType: 'user',
      entityId: String(user._id),
      details: { name: user.name, from: oldRole, to: role },
    });

    res.json({ data: serializeUser(user) });
  })
);

module.exports = router;
