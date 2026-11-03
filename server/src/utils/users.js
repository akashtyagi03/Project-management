const { User } = require('../models');

async function findUserById(userId) {
  return User.findById(userId).select('-password_hash');
}

async function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase() });
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at || user.createdAt,
  };
}

module.exports = { findUserById, findUserByEmail, serializeUser };
