import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class HttpsScanner implements Scanner {
  id = 'https';
  name = 'HTTPS & HTTP Protocol Security Scanner';
  version = '2.0.0';
  description =
    'Verifies HTTPS enforcement, redirect chains, HTTP-to-HTTPS upgrades, and passive mixed-content form actions.';
  category: StandardCategory = 'HTTP';
  riskLevel: Severity = 'HIGH';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const { isHttps, httpResponse, httpsResponse, normalizedUrl } = context;
    const activeResponse = httpsResponse ?? httpResponse;

    // ── 1. Check if the target URL is using HTTPS ───────────────────────────
    if (!isHttps) {
      findings.push({
        scanner: this.id,
        title: 'Target Does Not Use HTTPS by Default',
        category: 'HTTP',
        severity: 'HIGH',
        confidence: 'HIGH',
        description:
          'The target was accessed over unencrypted plain HTTP. All traffic, including credentials, session tokens, and sensitive data, is transmitted in plaintext and vulnerable to eavesdropping and man-in-the-middle (MitM) interception.',
        evidence: `Accessed URL: ${normalizedUrl}`,
        impact:
          'Attackers on the local network (e.g. public Wi-Fi) or along the routing path can intercept and modify unencrypted traffic.',
        remediation:
          'Install a valid TLS certificate and enforce HTTPS redirection across the entire application.',
        reference: 'https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure',
        affectedComponent: 'Transport Layer',
      });
    }

    // ── 2. Check HTTP to HTTPS redirect behavior ────────────────────────────
    if (httpResponse) {
      const isRedirect = [301, 302, 307, 308].includes(httpResponse.status);
      const location = httpResponse.headers['location'];
      const locationStr = Array.isArray(location) ? location[0] : location;

      const redirectsToHttps = isRedirect && locationStr?.startsWith('https://');

      if (!redirectsToHttps && !isHttps) {
        findings.push({
          scanner: this.id,
          title: 'HTTP Traffic is Not Redirected to HTTPS',
          category: 'HTTP',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description:
            'The server does not automatically redirect unencrypted HTTP requests to secure HTTPS endpoints.',
          evidence: `HTTP Status: ${httpResponse.status} ${httpResponse.statusText}`,
          impact:
            'Users inadvertently typing http:// in the address bar will remain on an unencrypted connection.',
          remediation:
            'Configure HTTP 301 Permanent Redirect on port 80 to immediately upgrade all requests to https://.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections',
          affectedComponent: 'Web Server Configuration',
        });
      }
    }

    // ── 3. Redirect Chain Analysis ──────────────────────────────────────────
    if (activeResponse && activeResponse.redirects && activeResponse.redirects.length > 0) {
      const redirects = activeResponse.redirects;

      // Excessive redirects check
      if (redirects.length > 3) {
        findings.push({
          scanner: this.id,
          title: 'Excessive HTTP Redirect Chain',
          category: 'HTTP',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The request required ${redirects.length} redirects to reach the final destination. Excessive redirects degrade performance and increase surface for redirect hijacking.`,
          evidence: `Redirect Chain (${redirects.length} hops):\n${redirects.join('\n→ ')}`,
          impact:
            'Increases page load latency and potential exposure to open redirects or intermediate proxy tampering.',
          remediation:
            'Streamline server redirect rules to resolve directly to the canonical URL in a single 301 hop.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections',
          affectedComponent: 'HTTP Redirection Chain',
        });
      }

      // Check if redirect chain downgraded to HTTP at any point
      const hasHttpDowngrade = redirects.some((u, idx) => {
        if (idx > 0 && redirects[idx - 1].startsWith('https://') && u.startsWith('http://')) {
          return true;
        }
        return false;
      });

      if (hasHttpDowngrade) {
        findings.push({
          scanner: this.id,
          title: 'Insecure Redirect Chain Protocol Downgrade (HTTPS to HTTP)',
          category: 'HTTP',
          severity: 'HIGH',
          confidence: 'HIGH',
          description:
            'The redirect chain transitions from HTTPS to unencrypted HTTP, exposing intermediate query parameters and referrer data in plaintext.',
          evidence: `Redirect Chain:\n${redirects.join('\n→ ')}`,
          impact:
            'An attacker observing the unencrypted hop can intercept tokens, session IDs, or private URLs.',
          remediation:
            'Ensure all intermediate redirect hops strictly maintain HTTPS transport.',
          reference: 'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html',
          affectedComponent: 'HTTP Redirection Chain',
        });
      }
    }

    // ── 4. Passive Mixed-Content Form Actions Check ─────────────────────────
    if (isHttps && activeResponse && activeResponse.body) {
      const html = activeResponse.body;
      const formActionRegex = /<form\s+[^>]*action=["'](http:\/\/[^"']+)["']/gi;
      let match: RegExpExecArray | null;
      const insecureFormActions: string[] = [];

      while ((match = formActionRegex.exec(html)) !== null) {
        insecureFormActions.push(match[1]);
        if (insecureFormActions.length >= 3) break;
      }

      if (insecureFormActions.length > 0) {
        findings.push({
          scanner: this.id,
          title: 'Insecure Plaintext Form Action on HTTPS Page (Mixed Content)',
          category: 'HTTP',
          severity: 'HIGH',
          confidence: 'HIGH',
          description:
            'The HTTPS page contains one or more HTML forms that submit form data over unencrypted HTTP (mixed content).',
          evidence: `Insecure Action(s): ${insecureFormActions.join(', ')}`,
          impact:
            'User input, including potentially passwords or personal data, will be transmitted over plaintext HTTP upon form submission.',
          remediation:
            'Update all HTML form action attributes to use secure HTTPS endpoints or relative paths.',
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content',
          affectedComponent: 'HTML Form Action',
        });
      }
    }

    return findings;
  }
}
