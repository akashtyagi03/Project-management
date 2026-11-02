const path = require('path');
const dotenv = require('dotenv');

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');

dotenv.config({ path: path.join(repoRoot, '.env') });

function resolvePath(value, fallback) {
  if (!value) return fallback;
  if (value === ':memory:') return value;
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'groundwork-local-dev-secret';

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

module.exports = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT) || 4000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  dbPath: resolvePath(process.env.DB_PATH, path.join(serverRoot, 'data', 'groundwork.db')),
  uploadsDir: resolvePath(process.env.UPLOADS_DIR, path.join(serverRoot, 'uploads')),
  seedDemo: process.env.SEED_DEMO !== 'false',
  maxUploadBytes: 10 * 1024 * 1024,
};
