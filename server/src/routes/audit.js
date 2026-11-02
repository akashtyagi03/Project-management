const express = require('express');
const { getDatabase } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { HttpError, pagination, paginationMeta } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

function parseDetails(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

router.get('/', (req, res) => {
  const db = getDatabase();
  const { page, limit, offset } = pagination(req.query, 15);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const entityType = req.query.entityType;

  if (entityType && !['project', 'task', 'user'].includes(entityType)) {
    throw new HttpError(400, 'Invalid entity filter');
  }

  const conditions = [];
  const params = { userId: req.user.id, limit, offset };

  if (q) {
    conditions.push('(a.action LIKE @search OR u.name LIKE @search OR a.details LIKE @search)');
    params.search = `%${q}%`;
  }
  if (entityType) {
    conditions.push('a.entity_type = @entityType');
    params.entityType = entityType;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const logs = db
    .prepare(`
      SELECT
        a.*,
        u.name AS actor_name,
        u.email AS actor_email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT @limit OFFSET @offset
    `)
    .all(params)
    .map((log) => ({ ...log, details: parseDetails(log.details) }));

  const total = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ${where}
    `)
    .get(params).count;

  res.json({
    data: logs,
    meta: paginationMeta(page, limit, total),
  });
});

module.exports = router;
