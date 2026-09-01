import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

export class InformationDisclosureScanner implements Scanner {
  id = 'information-disclosure';
  name = 'Information Disclosure Scanner';
  version = '2.0.0';
  description =
    'Detects software banners, server version leaks, framework headers, and generator metadata.';
  category: StandardCategory = 'INFORMATION_DISCLOSURE';
  riskLevel: Severity = 'LOW';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const response = context.httpsResponse ?? context.httpResponse;

    if (!response) return findings;

    const headers = response.headers;

    // ── 1. X-Powered-By header ──────────────────────────────────────────────
    const xPoweredBy = headers['x-powered-by'];
    const xPoweredByStr = Array.isArray(xPoweredBy) ? xPoweredBy[0] : xPoweredBy;

    if (xPoweredByStr) {
      findings.push({
        scanner: this.id,
        title: 'Technology Banner Disclosed in X-Powered-By Header',
        category: 'INFORMATION_DISCLOSURE',
        severity: 'LOW',
        confidence: 'HIGH',
        description: `The web server explicitly discloses its underlying framework or runtime via the 'X-Powered-By: ${xPoweredByStr}' header.`,
        evidence: `X-Powered-By: ${xPoweredByStr}`,
        impact:
          'Provides attackers with reconnaissance information to target known vulnerabilities specific to this framework/runtime.',
        remediation:
          "Disable the X-Powered-By header in server/framework configuration (e.g. app.disable('x-powered-by') in Express, expose_php = Off in php.ini).",
        reference: 'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 2. Server header with version number ────────────────────────────────
    const serverHeader = headers['server'];
    const serverStr = Array.isArray(serverHeader) ? serverHeader[0] : serverHeader;

    if (serverStr) {
      const hasVersion = /\d+\.\d+/.test(serverStr);
      if (hasVersion) {
        findings.push({
          scanner: this.id,
          title: 'Detailed Web Server Version Disclosed in Server Header',
          category: 'INFORMATION_DISCLOSURE',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The server header exposes the exact software product and version: '${serverStr}'.`,
          evidence: `Server: ${serverStr}`,
          impact:
            'Allows automated vulnerability scanners and attackers to cross-reference version-specific CVE databases.',
          remediation:
            'Configure the web server to suppress or tokenize the Server header (e.g. server_tokens off in Nginx, ServerTokens Prod in Apache).',
          reference:
            'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server',
          affectedComponent: 'Web Server Header',
        });
      }
    }

    // ── 3. ASP.NET version banners ──────────────────────────────────────────
    const aspNetVer = headers['x-aspnet-version'] ?? headers['x-aspnetmvc-version'];
    if (aspNetVer) {
      const verStr = Array.isArray(aspNetVer) ? aspNetVer[0] : aspNetVer;
      findings.push({
        scanner: this.id,
        title: 'ASP.NET Version Disclosed in Headers',
        category: 'INFORMATION_DISCLOSURE',
        severity: 'LOW',
        confidence: 'HIGH',
        description: `The server reveals internal .NET framework version metadata: '${verStr}'.`,
        evidence: `Header: ${verStr}`,
        impact:
          'Helps attackers fingerprint specific patch levels and framework versions.',
        remediation:
          'Set <httpRuntime enableVersionHeader="false" /> in web.config.',
        reference: 'https://learn.microsoft.com/en-us/previous-versions/aspnet/e1f13641(v=vs.100)',
        affectedComponent: 'HTTP Response Headers',
      });
    }

    // ── 4. HTML Generator Metadata Tag ──────────────────────────────────────
    if (response.body) {
      const metaGeneratorMatch = response.body.match(/<meta\s+name=["']generator["']\s+content=["']([^"']+)["']/i);
      if (metaGeneratorMatch && metaGeneratorMatch[1]) {
        const generatorValue = metaGeneratorMatch[1].trim();
        findings.push({
          scanner: this.id,
          title: 'CMS / Framework Version Disclosed in HTML Generator Meta Tag',
          category: 'INFORMATION_DISCLOSURE',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The HTML document includes a generator meta tag revealing CMS/framework details: '${generatorValue}'.`,
          evidence: `<meta name="generator" content="${generatorValue}">`,
          impact:
            'Allows automated scanners to fingerprint the CMS software and version without authentication.',
          remediation:
            'Remove the generator meta tag from template headers or use security plugins to suppress CMS version output.',
          reference: 'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/07-Map_Execution_Paths_Through_Application',
          affectedComponent: 'HTML Meta Tag',
        });
      }
    }

    return findings;
  }
}
