const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const yaml = require('yaml');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const { apiNotFound, errorHandler } = require('./middleware/error');

const app = express();

// Security and utility middleware
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        config.clientOrigins.includes('*') ||
        config.clientOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);
app.use(express.json({ limit: '2mb' }));

if (config.env !== 'test') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Project Management API is running',
    timestamp: new Date().toISOString(),
  });
});

// Ensure database connection for API routes (essential for serverless environments)
const { openDatabase } = require('./db');
const { HttpError } = require('./utils/http');

app.use('/api', async (req, _res, next) => {
  if (req.path === '/health' || req.path === '/docs') return next();
  try {
    await openDatabase();
    next();
  } catch (error) {
    console.error(`[DB] Connection failed for ${req.method} ${req.originalUrl}:`, error.message);
    next(new HttpError(500, 'Database connection error', error.message));
  }
});

// Application API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/audit', require('./routes/audit'));

// Interactive Swagger API documentation
const openApiPath = path.resolve(__dirname, '../../docs/openapi.yaml');
if (fs.existsSync(openApiPath)) {
  const openApiDocument = yaml.parse(fs.readFileSync(openApiPath, 'utf8'));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Project Management API Docs',
      swaggerOptions: { persistAuthorization: true },
    })
  );
}

// 404 handler for API routes
app.use('/api', apiNotFound);

// Serve static build in production if available
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      name: 'Project Management API',
      message: 'API is running. Start the frontend client with npm run dev.',
      docs: '/api/docs',
    });
  });
}

// Global error handler
app.use(errorHandler);

module.exports = app;
