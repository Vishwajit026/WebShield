export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type StandardCategory =
  | 'TLS'
  | 'HEADERS'
  | 'COOKIES'
  | 'CORS'
  | 'HTTP'
  | 'INFORMATION_DISCLOSURE'
  | 'TECHNOLOGY'
  | 'CONTENT'
  | 'CONFIGURATION';

export interface FindingInput {
  scanner: string;
  title: string;
  category: StandardCategory | string;
  severity: Severity;
  confidence: Confidence;
  description: string;
  evidence?: string;
  impact?: string;
  remediation?: string;
  reference?: string;
  affectedComponent?: string;
}

export interface HTTPResponseData {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string | string[] | undefined>;
  rawHeaders: string[];
  body: string;
  redirects: string[];
  timing: {
    dnsLookupMs: number;
    tcpConnectMs: number;
    tlsHandshakeMs?: number;
    totalMs: number;
  };
}

export interface TLSData {
  authorized: boolean;
  authorizationError?: string;
  protocol?: string;
  cipherName?: string;
  cipherVersion?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  issuer?: {
    C?: string;
    O?: string;
    CN?: string;
  };
  subject?: {
    CN?: string;
  };
  subjectAltNames?: string[];
  fingerprint?: string;
}

export interface ScanContext {
  targetUrl: string;
  normalizedUrl: string;
  hostname: string;
  port: number;
  isHttps: boolean;
  httpResponse?: HTTPResponseData;
  httpsResponse?: HTTPResponseData;
  securityTxtResponse?: HTTPResponseData;
  robotsTxtResponse?: HTTPResponseData;
  tlsInfo?: TLSData;
  options: EngineOptions;
  executedScanners: string[];
  scannerErrors: Record<string, string>;
}

export interface EngineOptions {
  timeoutMs?: number;
  maxRequests?: number;
  maxRedirects?: number;
  maxResponseSizeBytes?: number;
  userAgent?: string;
}

export interface ScoreDeduction {
  severity: Severity;
  count: number;
  deductionPerFinding: number;
  totalPoints: number;
  description: string;
}

export interface ScoreExplanation {
  baseScore: number;
  totalDeductions: number;
  deductions: ScoreDeduction[];
  summary: string;
}

export interface ScoreDetails {
  score: number;
  grade: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical';
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalFindings: number;
  explanation: ScoreExplanation;
}

export interface EngineResult {
  targetUrl: string;
  normalizedUrl: string;
  hostname: string;
  startedAt: Date;
  completedAt: Date;
  findings: FindingInput[];
  score: ScoreDetails;
  executedScanners: string[];
  scannerErrors: Record<string, string>;
}

export interface Scanner {
  id: string;
  name: string;
  version: string;
  description: string;
  category: StandardCategory | string;
  riskLevel: Severity;
  scan(context: ScanContext): Promise<FindingInput[]>;
}

// ── Comparison Types ──────────────────────────────────────────────────────────

export type FindingComparisonStatus = 'RESOLVED' | 'NEW' | 'PERSISTENT' | 'CHANGED';

export interface ComparisonFinding extends FindingInput {
  fingerprint: string;
  status: FindingComparisonStatus;
  previousSeverity?: Severity;
  previousConfidence?: Confidence;
}

export interface ScanComparisonResult {
  previousScanId: string;
  currentScanId: string;
  previousScore: number | null;
  currentScore: number | null;
  scoreDifference: number;
  previousTotalFindings: number;
  currentTotalFindings: number;
  newCount: number;
  resolvedCount: number;
  persistentCount: number;
  changedCount: number;
  findings: ComparisonFinding[];
}
