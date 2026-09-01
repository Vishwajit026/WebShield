import { describe, it, expect } from 'vitest';
import {
  sanitizeSetCookieHeader,
  sanitizeHeaders,
  sanitizeEvidence,
} from '../utils/sanitizer';

describe('Sanitizer Utility', () => {
  it('redacts cookie values while preserving flags and attributes', () => {
    const raw = 'session_token=secret_value_12345; Path=/; Secure; HttpOnly; SameSite=Lax';
    const sanitized = sanitizeSetCookieHeader(raw);
    expect(sanitized).toBe('session_token=[REDACTED]; Path=/; Secure; HttpOnly; SameSite=Lax');
    expect(sanitized).not.toContain('secret_value_12345');
  });

  it('redacts authorization headers in header maps', () => {
    const headers = {
      authorization: 'Bearer super_secret_token_abc',
      'x-api-key': 'secret_key_123',
      'content-type': 'application/json',
      'set-cookie': 'sid=12345; Secure; HttpOnly',
    };

    const sanitized = sanitizeHeaders(headers);
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized['set-cookie']).toBe('sid=[REDACTED]; Secure; HttpOnly');
  });

  it('redacts tokens in freeform evidence strings', () => {
    const raw = 'Found header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test in response';
    const sanitized = sanitizeEvidence(raw);
    expect(sanitized).toBe('Found header Authorization: Bearer [REDACTED] in response');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });
});
