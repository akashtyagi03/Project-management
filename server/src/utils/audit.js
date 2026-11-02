function recordAudit(db, { actorId, action, entityType, entityId, details }) {
  db.prepare(`
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    actorId || null,
    action,
    entityType,
    entityId ?? null,
    details ? JSON.stringify(details) : null
  );
}

module.exports = { recordAudit };
