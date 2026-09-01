import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/env';

// ── Token payload types ───────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;   // userId
  role: string;
  iat?: number;
  exp?: number;
}

// ── Access token ──────────────────────────────────────────────────────────────

/**
 * Sign a short-lived access token.
 * Payload contains only userId (sub) and role.
 * No sensitive information is embedded in the JWT.
 */
export function signAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify and decode an access token.
 * Returns the decoded payload or throws on invalid/expired token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.secret) as AccessTokenPayload;
}

// ── Refresh token ─────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random refresh token.
 * Returns the raw token (to send to client) and its SHA-256 hash (to store).
 *
 * NEVER store the raw token. Only the hash is persisted in the database.
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

/**
 * Hash a raw refresh token with SHA-256 for safe storage.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
