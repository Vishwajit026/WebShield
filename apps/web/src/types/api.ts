// ── Auth types ────────────────────────────────────────────────────────────────

export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSuspended?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// ── Auth request/response types ───────────────────────────────────────────────

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

// ── Scan & Findings types (Phase 3+) ──────────────────────────────────────────

export type ScanStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Target {
  id: string;
  userId: string;
  url: string;
  normalizedUrl: string;
  hostname: string;
  createdAt: string;
  updatedAt: string;
}

export interface Finding {
  id: string;
  scanId: string;
  scanner: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  description: string;
  evidence?: string | null;
  impact?: string | null;
  remediation?: string | null;
  reference?: string | null;
  affectedComponent?: string | null;
  createdAt: string;
}

export interface Scan {
  id: string;
  targetId: string;
  userId: string;
  status: ScanStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  securityScore?: number | null;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  target?: Target;
  findings?: Finding[];
}

export interface CreateScanRequest {
  url: string;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedScansResponse {
  scans: Scan[];
  pagination: PaginationMetadata;
}

// ── Report types (Phase 6) ───────────────────────────────────────────────────

export type ReportStatus = 'GENERATING' | 'COMPLETED' | 'FAILED';

export interface Report {
  id: string;
  scanId: string;
  status: ReportStatus;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
  generatedAt: string | null;
  targetHostname?: string;
  targetUrl?: string;
  securityScore?: number | null;
}

export interface PaginatedReportsResponse {
  reports: Report[];
  pagination: PaginationMetadata;
}

// ── Target Management types ───────────────────────────────────────────────────

export interface TargetSummary {
  id: string;
  url: string;
  normalizedUrl: string;
  hostname: string;
  createdAt: string;
  updatedAt: string;
  totalScans: number;
  latestScan?: {
    id: string;
    status: ScanStatus;
    securityScore: number | null;
    completedAt: string | null;
    createdAt: string;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
  };
}

export interface PaginatedTargetsResponse {
  targets: TargetSummary[];
  pagination: PaginationMetadata;
}

// ── Comparison types ──────────────────────────────────────────────────────────

export type FindingComparisonStatus = 'RESOLVED' | 'NEW' | 'PERSISTENT' | 'CHANGED';

export interface ComparisonFinding extends Finding {
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
  beforeTarget?: Target;
  afterTarget?: Target;
  beforeStartedAt?: string | null;
  afterStartedAt?: string | null;
  beforeCompletedAt?: string | null;
  afterCompletedAt?: string | null;
}

// ── Dashboard Overview types ──────────────────────────────────────────────────

export interface ScoreTrendPoint {
  scanId: string;
  targetUrl: string;
  hostname: string;
  score: number;
  completedAt: string;
}

export interface DashboardOverview {
  totalScans: number;
  completedScans: number;
  activeScans: number;
  failedScans: number;
  totalFindings: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  latestScan: {
    id: string;
    targetUrl: string;
    hostname: string;
    status: ScanStatus;
    securityScore: number | null;
    grade: 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Critical' | null;
    completedAt: string | null;
    totalFindings: number;
  } | null;
  recentScans: Array<{
    id: string;
    targetUrl: string;
    hostname: string;
    status: ScanStatus;
    securityScore: number | null;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    createdAt: string;
    completedAt: string | null;
  }>;
  scoreTrend: ScoreTrendPoint[];
}

// ── Admin Subsystem types (Phase 7) ──────────────────────────────────────────

export interface AdminOverview {
  metrics: {
    users: {
      total: number;
      active: number;
      suspended: number;
    };
    scans: {
      total: number;
      today: number;
      active: number;
      completed: number;
      failed: number;
      averageDurationSeconds: number;
    };
    findings: {
      total: number;
      bySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
      };
    };
    reports: {
      total: number;
    };
  };
  recentFailures: Array<{
    id: string;
    targetHostname: string;
    targetUrl: string;
    userEmail: string;
    errorMessage: string;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    userEmail: string;
    ipAddress: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: {
      status: string;
      latencyMs: number;
    };
    scanner: {
      status: string;
      engine: string;
      protection: string;
    };
    application: {
      status: string;
      uptimeSeconds: number;
      memoryUsageMb: number;
      totalMemoryMb: number;
    };
    storage: {
      status: string;
    };
  };
  checkedAt: string;
  responseTimeMs: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  totalScans: number;
  totalReports: number;
  totalTargets: number;
}

export interface PaginatedAdminUsersResponse {
  users: AdminUser[];
  pagination: PaginationMetadata;
}

export interface AdminUserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isSuspended: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    activeSessions: Array<{
      id: string;
      userAgent: string | null;
      ipAddress: string | null;
      createdAt: string;
      expiresAt: string;
    }>;
    totalScans: number;
    totalTargets: number;
    totalReports: number;
    recentScans: Array<{
      id: string;
      targetHostname: string;
      targetUrl: string;
      status: ScanStatus;
      securityScore: number | null;
      createdAt: string;
    }>;
    recentReports: Report[];
  };
}

export interface AdminScan {
  id: string;
  targetHostname: string;
  targetUrl: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  status: ScanStatus;
  securityScore: number | null;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PaginatedAdminScansResponse {
  scans: AdminScan[];
  pagination: PaginationMetadata;
}

export interface AdminFinding {
  id: string;
  scanId: string;
  scanner: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: Confidence;
  description: string;
  evidence: string | null;
  impact: string | null;
  remediation: string | null;
  reference: string | null;
  affectedComponent: string | null;
  createdAt: string;
  targetHostname: string;
  targetUrl: string;
  userEmail: string;
}

export interface PaginatedAdminFindingsResponse {
  findings: AdminFinding[];
  pagination: PaginationMetadata;
}

export interface AdminReport {
  id: string;
  scanId: string;
  status: ReportStatus;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
  generatedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  targetHostname?: string;
  targetUrl?: string;
  securityScore?: number | null;
}

export interface PaginatedAdminReportsResponse {
  reports: AdminReport[];
  pagination: PaginationMetadata;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedAdminAuditLogsResponse {
  logs: AdminAuditLog[];
  pagination: PaginationMetadata;
}

// ── API response envelope ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
}
