import { Request, Response, NextFunction } from 'express';
import config from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

/**
 * Centralized error handler.
 *
 * Returns consistent JSON:
 *   { success: false, error: { code, message } }
 *
 * In production, stack traces and internal details are NEVER exposed.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod validation errors ───────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: messages,
      },
    });
    return;
  }

  // ── Operational application errors ─────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`AppError 5xx: ${err.message}`, err);
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // ── Unknown / unexpected errors ─────────────────────────────────────────────
  const error = err instanceof Error ? err : new Error(String(err));

  // Handle CORS rejection gracefully as 403 Forbidden
  if (error.message.startsWith('CORS policy:')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ORIGIN_NOT_ALLOWED',
        message: error.message,
      },
    });
    return;
  }

  logger.error(`Unhandled error: ${error.message}`, error);

  const body: Record<string, unknown> = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    },
  };

  // Only expose stack traces in non-production
  if (config.nodeEnv !== 'production' && error.stack) {
    body.stack = error.stack;
  }

  res.status(500).json(body);
}
