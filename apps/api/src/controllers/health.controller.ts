import { Request, Response } from 'express';

/**
 * GET /api/health
 * Returns a simple health check payload.
 */
export function healthCheck(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    message: 'WebShield API is running',
    timestamp: new Date().toISOString(),
  });
}
