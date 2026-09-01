import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class WellKnownScanner implements Scanner {
  id = 'well-known';
  name = 'Security & Crawling Policy Scanner';
  version = '1.0.0';
  description =
    'Passively checks for the presence of standard security.txt (RFC 9116) and robots.txt policies.';
  category: StandardCategory = 'CONFIGURATION';
  riskLevel: Severity = 'INFO';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];

    // ── 1. security.txt Check (RFC 9116) ────────────────────────────────────
    if (context.securityTxtResponse) {
      const resp = context.securityTxtResponse;
      if (resp.status >= 200 && resp.status < 300 && resp.body) {
        const hasContact = /Contact:\s*(?:mailto:|https:\/\/)/i.test(resp.body);
        const hasExpires = /Expires:\s*/i.test(resp.body);

        if (hasContact) {
          findings.push({
            scanner: this.id,
            title: 'Security Vulnerability Disclosure Policy Found (security.txt)',
            category: 'CONFIGURATION',
            severity: 'INFO',
            confidence: 'HIGH',
            description:
              'The website publishes a standard security.txt file (RFC 9116) defining clear vulnerability disclosure and contact channels for security researchers.',
            evidence: `Status: ${resp.status} OK (Contact directive found)\nExpires directive: ${hasExpires ? 'present' : 'missing'}`,
            impact:
              'Positive security posture practice that enables responsible vulnerability reporting.',
            remediation:
              'Maintain your security.txt policy and verify that the Contact address and Expires timestamp remain valid.',
            reference: 'https://www.rfc-editor.org/rfc/rfc9116.html',
            affectedComponent: '/.well-known/security.txt',
          });
        }
      }
    }

    // ── 2. robots.txt Check ─────────────────────────────────────────────────
    if (context.robotsTxtResponse) {
      const resp = context.robotsTxtResponse;
      if (resp.status >= 200 && resp.status < 300 && resp.body) {
        const hasUserAgent = /User-agent:\s*/i.test(resp.body);
        if (hasUserAgent) {
          findings.push({
            scanner: this.id,
            title: 'Crawler Policy File Discovered (robots.txt)',
            category: 'CONFIGURATION',
            severity: 'INFO',
            confidence: 'HIGH',
            description:
              'The server provides a standard robots.txt file to guide search engine crawlers and automated indexing spiders.',
            evidence: `Status: ${resp.status} OK (${resp.body.split('\n').length} lines)`,
            impact:
              'Informational crawling directive. Ensure sensitive internal administrative endpoints are not inadvertently listed in public disallow rules.',
            remediation:
              'Review robots.txt to ensure sensitive path names are not exposed to reconnaissance.',
            reference: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
            affectedComponent: '/robots.txt',
          });
        }
      }
    }

    return findings;
  }
}
