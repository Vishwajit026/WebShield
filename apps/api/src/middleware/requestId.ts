import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Request Correlation ID middleware.
 * Assigns or validates an X-Request-ID header for structured tracing across the system.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];

  // Validate incoming ID format (alphanumeric + hyphen, 8-64 chars) to prevent header injection
  let reqId: string;
  if (typeof incomingId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId)) {
    reqId = incomingId;
  } else {
    reqId = crypto.randomUUID();
  }

  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
}
