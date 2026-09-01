import { describe, it, expect } from 'vitest';
import { validateAndNormalizeUrl } from '../validation/urlValidator';

describe('Target URL Validator & Normalizer', () => {
  it('accepts valid https URL and normalizes correctly', () => {
    const res = validateAndNormalizeUrl('https://example.com');
    expect(res.protocol).toBe('https:');
    expect(res.hostname).toBe('example.com');
    expect(res.port).toBe(443);
    expect(res.normalizedUrl).toBe('https://example.com/');
  });

  it('accepts valid http URL and normalizes correctly', () => {
    const res = validateAndNormalizeUrl('http://example.com');
    expect(res.protocol).toBe('http:');
    expect(res.hostname).toBe('example.com');
    expect(res.port).toBe(80);
    expect(res.normalizedUrl).toBe('http://example.com/');
  });

  it('auto-prepends https:// when protocol is missing', () => {
    const res = validateAndNormalizeUrl('example.com');
    expect(res.protocol).toBe('https:');
    expect(res.normalizedUrl).toBe('https://example.com/');
  });

  it('preserves valid custom ports', () => {
    const res = validateAndNormalizeUrl('https://example.com:8443/test');
    expect(res.port).toBe(8443);
    expect(res.normalizedUrl).toBe('https://example.com:8443/test');
  });

  it('lowercases hostname', () => {
    const res = validateAndNormalizeUrl('HTTPS://EXAMPLE.COM/Path');
    expect(res.hostname).toBe('example.com');
    expect(res.normalizedUrl).toBe('https://example.com/Path');
  });

  it('rejects unsupported schemes (file, ftp, javascript, data, gopher, ssh)', () => {
    expect(() => validateAndNormalizeUrl('file:///etc/passwd')).toThrow(/Unsupported protocol/);
    expect(() => validateAndNormalizeUrl('ftp://example.com')).toThrow(/Unsupported protocol/);
    expect(() => validateAndNormalizeUrl('javascript:alert(1)')).toThrow(/Unsupported protocol/);
    expect(() => validateAndNormalizeUrl('data:text/html,test')).toThrow(/Unsupported protocol/);
    expect(() => validateAndNormalizeUrl('gopher://example.com')).toThrow(/Unsupported protocol/);
    expect(() => validateAndNormalizeUrl('ssh://root@example.com')).toThrow(/Unsupported protocol/);
  });

  it('rejects URLs with embedded credentials (user:pass@)', () => {
    expect(() => validateAndNormalizeUrl('https://admin:secret@example.com')).toThrow(
      /URLs containing credentials/
    );
  });

  it('rejects empty or whitespace-only inputs', () => {
    expect(() => validateAndNormalizeUrl('')).toThrow(/non-empty/);
    expect(() => validateAndNormalizeUrl('   ')).toThrow(/cannot be empty/);
  });

  it('rejects malformed URLs', () => {
    expect(() => validateAndNormalizeUrl('http://')).toThrow(/Invalid URL format/);
    expect(() => validateAndNormalizeUrl('http://...')).toThrow(/Invalid/);
  });
});
