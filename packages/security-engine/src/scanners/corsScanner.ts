import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class CorsScanner implements Scanner {
  id = 'cors';
  name = 'CORS Policy Scanner';
  version = '2.0.0';
  description =
    'Passively analyzes Cross-Origin Resource Sharing (CORS) headers, origin reflections, and allowed methods.';
  category: StandardCategory = 'CORS';
  riskLevel: Severity = 'HIGH';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const response = context.httpsResponse ?? context.httpResponse;

    if (!response) return findings;

    const headers = response.headers;
    const acao = headers['access-control-allow-origin'];
    const acac = headers['access-control-allow-credentials'];
    const acam = headers['access-control-allow-methods'];
    const vary = headers['vary'];

    const acaoStr = (Array.isArray(acao) ? acao[0] : acao)?.trim();
    const acacStr = (Array.isArray(acac) ? acac[0] : acac)?.trim().toLowerCase();
    const acamStr = (Array.isArray(acam) ? acam[0] : acam)?.trim();
    const varyStr = (Array.isArray(vary) ? vary.join(', ') : vary)?.toLowerCase();

    const allowsCredentials = acacStr === 'true';

    if (acaoStr) {
      // ── 1. Wildcard origin with credentials enabled ─────────────────────────
      if (acaoStr === '*' && allowsCredentials) {
        findings.push({
          scanner: this.id,
          title: 'Wildcard CORS Origin With Credentials Allowed',
          category: 'CORS',
          severity: 'HIGH',
          confidence: 'HIGH',
          description:
            "The server returns 'Access-Control-Allow-Origin: *' along with 'Access-Control-Allow-Credentials: true'. This configuration violates the CORS specification and allows arbitrary origins to access authenticated resources.",
          evidence: `Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true`,
          impact:
            'Arbitrary third-party websites can potentially read authenticated response data through browser-based cross-origin requests.',
          remediation:
            'Specify explicit trusted origins in Access-Control-Allow-Origin instead of wildcard (*).',
          reference: 'https://portswigger.net/web-security/cors',
          affectedComponent: 'CORS Configuration',
        });
      }

      // ── 2. Insecure null origin ─────────────────────────────────────────────
      if (acaoStr.toLowerCase() === 'null') {
        findings.push({
          scanner: this.id,
          title: 'CORS Policy Allows Null Origin',
          category: 'CORS',
          severity: 'MEDIUM',
          confidence: 'MEDIUM',
          description:
            "The server allows 'null' in the Access-Control-Allow-Origin header. Attackers can trigger requests with Origin: null using sandboxed iframes or data: URIs.",
          evidence: `Access-Control-Allow-Origin: null`,
          impact:
            'Any external website can bypass origin controls by executing cross-origin requests from sandboxed frames.',
          remediation:
            'Avoid allowing origin: null. Validate and return specific, explicitly authorized origin URLs.',
          reference:
            'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html',
          affectedComponent: 'CORS Configuration',
        });
      }

      // ── 3. Public API Wildcard notification (Informational) ─────────────────
      if (acaoStr === '*' && !allowsCredentials) {
        findings.push({
          scanner: this.id,
          title: 'Public Wildcard CORS Policy (Access-Control-Allow-Origin: *)',
          category: 'CORS',
          severity: 'INFO',
          confidence: 'HIGH',
          description:
            "The server exposes this endpoint to all third-party origins via 'Access-Control-Allow-Origin: *'. This is appropriate for public APIs, but should not be used on private or authenticated internal endpoints.",
          evidence: `Access-Control-Allow-Origin: *`,
          impact:
            'Any web page on the internet can read responses from this endpoint.',
          remediation:
            'If this endpoint serves private user data, restrict Access-Control-Allow-Origin to trusted domains.',
          reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
          affectedComponent: 'CORS Configuration',
        });
      }

      // ── 4. Dynamic Origin Reflection without Vary: Origin ───────────────────
      if (acaoStr !== '*' && (!varyStr || !varyStr.includes('origin'))) {
        findings.push({
          scanner: this.id,
          title: 'CORS Response Missing Vary: Origin Header',
          category: 'CORS',
          severity: 'LOW',
          confidence: 'MEDIUM',
          description:
            'The server dynamically returns specific origins in Access-Control-Allow-Origin but does not declare Vary: Origin in the response headers.',
          evidence: `Access-Control-Allow-Origin: ${acaoStr}\nVary: ${varyStr ?? 'missing'}`,
          impact:
            'Intermediate HTTP caches may cache a CORS response for one origin and serve it to a different origin, causing CORS failures or unauthorized data exposure.',
          remediation:
            'Include the Vary: Origin header in all responses that generate dynamic CORS headers.',
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary',
          affectedComponent: 'Vary Header',
        });
      }

      // ── 5. Permissive Methods Allowed on Wildcard Origin ────────────────────
      if (acaoStr === '*' && acamStr && /(?:DELETE|PUT|PATCH)/i.test(acamStr)) {
        findings.push({
          scanner: this.id,
          title: 'Overly Permissive HTTP Methods Exposed via Wildcard CORS',
          category: 'CORS',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The server explicitly permits state-modifying HTTP methods (${acamStr}) across all origins on a wildcard policy.`,
          evidence: `Access-Control-Allow-Origin: *\nAccess-Control-Allow-Methods: ${acamStr}`,
          impact:
            'Allows third-party websites to trigger cross-origin state-altering requests without origin restriction.',
          remediation:
            'Limit Access-Control-Allow-Methods to GET, POST, HEAD, and OPTIONS for public endpoints, or restrict state-altering methods to authorized origins.',
          reference:
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods',
          affectedComponent: 'Access-Control-Allow-Methods',
        });
      }
    }

    return findings;
  }
}
