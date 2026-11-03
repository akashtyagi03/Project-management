const express = require('express');
const { AuditLog } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler, HttpError, pagination, paginationMeta } = require('../utils/http');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, offset } = pagination(req.query, 15);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const entityType = req.query.entityType;

  if (entityType && !['project', 'task', 'user'].includes(entityType)) {
    throw new HttpError(400, 'Invalid entity filter');
  }

  const filter = {};
  if (entityType) {
    filter.entity_type = entityType;
  }
  if (q) {
    filter.$or = [
      { action: { $regex: q, $options: 'i' } },
      { entity_id: { $regex: q, $options: 'i' } },
    ];
  }

  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter)
    .populate('actor_id', 'name email')
    .sort({ created_at: -1, _id: -1 })
    .skip(offset)
    .limit(limit);

  const formattedLogs = logs.map((log) => ({
    id: String(log._id),
    actor_id: log.actor_id ? String(log.actor_id._id) : null,
    actor_name: log.actor_id ? log.actor_id.name : null,
    actor_email: log.actor_id ? log.actor_id.email : null,
    action: log.action,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    details: log.details,
    created_at: log.created_at,
  }));

  res.json({
    data: formattedLogs,
    meta: paginationMeta(page, limit, total),
  });
})
);

module.exports = router;
