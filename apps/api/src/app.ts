import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/env';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestId } from './middleware/requestId';

const app: Express = express();

// ── Request correlation ID (must be first) ──────────────────────────────────
app.use(requestId);

// ── Production Security headers ──────────────────────────────────────────────
app.disable('x-powered-by'); // Defense-in-depth (Helmet also removes it)
app.use(
  helmet({
    contentSecurityPolicy: false, // API server does not serve HTML pages directly
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// ── Prevent caching of API responses (security-sensitive data) ───────────────
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Required for HttpOnly cookie delivery
  })
);

// ── Cookie parser (required for HttpOnly refresh token) ───────────────────────
app.use(cookieParser());

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 handler (must come after all routes) ──────────────────────────────────
app.use(notFound);

// ── Centralized error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

export default app;
