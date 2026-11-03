const { AuditLog } = require('../models');

async function recordAudit(firstArg, secondArg) {
  const options = secondArg || firstArg;
  if (!options) return;

  const { actorId, action, entityType, entityId, details } = options;

  try {
    await AuditLog.create({
      actor_id: actorId || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      details: details || null,
    });
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
}

module.exports = { recordAudit };
