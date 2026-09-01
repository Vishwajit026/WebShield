import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';
import { sanitizeSetCookieHeader } from '../utils/sanitizer';

const SENSITIVE_COOKIE_PATTERN =
  /(?:session|auth|token|jwt|sid|id|connect\.sid|phpsessid|jsessionid|csrftoken|xsrf|remember_me)/i;

export class CookieScanner implements Scanner {
  id = 'cookies';
  name = 'Cookie Security Flags Scanner';
  version = '2.0.0';
  description =
    'Inspects Set-Cookie headers for Secure, HttpOnly, SameSite, and Domain scope protection flags.';
  category: StandardCategory = 'COOKIES';
  riskLevel: Severity = 'HIGH';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const response = context.httpsResponse ?? context.httpResponse;

    if (!response) return findings;

    const rawSetCookie = response.headers['set-cookie'];
    if (!rawSetCookie) return findings;

    const cookieHeaders = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];

    for (const cookieStr of cookieHeaders) {
      if (!cookieStr) continue;

      const sanitizedEvidence = sanitizeSetCookieHeader(cookieStr);
      const cookieName = cookieStr.split('=')[0]?.trim() ?? 'Cookie';
      const isSensitive = SENSITIVE_COOKIE_PATTERN.test(cookieName);
      const parts = cookieStr.toLowerCase().split(';').map(p => p.trim());

      const hasSecure = parts.includes('secure');
      const hasHttpOnly = parts.includes('httponly');
      const sameSitePart = parts.find(p => p.startsWith('samesite='));
      const sameSiteValue = sameSitePart ? sameSitePart.split('=')[1]?.trim() : null;
      const domainPart = parts.find(p => p.startsWith('domain='));
      const domainValue = domainPart ? domainPart.split('=')[1]?.trim() : null;

      // ── 1. Missing Secure flag ──────────────────────────────────────────────
      if (!hasSecure && context.isHttps) {
        findings.push({
          scanner: this.id,
          title: `Cookie '${cookieName}' Missing 'Secure' Flag`,
          category: 'COOKIES',
          severity: isSensitive ? 'HIGH' : 'MEDIUM',
          confidence: 'HIGH',
          description: `The cookie '${cookieName}' was set over HTTPS without the 'Secure' attribute.`,
          evidence: `Observed Cookie: ${sanitizedEvidence}`,
          impact:
            'Browsers may transmit this cookie over unencrypted HTTP if the user visits an http:// link or initiates an insecure subresource request.',
          remediation: `Add the 'Secure' attribute to the Set-Cookie directive: Set-Cookie: ${cookieName}=[VALUE]; Secure; HttpOnly; SameSite=Lax`,
          reference:
            'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#cookies',
          affectedComponent: `Cookie: ${cookieName}`,
        });
      }

      // ── 2. Missing HttpOnly flag ────────────────────────────────────────────
      if (!hasHttpOnly) {
        findings.push({
          scanner: this.id,
          title: `Cookie '${cookieName}' Missing 'HttpOnly' Flag`,
          category: 'COOKIES',
          severity: isSensitive ? 'HIGH' : 'LOW',
          confidence: isSensitive ? 'HIGH' : 'MEDIUM',
          description: `The cookie '${cookieName}' is missing the 'HttpOnly' attribute, making it accessible to client-side scripts via document.cookie.`,
          evidence: `Observed Cookie: ${sanitizedEvidence}`,
          impact:
            'If the web application has an XSS vulnerability, attackers can directly read and exfiltrate this cookie to hijack active sessions.',
          remediation: `Add 'HttpOnly' to the Set-Cookie directive for '${cookieName}' unless client-side JavaScript access is strictly required.`,
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies',
          affectedComponent: `Cookie: ${cookieName}`,
        });
      }

      // ── 3. SameSite attribute checks ────────────────────────────────────────
      if (!sameSiteValue) {
        findings.push({
          scanner: this.id,
          title: `Cookie '${cookieName}' Missing 'SameSite' Attribute`,
          category: 'COOKIES',
          severity: isSensitive ? 'MEDIUM' : 'LOW',
          confidence: 'HIGH',
          description: `The cookie '${cookieName}' does not specify a 'SameSite' attribute (Lax, Strict, or None).`,
          evidence: `Observed Cookie: ${sanitizedEvidence}`,
          impact:
            'Leaves cross-site requests vulnerable to Cross-Site Request Forgery (CSRF) on older browsers or non-standard top-level navigations.',
          remediation: `Configure 'SameSite=Lax' or 'SameSite=Strict' for cookie '${cookieName}'.`,
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite',
          affectedComponent: `Cookie: ${cookieName}`,
        });
      } else if (sameSiteValue === 'none' && !hasSecure) {
        findings.push({
          scanner: this.id,
          title: `Cookie '${cookieName}' Uses SameSite=None Without 'Secure'`,
          category: 'COOKIES',
          severity: 'HIGH',
          confidence: 'HIGH',
          description: `The cookie '${cookieName}' specifies SameSite=None without the 'Secure' attribute. Modern browsers will reject this cookie entirely.`,
          evidence: `Observed Cookie: ${sanitizedEvidence}`,
          impact:
            'Cookies will be rejected and dropped by modern browsers, resulting in broken sessions or authentication failures.',
          remediation: `Include the 'Secure' attribute whenever 'SameSite=None' is declared.`,
          reference: 'https://web.dev/samesite-cookies-explained/',
          affectedComponent: `Cookie: ${cookieName}`,
        });
      }

      // ── 4. Overly Permissive Domain Scope ───────────────────────────────────
      if (domainValue && domainValue.startsWith('.') && isSensitive) {
        findings.push({
          scanner: this.id,
          title: `Cookie '${cookieName}' Uses Broad Domain Scope`,
          category: 'COOKIES',
          severity: 'LOW',
          confidence: 'MEDIUM',
          description: `The cookie '${cookieName}' explicitly sets Domain=${domainValue}, making it readable by all existing and future subdomains.`,
          evidence: `Observed Cookie: ${sanitizedEvidence}`,
          impact:
            'If any sibling subdomain is compromised or hosts user-generated content, it can read and hijack this session cookie.',
          remediation:
            'Omit the Domain attribute to restrict the cookie to the exact origin host only (host-only cookie).',
          reference:
            'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#domain-and-path-attributes',
          affectedComponent: `Cookie: ${cookieName}`,
        });
      }
    }

    return findings;
  }
}
