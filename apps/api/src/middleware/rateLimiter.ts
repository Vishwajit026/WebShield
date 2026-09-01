import rateLimit from 'express-rate-limit';
import { Errors } from '../utils/errors';

/**
 * Rate limiters for WebShield endpoints.
 * In development these are intentionally generous to allow normal testing.
 * Tighten for production via environment variables.
 */

const isDev = process.env.NODE_ENV === 'development';

/**
 * Strict limiter for login/register — brute-force protection.
 * Dev: 30 attempts per 15 min window
 * Prod: 10 attempts per 15 min window
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 30 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: Errors.tooManyRequests().message,
    },
  },
  skipSuccessfulRequests: false,
});

/**
 * Refresh token limiter — prevent refresh abuse.
 * Dev: 60 per 15 min | Prod: 20 per 15 min
 */
export const refreshRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 60 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: Errors.tooManyRequests().message,
    },
  },
});

/**
 * Scan creation limiter — prevent scanning flooding.
 * Dev: 30 per 10 min | Prod: 10 per 10 min
 */
export const scanRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 30 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many scans initiated. Please wait a few minutes before starting another scan.',
    },
  },
});

/**
 * Report generation limiter — prevent CPU/memory exhaustion.
 * Dev: 30 per 10 min | Prod: 10 per 10 min
 */
export const reportRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: isDev ? 30 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many report generation requests. Please wait a few minutes before generating another report.',
    },
  },
});

/**
 * Admin mutations limiter — prevent rapid administrative action spam.
 * Dev: 120 per 15 min | Prod: 60 per 15 min
 */
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 120 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Administrative request limit exceeded. Please slow down.',
    },
  },
});
