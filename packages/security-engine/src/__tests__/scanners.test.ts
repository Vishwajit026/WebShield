import { describe, it, expect } from 'vitest';
import { HttpsScanner } from '../scanners/httpsScanner';
import { HeadersScanner } from '../scanners/headersScanner';
import { CookieScanner } from '../scanners/cookieScanner';
import { CorsScanner } from '../scanners/corsScanner';
import { InformationDisclosureScanner } from '../scanners/informationDisclosureScanner';
import { TechnologyScanner } from '../scanners/technologyScanner';
import { TlsScanner } from '../scanners/tlsScanner';
import { WellKnownScanner } from '../scanners/wellKnownScanner';
import { ScanContext } from '../types';

function createMockContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    targetUrl: 'https://example.com',
    normalizedUrl: 'https://example.com/',
    hostname: 'example.com',
    port: 443,
    isHttps: true,
    httpsResponse: {
      url: 'https://example.com/',
      status: 200,
      statusText: 'OK',
      headers: {},
      rawHeaders: [],
      body: '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
      redirects: [],
      timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
    },
    options: {},
    executedScanners: [],
    scannerErrors: {},
    ...overrides,
  };
}

describe('HttpsScanner', () => {
  const scanner = new HttpsScanner();

  it('generates HIGH severity finding when target is not using HTTPS', async () => {
    const ctx = createMockContext({
      isHttps: false,
      normalizedUrl: 'http://example.com/',
      httpResponse: {
        url: 'http://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {},
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Does Not Use HTTPS'))).toBe(true);
    expect(findings.some(f => f.title.includes('Not Redirected to HTTPS'))).toBe(true);
  });

  it('flags excessive redirects (> 3 hops)', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/d',
        status: 200,
        statusText: 'OK',
        headers: {},
        rawHeaders: [],
        body: '',
        redirects: [
          'https://example.com/a',
          'https://example.com/b',
          'https://example.com/c',
          'https://example.com/d',
        ],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Excessive HTTP Redirect Chain'))).toBe(true);
  });

  it('flags insecure form actions on HTTPS pages', async () => {
    const ctx = createMockContext({
      isHttps: true,
      httpsResponse: {
        url: 'https://example.com/login',
        status: 200,
        statusText: 'OK',
        headers: {},
        rawHeaders: [],
        body: '<html><body><form action="http://example.com/api/login"><input type="password"/></form></body></html>',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Insecure Plaintext Form Action'))).toBe(true);
  });
});

describe('HeadersScanner', () => {
  const scanner = new HeadersScanner();

  it('flags missing CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {}, // Empty headers
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    const titles = findings.map(f => f.title);

    expect(titles).toContain('Missing Content-Security-Policy Header');
    expect(titles).toContain('Missing Strict-Transport-Security (HSTS) Header');
    expect(titles).toContain('Missing or Invalid X-Content-Type-Options Header');
    expect(titles).toContain('Missing Clickjacking Defense (X-Frame-Options / frame-ancestors)');
    expect(titles).toContain('Missing Referrer-Policy Header');
    expect(titles).toContain('Missing Permissions-Policy Header');
    expect(titles).toContain('Missing Cross-Origin-Opener-Policy (COOP) Header');
    expect(titles).toContain('Missing Cross-Origin-Resource-Policy (CORP) Header');
  });

  it('does not flag when all recommended headers are properly configured', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
          'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
          'permissions-policy': 'camera=(), microphone=()',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-resource-policy': 'same-origin',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings).toHaveLength(0);
  });

  it("flags CSP using 'unsafe-inline' and 'unsafe-eval'", async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'content-security-policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
          'strict-transport-security': 'max-age=31536000',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'no-referrer',
          'permissions-policy': 'camera=()',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes("'unsafe-inline'"))).toBe(true);
    expect(findings.some(f => f.title.includes("'unsafe-eval'"))).toBe(true);
  });
});

describe('CookieScanner', () => {
  const scanner = new CookieScanner();

  it('flags missing Secure, HttpOnly, and SameSite attributes', async () => {
    const ctx = createMockContext({
      isHttps: true,
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'set-cookie': 'session_token=secret_val', // Missing all flags
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    const titles = findings.map(f => f.title);

    expect(titles.some(t => t.includes("Missing 'Secure' Flag"))).toBe(true);
    expect(titles.some(t => t.includes("Missing 'HttpOnly' Flag"))).toBe(true);
    expect(titles.some(t => t.includes("Missing 'SameSite' Attribute"))).toBe(true);

    // Verify evidence is sanitized (no secret_val)
    findings.forEach(f => {
      expect(f.evidence).not.toContain('secret_val');
      expect(f.evidence).toContain('[REDACTED]');
    });
  });

  it('flags SameSite=None without Secure', async () => {
    const ctx = createMockContext({
      isHttps: true,
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'set-cookie': 'auth=token123; SameSite=None; HttpOnly',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes("SameSite=None Without 'Secure'"))).toBe(true);
  });
});

describe('CorsScanner', () => {
  const scanner = new CorsScanner();

  it('flags wildcard origin with credentials allowed', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-credentials': 'true',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Wildcard CORS Origin With Credentials'))).toBe(true);
  });

  it('flags null origin', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'access-control-allow-origin': 'null',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Allows Null Origin'))).toBe(true);
  });
});

describe('InformationDisclosureScanner', () => {
  const scanner = new InformationDisclosureScanner();

  it('flags X-Powered-By header and detailed Server version', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: {
          'x-powered-by': 'Express',
          server: 'Apache/2.4.41 (Ubuntu)',
        },
        rawHeaders: [],
        body: '',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('X-Powered-By'))).toBe(true);
    expect(findings.some(f => f.title.includes('Server Version'))).toBe(true);
  });
});

describe('TechnologyScanner', () => {
  const scanner = new TechnologyScanner();

  it('passively detects Next.js and React indicators', async () => {
    const ctx = createMockContext({
      httpsResponse: {
        url: 'https://example.com/',
        status: 200,
        statusText: 'OK',
        headers: { 'x-nextjs-page': '/index' },
        rawHeaders: [],
        body: '<html><body><div id="__next"><script id="__NEXT_DATA__">{}</script></div></body></html>',
        redirects: [],
        timing: { dnsLookupMs: 5, tcpConnectMs: 10, totalMs: 50 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Next.js'))).toBe(true);
  });
});

describe('TlsScanner', () => {
  const scanner = new TlsScanner();

  it('flags untrusted or invalid SSL certificates', async () => {
    const ctx = createMockContext({
      isHttps: true,
      tlsInfo: {
        authorized: false,
        authorizationError: 'SELF_SIGNED_CERT_IN_CHAIN',
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Untrusted or Invalid SSL/TLS Certificate'))).toBe(true);
  });

  it('flags certificates expiring within 30 days', async () => {
    const ctx = createMockContext({
      isHttps: true,
      tlsInfo: {
        authorized: true,
        daysRemaining: 15,
        validTo: '2026-09-10',
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Expiring Soon'))).toBe(true);
  });

  it('flags deprecated TLS 1.0 protocol version', async () => {
    const ctx = createMockContext({
      isHttps: true,
      tlsInfo: {
        authorized: true,
        protocol: 'TLSv1',
        cipherName: 'AES128-SHA',
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Deprecated TLS Protocol Version'))).toBe(true);
  });

  it('flags weak RC4 or DES ciphers', async () => {
    const ctx = createMockContext({
      isHttps: true,
      tlsInfo: {
        authorized: true,
        protocol: 'TLSv1.2',
        cipherName: 'RC4-MD5',
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('Weak or Insecure TLS Cipher Suite'))).toBe(true);
  });
});

describe('WellKnownScanner', () => {
  const scanner = new WellKnownScanner();

  it('detects valid security.txt policy', async () => {
    const ctx = createMockContext({
      securityTxtResponse: {
        url: 'https://example.com/.well-known/security.txt',
        status: 200,
        statusText: 'OK',
        headers: {},
        rawHeaders: [],
        body: 'Contact: mailto:security@example.com\nExpires: 2027-01-01T00:00:00.000Z',
        redirects: [],
        timing: { dnsLookupMs: 2, tcpConnectMs: 5, totalMs: 20 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('security.txt'))).toBe(true);
  });

  it('detects robots.txt crawling policy', async () => {
    const ctx = createMockContext({
      robotsTxtResponse: {
        url: 'https://example.com/robots.txt',
        status: 200,
        statusText: 'OK',
        headers: {},
        rawHeaders: [],
        body: 'User-agent: *\nDisallow: /admin',
        redirects: [],
        timing: { dnsLookupMs: 2, tcpConnectMs: 5, totalMs: 20 },
      },
    });

    const findings = await scanner.scan(ctx);
    expect(findings.some(f => f.title.includes('robots.txt'))).toBe(true);
  });
});
