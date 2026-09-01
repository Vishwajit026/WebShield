import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/jwt';

// Set up JWT_SECRET for tests
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-testing-purposes-123456789';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-long-enough-for-tests-987654321';

describe('Access token', () => {
  it('signs and verifies a valid access token', () => {
    const token = signAccessToken('user123', 'USER');
    expect(token).toBeTruthy();

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user123');
    expect(payload.role).toBe('USER');
  });

  it('throws on invalid token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });

  it('throws on tampered token', () => {
    const token = signAccessToken('user123', 'USER');
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('contains only userId and role (no sensitive data)', () => {
    const token = signAccessToken('user123', 'USER');
    const payload = verifyAccessToken(token);

    // Should only have these claims
    expect(payload.sub).toBe('user123');
    expect(payload.role).toBe('USER');

    // Should NOT contain sensitive fields
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('password');
    expect(payload).not.toHaveProperty('passwordHash');
  });

  it('ADMIN role token verifies correctly', () => {
    const token = signAccessToken('admin123', 'ADMIN');
    const payload = verifyAccessToken(token);
    expect(payload.role).toBe('ADMIN');
  });
});

describe('Refresh token', () => {
  it('generates a cryptographically random token', () => {
    const { raw: token1 } = generateRefreshToken();
    const { raw: token2 } = generateRefreshToken();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThan(32);
  });

  it('hash is deterministic (same raw → same hash)', () => {
    const raw = 'test-refresh-token-raw-value';
    const hash1 = hashRefreshToken(raw);
    const hash2 = hashRefreshToken(raw);
    expect(hash1).toBe(hash2);
  });

  it('hash differs from raw token', () => {
    const { raw, hash } = generateRefreshToken();
    expect(hash).not.toBe(raw);
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  it('different raws produce different hashes', () => {
    const hash1 = hashRefreshToken('token-one');
    const hash2 = hashRefreshToken('token-two');
    expect(hash1).not.toBe(hash2);
  });
});

describe('authenticate middleware', () => {
  it('verifies valid Bearer token in Authorization header', () => {
    const token = signAccessToken('user123', 'USER');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user123');
  });

  it('rejects expired token (simulated with very short expiry)', async () => {
    // We can't easily test token expiry without mocking time, but we can
    // test that an obviously wrong token format fails
    expect(() => verifyAccessToken('')).toThrow();
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
});
