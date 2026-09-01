import { Scan, Target, Finding } from '@prisma/client';

export interface ReportFinding {
  index: number;
  title: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedComponent: string | null;
  description: string;
  evidence: string | null;
  impact: string | null;
  remediation: string | null;
  reference: string | null;
}

export interface ReportData {
  reportId: string;
  generatedAt: string;
  classification: string;
  target: {
    url: string;
    hostname: string;
    normalizedUrl: string;
  };
  scan: {
    id: string;
    startedAt: string | null;
    completedAt: string | null;
    durationFormatted: string;
    status: string;
  };
  executiveSummary: {
    overview: string;
    securityScore: number;
    grade: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
    scoreSummary: string;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    postureObservations: string[];
  };
  findings: ReportFinding[];
  comparison?: {
    previousScore: number | null;
    currentScore: number | null;
    scoreDifference: number;
    resolvedCount: number;
    newCount: number;
    persistentCount: number;
    changedCount: number;
  } | null;
  history?: Array<{
    date: string;
    score: number;
  }>;
  methodology: {
    scanners: Array<{ name: string; description: string; category: string }>;
    safetyControls: string[];
    ssrfNotice: string;
  };
  limitations: string[];
  conclusion: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/**
 * Sanitizes sensitive patterns in finding evidence/descriptions (e.g. auth tokens, api keys, passwords).
 */
export function sanitizeReportText(text: string | null | undefined): string | null {
  if (!text) return null;

  return text
    .replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1[REDACTED]')
    .replace(/(Authorization:\s*)[^\r\n]+/gi, '$1[REDACTED]')
    .replace(/((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[=:]\s*)[^\s;&]+/gi, '$1[REDACTED]')
    .replace(/((?:connect\.sid|phpsessid|jsessionid|csrftoken|session|auth_token|token)\s*=\s*)[^;]+/gi, '$1[REDACTED]');
}

/**
 * Computes grade string from integer security score.
 */
export function getScoreGrade(score: number): 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical' {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'Poor';
  return 'Critical';
}

export function formatDuration(startedAt?: Date | null, completedAt?: Date | null): string {
  if (!startedAt || !completedAt) return 'N/A';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Transforms raw Scan database model and relations into structured ReportData.
 */
export function buildReportData(params: {
  reportId: string;
  scan: Scan & { target?: Target | null; findings?: Finding[] };
  comparison?: {
    previousScore: number | null;
    currentScore: number | null;
    scoreDifference: number;
    resolvedCount: number;
    newCount: number;
    persistentCount: number;
    changedCount: number;
  } | null;
  history?: Array<{ date: string; score: number }>;
}): ReportData {
  const { reportId, scan, comparison, history } = params;

  const target = scan.target || {
    url: 'Unknown Target',
    hostname: 'unknown',
    normalizedUrl: 'Unknown Target',
  };

  const rawFindings = scan.findings || [];

  // Sort findings deterministically: Severity (CRITICAL -> INFO), then Category, then Title
  const sortedFindings = [...rawFindings].sort((a, b) => {
    const weightA = SEVERITY_ORDER[a.severity] || 0;
    const weightB = SEVERITY_ORDER[b.severity] || 0;
    if (weightB !== weightA) return weightB - weightA;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.title.localeCompare(b.title);
  });

  const formattedFindings: ReportFinding[] = sortedFindings.map((f, idx) => ({
    index: idx + 1,
    title: f.title,
    category: f.category,
    severity: f.severity as ReportFinding['severity'],
    confidence: f.confidence as ReportFinding['confidence'],
    affectedComponent: f.affectedComponent || null,
    description: sanitizeReportText(f.description) || '',
    evidence: sanitizeReportText(f.evidence),
    impact: sanitizeReportText(f.impact),
    remediation: f.remediation || 'Review configuration according to standard hardening guidelines.',
    reference: f.reference || null,
  }));

  const score = scan.securityScore ?? 100;
  const grade = getScoreGrade(score);

  // Dynamic posture observations based on actual findings categories
  const categoriesPresent = Array.from(new Set(rawFindings.map(f => f.category)));
  const postureObservations: string[] = [];

  if (rawFindings.some(f => f.severity === 'CRITICAL')) {
    postureObservations.push('Critical transport or configuration risks identified requiring urgent intervention.');
  }
  if (categoriesPresent.includes('HEADERS')) {
    postureObservations.push('Defense-in-depth HTTP security headers (CSP, HSTS, X-Content-Type-Options) configuration.');
  }
  if (categoriesPresent.includes('COOKIES')) {
    postureObservations.push('Cookie security posture (Secure, HttpOnly, SameSite, and Domain scoping).');
  }
  if (categoriesPresent.includes('TLS') || categoriesPresent.includes('HTTP')) {
    postureObservations.push('SSL/TLS transport encryption settings and certificate lifecycle status.');
  }
  if (categoriesPresent.includes('CORS')) {
    postureObservations.push('Cross-Origin Resource Sharing (CORS) origin policy and credentials authorization.');
  }
  if (categoriesPresent.includes('INFORMATION_DISCLOSURE') || categoriesPresent.includes('TECHNOLOGY')) {
    postureObservations.push('Server and framework metadata leakage in response headers and HTML meta tags.');
  }
  if (postureObservations.length === 0) {
    postureObservations.push('No significant defensive omissions detected across all executed checks.');
  }

  const generatedDate = new Date();
  const formattedGeneratedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(generatedDate);

  const durationFormatted = formatDuration(scan.startedAt, scan.completedAt);

  return {
    reportId,
    generatedAt: formattedGeneratedDate,
    classification: 'Confidential — Authorized Security Assessment',
    target: {
      url: target.url,
      hostname: target.hostname,
      normalizedUrl: target.normalizedUrl,
    },
    scan: {
      id: scan.id,
      startedAt: scan.startedAt ? new Date(scan.startedAt).toUTCString() : null,
      completedAt: scan.completedAt ? new Date(scan.completedAt).toUTCString() : null,
      durationFormatted,
      status: scan.status,
    },
    executiveSummary: {
      overview: `WebShield conducted an automated, non-destructive security assessment of ${target.hostname}. The assessment evaluated external security configuration including HTTP response headers, transport encryption (TLS/HTTPS), cookie flags, CORS policies, and information disclosure indicators.`,
      securityScore: score,
      grade,
      scoreSummary: `The target achieved a security score of ${score} / 100 (${grade}).`,
      totalFindings: scan.totalFindings,
      criticalCount: scan.criticalCount,
      highCount: scan.highCount,
      mediumCount: scan.mediumCount,
      lowCount: scan.lowCount,
      infoCount: scan.infoCount,
      postureObservations,
    },
    findings: formattedFindings,
    comparison: comparison || null,
    history: history || [],
    methodology: {
      scanners: [
        {
          name: 'HTTPS & SSL/TLS Scanner',
          category: 'TRANSPORT',
          description: 'Validates default HTTPS redirection, certificate chain validity, SAN matches, expiration timeline, and mixed content forms.',
        },
        {
          name: 'HTTP Security Headers Scanner',
          category: 'HEADERS',
          description: 'Evaluates Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.',
        },
        {
          name: 'Cookie Security Flags Scanner',
          category: 'COOKIES',
          description: 'Audits sensitive session cookies for Secure, HttpOnly, SameSite attributes, and overly permissive domain scoping.',
        },
        {
          name: 'CORS Policy Scanner',
          category: 'CORS',
          description: 'Assesses Access-Control-Allow-Origin wildcard policies, credential exposure, and dangerous HTTP method permissions.',
        },
        {
          name: 'TLS Protocol & Cipher Scanner',
          category: 'CRYPTO',
          description: 'Inspects negotiated TLS protocol versions and checks for obsolete protocols (TLS 1.0, 1.1) or legacy cipher suites.',
        },
        {
          name: 'Information Disclosure Scanner',
          category: 'RECON',
          description: 'Detects version leakage in Server headers, X-Powered-By banners, ASP.NET headers, and HTML meta tags.',
        },
        {
          name: 'Technology Detection Scanner',
          category: 'INVENTORY',
          description: 'Passively inventories underlying web frameworks, content management systems, and reverse proxy infrastructure.',
        },
        {
          name: 'Well-Known & Security Policy Scanner',
          category: 'POLICY',
          description: 'Probes for standardized security contact policies (security.txt) and crawler directives (robots.txt).',
        },
      ],
      safetyControls: [
        'Strict 10-second socket timeout per connection to prevent slowloris hangs',
        'Global 20-request budget ceiling per scan session',
        'Maximum 5 redirect hops with destination re-validation',
        'Strict 5 MB response body streaming buffer limit',
        'Automated SSRF Guard blocking RFC 1918, link-local, loopback, and cloud metadata IPs',
        'Dual IPv4 (A) and IPv6 (AAAA) DNS resolution validation',
      ],
      ssrfNotice: 'All outbound target network requests are strictly validated prior to socket connection to prevent access to private, internal, or cloud metadata networks.',
    },
    limitations: [
      'WebShield performs non-destructive, passive automated checks on publicly accessible endpoints.',
      'The assessment does not execute offensive exploitation payloads, SQL injection, XSS fuzzing, or credential brute-forcing.',
      'This report evaluates point-in-time public configuration and does not constitute a full manual penetration test or source code audit.',
      'The absence of findings does not guarantee that the target is free from application-logic or zero-day vulnerabilities.',
    ],
    conclusion:
      scan.criticalCount > 0 || scan.highCount > 0
        ? 'The assessment identified security misconfigurations that warrant immediate remediation. Priority should be given to resolving Critical and High severity findings, followed by hardening defense-in-depth headers and cookie controls.'
        : scan.mediumCount > 0
        ? 'The target demonstrates a solid baseline security posture with opportunities for defense-in-depth hardening. Implementing the recommended security headers and cookie policies will significantly improve resilience.'
        : 'The target demonstrates a strong defensive security posture across all evaluated passive security controls.',
  };
}
