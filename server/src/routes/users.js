const express = require('express');
const { getDatabase } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError } = require('../utils/http');
const { serializeUser } = require('../utils/users');
const { recordAudit } = require('../utils/audit');
const validate = require('../utils/validate');

const router = express.Router();
const ROLES = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'];

router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDatabase();
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const role = req.query.role;

  if (role && !ROLES.includes(role)) {
    throw new HttpError(400, 'Invalid role filter');
  }

  const conditions = [];
  const params = {};

  if (q) {
    conditions.push('(u.name LIKE @search OR u.email LIKE @search)');
    params.search = `%${q}%`;
  }
  if (role) {
    conditions.push('u.role = @role');
    params.role = role;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const users = db
    .prepare(`
      SELECT u.id, u.name, u.email, u.role, u.created_at
      FROM users u
      ${where}
      ORDER BY u.name COLLATE NOCASE ASC
      LIMIT 100
    `)
    .all(params);

  res.json({ data: users.map(serializeUser) });
});

router.get('/:id', (req, res) => {
  const db = getDatabase();
  const userId = validate.id(req.params.id, 'User id');
  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(userId);

  if (!user) throw new HttpError(404, 'User not found');
  res.json({ data: serializeUser(user) });
});

router.patch('/:id/role', requireRole('ADMIN'), (req, res) => {
  const db = getDatabase();
  const userId = validate.id(req.params.id, 'User id');
  const role = validate.oneOf(req.body.role, 'Role', ROLES);

  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(userId);

  if (!user) throw new HttpError(404, 'User not found');
  if (user.id === req.user.id) {
    throw new HttpError(400, 'You cannot change your own role');
  }
  if (user.role === role) {
    return res.json({ data: serializeUser(user) });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

  recordAudit(db, {
    actorId: req.user.id,
    action: 'user.role_updated',
    entityType: 'user',
    entityId: user.id,
    details: { name: user.name, from: user.role, to: role },
  });

  res.json({ data: serializeUser({ ...user, role }) });
});

module.exports = router;
