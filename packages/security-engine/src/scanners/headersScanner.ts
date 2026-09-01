import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class HeadersScanner implements Scanner {
  id = 'headers';
  name = 'HTTP Security Headers Scanner';
  version = '2.0.0';
  description =
    'Analyzes HTTP response headers against OWASP, MDN, and industry security best practices.';
  category: StandardCategory = 'HEADERS';
  riskLevel: Severity = 'MEDIUM';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const response = context.httpsResponse ?? context.httpResponse;

    if (!response) {
      return findings;
    }

    const headers = response.headers;

    // ── 1. Content-Security-Policy (CSP) ──────────────────────────────────────
    const csp = headers['content-security-policy'];
    const cspStr = Array.isArray(csp) ? csp.join('; ') : csp;

    if (!cspStr) {
      findings.push({
        scanner: this.id,
        title: 'Missing Content-Security-Policy Header',
        category: 'HEADERS',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        description:
          'Content-Security-Policy (CSP) is an essential defense-in-depth header that restricts which scripts, styles, images, and other resources the browser is allowed to load.',
        evidence: 'Header Content-Security-Policy is not present in server response.',
        impact:
          'Significantly increases susceptibility to Cross-Site Scripting (XSS), clickjacking, and unauthorized data exfiltration.',
        remediation:
          "Define a Content-Security-Policy header, starting with a baseline such as: default-src 'self'; script-src 'self'; object-src 'none';",
        reference:
          'https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html',
        affectedComponent: 'HTTP Response Headers',
      });
    } else {
      // Analyze configuration weaknesses within CSP
      if (
        cspStr.includes("'unsafe-inline'") &&
        !cspStr.includes("'nonce-") &&
        !cspStr.includes("'sha256-")
      ) {
        findings.push({
          scanner: this.id,
          title: "Content-Security-Policy Uses 'unsafe-inline'",
          category: 'HEADERS',
          severity: 'LOW',
          confidence: 'HIGH',
          description:
            "The Content-Security-Policy includes 'unsafe-inline' without cryptographic nonce or hash protection, allowing inline scripts to execute.",
          evidence: `CSP: ${cspStr.length > 200 ? cspStr.slice(0, 200) + '...' : cspStr}`,
          impact:
            'Weakens XSS mitigation because injected inline script tags and inline event handlers can execute without restrictions.',
          remediation:
            "Refactor inline scripts into external bundles or adopt cryptographic nonces ('nonce-...') or SHA-256 hashes.",
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src',
          affectedComponent: 'Content-Security-Policy',
        });
      }

      if (cspStr.includes("'unsafe-eval'")) {
        findings.push({
          scanner: this.id,
          title: "Content-Security-Policy Uses 'unsafe-eval'",
          category: 'HEADERS',
          severity: 'LOW',
          confidence: 'HIGH',
          description:
            "The Content-Security-Policy includes 'unsafe-eval', allowing dynamic JavaScript string evaluation (e.g. eval(), Function(), setTimeout(string)).",
          evidence: `CSP: ${cspStr.length > 200 ? cspStr.slice(0, 200) + '...' : cspStr}`,
          impact:
            'Increases risk of DOM-based code injection vulnerabilities by permitting string-to-code execution APIs.',
          remediation:
            "Remove 'unsafe-eval' from your policy and replace dynamic evaluation logic with structured JavaScript methods.",
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions',
          affectedComponent: 'Content-Security-Policy',
        });
      }

      // Check for wildcard sources in script-src or default-src
      if (
        /(?:default-src|script-src)\s+[^;]*\*(?!\.)/i.test(cspStr) &&
        !cspStr.includes('https:*')
      ) {
        findings.push({
          scanner: this.id,
          title: 'Content-Security-Policy Contains Wildcard Resource Source',
          category: 'HEADERS',
          severity: 'LOW',
          confidence: 'MEDIUM',
          description:
            'The Content-Security-Policy allows loading scripts or resources from any domain (*), bypassing origin restrictions.',
          evidence: `CSP: ${cspStr.length > 200 ? cspStr.slice(0, 200) + '...' : cspStr}`,
          impact:
            'Allows resources to be loaded from arbitrary third-party servers, negating origin isolation.',
          remediation:
            "Replace wildcard (*) sources with explicit trusted domain whitelists or 'self'.",
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy',
          affectedComponent: 'Content-Security-Policy',
        });
      }
    }

    // ── 2. Strict-Transport-Security (HSTS) ────────────────────────────────────
    const hsts = headers['strict-transport-security'];
    const hstsStr = Array.isArray(hsts) ? hsts[0] : hsts;

    if (context.isHttps) {
      if (!hstsStr) {
        findings.push({
          scanner: this.id,
          title: 'Missing Strict-Transport-Security (HSTS) Header',
          category: 'HEADERS',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description:
            'HTTP Strict Transport Security (HSTS) ensures that browsers always connect to this website using HTTPS, even if a user explicitly enters http://.',
          evidence: 'Header Strict-Transport-Security is not present in HTTPS response.',
          impact:
            'Leaves initial unencrypted connections vulnerable to SSL-stripping and active MitM downgrade attacks.',
          remediation:
            'Add the Strict-Transport-Security header: max-age=31536000; includeSubDomains; preload',
          reference:
            'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html',
          affectedComponent: 'HTTP Response Headers',
        });
      } else {
        const maxAgeMatch = hstsStr.match(/max-age=(\d+)/i);
        const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
        const MIN_RECOMMENDED_MAX_AGE = 15552000; // 180 days

        if (maxAge < MIN_RECOMMENDED_MAX_AGE) {
          findings.push({
            scanner: this.id,
            title: 'Strict-Transport-Security (HSTS) max-age is Too Short',
            category: 'HEADERS',
            severity: 'LOW',
            confidence: 'HIGH',
            description: `The HSTS max-age directive (${maxAge}s) is shorter than the recommended minimum of 180 days (15552000s).`,
            evidence: `Strict-Transport-Security: ${hstsStr}`,
            impact:
              'A short max-age reduces the duration during which the browser automatically forces HTTPS connections.',
            remediation:
              'Increase HSTS max-age to at least 31536000 seconds (1 year): max-age=31536000; includeSubDomains',
            reference: 'https://hstspreload.org/',
            affectedComponent: 'Strict-Transport-Security',
          });
        }

        if (!/includeSubDomains/i.test(hstsStr)) {
          findings.push({
            scanner: this.id,
            title: 'HSTS Header Missing includeSubDomains Directive',
            category: 'HEADERS',
            severity: 'INFO',
            confidence: 'HIGH',
            description:
              'The HSTS header does not include the includeSubDomains directive, leaving subdomains unprotected by strict transport policy.',
            evidence: `Strict-Transport-Security: ${hstsStr}`,
            impact:
              'Subdomains without explicit HSTS configurations may be vulnerable to SSL stripping.',
            remediation:
              'Verify all subdomains support HTTPS, then append includeSubDomains to your HSTS header.',
            reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
            affectedComponent: 'Strict-Transport-Security',
          });
        }
      }
    }

    // ── 3. X-Content-Type-Options ─────────────────────────────────────────────
    const xcto = headers['x-content-type-options'];
    const xctoStr = Array.isArray(xcto) ? xcto[0] : xcto;

    if (!xctoStr || xctoStr.toLowerCase() !== 'nosniff') {
      findings.push({
        scanner: this.id,
        title: 'Missing or Invalid X-Content-Type-Options Header',
        category: 'HEADERS',
        severity: 'LOW',
        confidence: 'HIGH',
        description:
          "X-Content-Type-Options: nosniff prevents the browser from MIME-type sniffing a response away from the declared Content-Type.",
        evidence: `X-Content-Type-Options: ${xctoStr ?? 'missing'}`,
        impact:
          'May allow user-uploaded or attacker-controlled files (e.g. images) to be executed as HTML or scripts in older browsers.',
        remediation: 'Add the header: X-Content-Type-Options: nosniff',
        reference:
          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 4. X-Frame-Options & Anti-Clickjacking ────────────────────────────────
    const xfo = headers['x-frame-options'];
    const xfoStr = Array.isArray(xfo) ? xfo[0] : xfo;
    const hasFrameAncestors = cspStr && /frame-ancestors/i.test(cspStr);

    if (!xfoStr && !hasFrameAncestors) {
      findings.push({
        scanner: this.id,
        title: 'Missing Clickjacking Defense (X-Frame-Options / frame-ancestors)',
        category: 'HEADERS',
        severity: 'LOW',
        confidence: 'HIGH',
        description:
          'Neither X-Frame-Options nor a CSP frame-ancestors directive was detected. This allows other websites to embed this page in an <iframe>.',
        evidence: 'Both X-Frame-Options and CSP frame-ancestors are absent.',
        impact:
          'Allows clickjacking attacks where transparent frames trick authenticated users into executing unintended actions.',
        remediation:
          "Add X-Frame-Options: DENY (or SAMEORIGIN), or add frame-ancestors 'none' to your Content-Security-Policy.",
        reference:
          'https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 5. Referrer-Policy ────────────────────────────────────────────────────
    const rp = headers['referrer-policy'];
    const rpStr = Array.isArray(rp) ? rp[0] : rp;

    if (!rpStr) {
      findings.push({
        scanner: this.id,
        title: 'Missing Referrer-Policy Header',
        category: 'HEADERS',
        severity: 'LOW',
        confidence: 'HIGH',
        description:
          'Referrer-Policy controls how much referrer information (URL path, query parameters) is included when navigating away from the page.',
        evidence: 'Header Referrer-Policy is not present in server response.',
        impact:
          'Sensitive data embedded in URL paths or query parameters (such as tokens or IDs) may leak to external third parties.',
        remediation:
          'Configure a strict Referrer-Policy such as: strict-origin-when-cross-origin or no-referrer',
        reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
        affectedComponent: 'HTTP Response Headers',
      });
    } else if (rpStr.toLowerCase().includes('unsafe-url')) {
      findings.push({
        scanner: this.id,
        title: 'Insecure Referrer-Policy (unsafe-url)',
        category: 'HEADERS',
        severity: 'LOW',
        confidence: 'HIGH',
        description:
          "Referrer-Policy is set to 'unsafe-url', which transmits the complete URL (including query string) to all cross-origin destinations.",
        evidence: `Referrer-Policy: ${rpStr}`,
        impact:
          'Transmits full query parameters and resource paths to all cross-origin requests, risking credential or token exposure.',
        remediation: 'Change Referrer-Policy to strict-origin-when-cross-origin.',
        reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
        affectedComponent: 'Referrer-Policy',
      });
    }

    // ── 6. Permissions-Policy ─────────────────────────────────────────────────
    const pp = headers['permissions-policy'];
    const ppStr = Array.isArray(pp) ? pp[0] : pp;

    if (!ppStr) {
      findings.push({
        scanner: this.id,
        title: 'Missing Permissions-Policy Header',
        category: 'HEADERS',
        severity: 'INFO',
        confidence: 'HIGH',
        description:
          'Permissions-Policy (formerly Feature-Policy) allows site administrators to restrict access to powerful browser APIs like camera, microphone, geolocation, and payment.',
        evidence: 'Header Permissions-Policy is not present in server response.',
        impact:
          'Allows embedded third-party frames to potentially request device permissions unless explicitly restricted.',
        remediation:
          'Define a Permissions-Policy header: camera=(), microphone=(), geolocation=(), payment=()',
        reference:
          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 7. Cross-Origin Isolation Headers (COOP / CORP / COEP) ─────────────────
    const coop = headers['cross-origin-opener-policy'];
    const coopStr = Array.isArray(coop) ? coop[0] : coop;

    if (!coopStr) {
      findings.push({
        scanner: this.id,
        title: 'Missing Cross-Origin-Opener-Policy (COOP) Header',
        category: 'HEADERS',
        severity: 'INFO',
        confidence: 'HIGH',
        description:
          'Cross-Origin-Opener-Policy (COOP) isolates your browsing context from cross-origin popups and windows, preventing window.opener attacks.',
        evidence: 'Header Cross-Origin-Opener-Policy is not present in server response.',
        impact:
          'Cross-origin windows opening your site retain a reference to window.opener, enabling potential cross-window interactions.',
        remediation:
          'Add Cross-Origin-Opener-Policy: same-origin to isolate the top-level browsing context.',
        reference:
          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    const corp = headers['cross-origin-resource-policy'];
    const corpStr = Array.isArray(corp) ? corp[0] : corp;

    if (!corpStr) {
      findings.push({
        scanner: this.id,
        title: 'Missing Cross-Origin-Resource-Policy (CORP) Header',
        category: 'HEADERS',
        severity: 'INFO',
        confidence: 'HIGH',
        description:
          'Cross-Origin-Resource-Policy (CORP) prevents resources from being loaded by unauthorized cross-origin sites via <img>, <script>, or <video>.',
        evidence: 'Header Cross-Origin-Resource-Policy is not present in server response.',
        impact:
          'Increases susceptibility to cross-origin Spectre-style side-channel leaks (XS-Leaks).',
        remediation:
          'Add Cross-Origin-Resource-Policy: same-origin (or same-site) on protected endpoints.',
        reference:
          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 8. Cache-Control on Sensitive Responses ───────────────────────────────
    const cacheControl = headers['cache-control'];
    const cacheControlStr = Array.isArray(cacheControl) ? cacheControl.join(', ') : cacheControl;
    const hasCookies = !!headers['set-cookie'];

    if (hasCookies && (!cacheControlStr || !cacheControlStr.toLowerCase().includes('no-store'))) {
      findings.push({
        scanner: this.id,
        title: 'Cookie-Setting Response Missing Cache-Control: no-store',
        category: 'HEADERS',
        severity: 'LOW',
        confidence: 'MEDIUM',
        description:
          'The server sets cookies in the HTTP response but does not specify Cache-Control: no-store, which may allow intermediate or shared caches to store sensitive session data.',
        evidence: `Cache-Control: ${cacheControlStr ?? 'missing'}, Set-Cookie: present`,
        impact:
          'Shared HTTP proxy caches could potentially store and serve session tokens or user-specific data to subsequent visitors.',
        remediation:
          'Ensure responses that deliver sensitive data or Set-Cookie headers include Cache-Control: no-store, no-cache, private.',
        reference: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#web-content-caching',
        affectedComponent: 'Cache-Control',
      });
    }

    return findings;
  }
}
