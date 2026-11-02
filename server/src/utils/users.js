const PUBLIC_USER_FIELDS = 'id, name, email, role, created_at';

function findUserById(db, userId) {
  return db
    .prepare(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ?`)
    .get(userId);
}

function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

module.exports = { PUBLIC_USER_FIELDS, findUserById, findUserByEmail, serializeUser };
