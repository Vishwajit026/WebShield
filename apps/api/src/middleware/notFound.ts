import { Request, Response, NextFunction } from 'express';

/**
 * 404 Not Found handler — catches any unmatched routes and returns
 * a consistent JSON response instead of Express's default HTML.
 */
export function notFound(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
