import { FindingInput, ScanContext, Scanner, Severity, StandardCategory } from '../types';

interface TechSignature {
  name: string;
  category: 'Web Server' | 'Framework' | 'CDN' | 'CMS' | 'Language' | 'Frontend' | 'Runtime';
  match: (headers: Record<string, string | string[] | undefined>, body: string) => boolean;
  evidence: (headers: Record<string, string | string[] | undefined>, body: string) => string;
}

const SIGNATURES: TechSignature[] = [
  {
    name: 'Next.js',
    category: 'Framework',
    match: (headers, body) =>
      body.includes('__NEXT_DATA__') ||
      body.includes('/_next/static/') ||
      Boolean(headers['x-nextjs-page'] || headers['x-nextjs-cache']),
    evidence: () => 'Detected Next.js runtime indicators in HTML structure and script bundle paths.',
  },
  {
    name: 'React',
    category: 'Frontend',
    match: (_, body) =>
      body.includes('data-reactroot') ||
      body.includes('react-dom') ||
      body.includes('_react') ||
      body.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__'),
    evidence: () => 'Detected React component DOM markers and bundle references.',
  },
  {
    name: 'Vue.js',
    category: 'Frontend',
    match: (_, body) =>
      body.includes('data-v-') ||
      body.includes('__vue__') ||
      body.includes('v-cloak'),
    evidence: () => 'Detected Vue.js scoped attribute markers (data-v-*).',
  },
  {
    name: 'Angular',
    category: 'Frontend',
    match: (_, body) =>
      body.includes('ng-version') ||
      body.includes('ng-app') ||
      body.includes('_ngcontent'),
    evidence: () => 'Detected Angular framework runtime attributes (ng-version / _ngcontent).',
  },
  {
    name: 'Express',
    category: 'Framework',
    match: (headers) => {
      const powered = headers['x-powered-by'];
      return Array.isArray(powered) ? powered.some(p => p.includes('Express')) : Boolean(powered?.includes('Express'));
    },
    evidence: (headers) => `X-Powered-By: ${headers['x-powered-by']}`,
  },
  {
    name: 'Laravel',
    category: 'Framework',
    match: (headers, body) => {
      const setCookie = headers['set-cookie'];
      const hasLaravelCookie = Array.isArray(setCookie)
        ? setCookie.some(c => c.includes('laravel_session'))
        : Boolean(setCookie?.includes('laravel_session'));
      return hasLaravelCookie || body.includes('laravel');
    },
    evidence: () => 'Found Laravel session cookie or framework markers.',
  },
  {
    name: 'Django',
    category: 'Framework',
    match: (headers) => {
      const setCookie = headers['set-cookie'];
      return Array.isArray(setCookie)
        ? setCookie.some(c => c.includes('csrftoken') || c.includes('django_session'))
        : Boolean(setCookie?.includes('csrftoken') || setCookie?.includes('django_session'));
    },
    evidence: () => 'Found Django session or CSRF cookie pattern (csrftoken / django_session).',
  },
  {
    name: 'WordPress',
    category: 'CMS',
    match: (_, body) =>
      body.includes('/wp-content/') ||
      body.includes('/wp-includes/') ||
      body.includes('name="generator" content="WordPress'),
    evidence: () => 'Found WordPress core path assets (/wp-content/, /wp-includes/).',
  },
  {
    name: 'Cloudflare',
    category: 'CDN',
    match: (headers) => Boolean(headers['cf-ray'] || headers['cf-cache-status']),
    evidence: (headers) => `Found Cloudflare reverse proxy headers (cf-ray: ${headers['cf-ray'] ?? 'present'})`,
  },
  {
    name: 'Nginx',
    category: 'Web Server',
    match: (headers) => {
      const s = headers['server'];
      return Array.isArray(s) ? s.some(v => /nginx/i.test(v)) : Boolean(s && /nginx/i.test(s));
    },
    evidence: (headers) => `Server: ${headers['server']}`,
  },
  {
    name: 'Apache HTTP Server',
    category: 'Web Server',
    match: (headers) => {
      const s = headers['server'];
      return Array.isArray(s) ? s.some(v => /apache/i.test(v)) : Boolean(s && /apache/i.test(s));
    },
    evidence: (headers) => `Server: ${headers['server']}`,
  },
  {
    name: 'PHP',
    category: 'Language',
    match: (headers) => {
      const powered = headers['x-powered-by'];
      const isPhpPowered = Array.isArray(powered) ? powered.some(p => p.includes('PHP')) : Boolean(powered?.includes('PHP'));
      const setCookie = headers['set-cookie'];
      const hasPhpSession = Array.isArray(setCookie) ? setCookie.some(c => c.includes('PHPSESSID')) : Boolean(setCookie?.includes('PHPSESSID'));
      return isPhpPowered || hasPhpSession;
    },
    evidence: (headers) => `Found PHP indicators in response headers or session cookies (${headers['x-powered-by'] ?? 'PHPSESSID'}).`,
  },
];

export class TechnologyScanner implements Scanner {
  id = 'technology-detection';
  name = 'Passive Technology Detection Scanner';
  version = '2.0.0';
  description = 'Passively inventories web technologies, CMS, frameworks, and CDNs in use.';
  category: StandardCategory = 'TECHNOLOGY';
  riskLevel: Severity = 'INFO';

  async scan(context: ScanContext): Promise<FindingInput[]> {
    const findings: FindingInput[] = [];
    const response = context.httpsResponse ?? context.httpResponse;

    if (!response) return findings;

    const { headers, body } = response;

    for (const sig of SIGNATURES) {
      if (sig.match(headers, body)) {
        findings.push({
          scanner: this.id,
          title: `Detected Technology: ${sig.name}`,
          category: 'TECHNOLOGY',
          severity: 'INFO',
          confidence: 'MEDIUM',
          description: `The application was observed utilizing ${sig.name} (${sig.category}).`,
          evidence: sig.evidence(headers, body),
          impact:
            'Informational asset inventory finding. Keep software components updated to prevent known vulnerabilities.',
          remediation:
            'Maintain regular patch management and dependency updates for all identified software stacks.',
          reference:
            'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/08-Fingerprint_Web_Application_Framework',
          affectedComponent: `${sig.category}: ${sig.name}`,
        });
      }
    }

    return findings;
  }
}
