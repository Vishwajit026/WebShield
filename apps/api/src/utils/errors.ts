/**
 * Standardized application error with HTTP status code.
 * Used to propagate structured errors through Express middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Common error factories ────────────────────────────────────────────────────

export const Errors = {
  badRequest: (message = 'Bad request.') =>
    new AppError(message, 400, 'BAD_REQUEST'),

  invalidCredentials: () =>
    new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'),

  unauthorized: (message = 'Authentication required.') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Insufficient permissions.') =>
    new AppError(message, 403, 'FORBIDDEN'),

  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found.`, 404, 'NOT_FOUND'),

  conflict: (message: string) =>
    new AppError(message, 409, 'CONFLICT'),

  validation: (message: string) =>
    new AppError(message, 422, 'VALIDATION_ERROR'),

  tooManyRequests: () =>
    new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMITED'),

  internal: (message = 'Internal server error.') =>
    new AppError(message, 500, 'INTERNAL_ERROR'),
} as const;
