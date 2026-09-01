import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import { buildReportData, sanitizeReportText } from '../services/pdf/reportDataBuilder';
import { generatePdfReport } from '../services/pdf/pdfGenerator';
import { ScanStatus, Severity, Confidence } from '@prisma/client';

class BufferWritable extends Writable {
  private chunks: Buffer[] = [];

  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk);
    callback();
  }

  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

describe('Report Data Builder & Sanitization', () => {
  it('redacts sensitive credentials and tokens in text', () => {
    const raw = 'Auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and session=secret12345; password=supersecret';
    const sanitized = sanitizeReportText(raw);

    expect(sanitized).toContain('Bearer [REDACTED]');
    expect(sanitized).toContain('session=[REDACTED]');
    expect(sanitized).toContain('password=[REDACTED]');
    expect(sanitized).not.toContain('secret12345');
    expect(sanitized).not.toContain('supersecret');
  });

  it('builds structured ReportData with deterministic sorting and posture summaries', () => {
    const mockScan = {
      id: 'scan-1',
      targetId: 'target-1',
      userId: 'user-1',
      status: ScanStatus.COMPLETED,
      startedAt: new Date('2026-08-27T10:00:00Z'),
      completedAt: new Date('2026-08-27T10:00:05Z'),
      securityScore: 78,
      totalFindings: 2,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      errorMessage: null,
      createdAt: new Date('2026-08-27T10:00:00Z'),
      updatedAt: new Date('2026-08-27T10:00:05Z'),
      target: {
        id: 'target-1',
        userId: 'user-1',
        url: 'https://example.com',
        normalizedUrl: 'https://example.com',
        hostname: 'example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      findings: [
        {
          id: 'f-1',
          scanId: 'scan-1',
          scanner: 'headers',
          title: 'Missing Content-Security-Policy',
          category: 'HEADERS',
          severity: Severity.HIGH,
          confidence: Confidence.HIGH,
          description: 'No CSP header present.',
          evidence: 'Content-Type: text/html',
          impact: 'Increases XSS risk.',
          remediation: 'Implement a CSP.',
          reference: 'https://developer.mozilla.org',
          affectedComponent: 'Content-Security-Policy',
          createdAt: new Date(),
        },
        {
          id: 'f-2',
          scanId: 'scan-1',
          scanner: 'cookies',
          title: 'Cookie Missing Secure Flag',
          category: 'COOKIES',
          severity: Severity.MEDIUM,
          confidence: Confidence.HIGH,
          description: 'Session cookie lacking Secure attribute.',
          evidence: 'Set-Cookie: session=123',
          impact: 'Cleartext cookie transmission.',
          remediation: 'Add Secure flag.',
          reference: null,
          affectedComponent: 'session',
          createdAt: new Date(),
        },
      ],
    };

    const reportData = buildReportData({
      reportId: 'rep-1',
      scan: mockScan,
    });

    expect(reportData.reportId).toBe('rep-1');
    expect(reportData.target.hostname).toBe('example.com');
    expect(reportData.executiveSummary.securityScore).toBe(78);
    expect(reportData.executiveSummary.grade).toBe('Good');
    expect(reportData.findings.length).toBe(2);
    expect(reportData.findings[0].severity).toBe('HIGH'); // Sorted by severity
    expect(reportData.findings[1].severity).toBe('MEDIUM');
  });
});

describe('PDF Report Generator (PDFKit)', () => {
  it('generates a valid, multi-page binary PDF document', async () => {
    const mockScan = {
      id: 'scan-test',
      targetId: 'target-1',
      userId: 'user-1',
      status: ScanStatus.COMPLETED,
      startedAt: new Date('2026-08-27T10:00:00Z'),
      completedAt: new Date('2026-08-27T10:00:03Z'),
      securityScore: 85,
      totalFindings: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      infoCount: 0,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      target: {
        id: 'target-1',
        userId: 'user-1',
        url: 'https://test-site.org',
        normalizedUrl: 'https://test-site.org',
        hostname: 'test-site.org',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      findings: [
        {
          id: 'f-1',
          scanId: 'scan-test',
          scanner: 'headers',
          title: 'Missing Strict-Transport-Security Header',
          category: 'HEADERS',
          severity: Severity.MEDIUM,
          confidence: Confidence.HIGH,
          description: 'The target does not enforce HSTS.',
          evidence: 'Strict-Transport-Security header missing',
          impact: 'Vulnerable to SSL stripping.',
          remediation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
          reference: 'https://owasp.org',
          affectedComponent: 'Strict-Transport-Security',
          createdAt: new Date(),
        },
      ],
    };

    const reportData = buildReportData({
      reportId: 'rep-test',
      scan: mockScan,
      comparison: {
        previousScore: 65,
        currentScore: 85,
        scoreDifference: 20,
        resolvedCount: 2,
        newCount: 0,
        persistentCount: 1,
        changedCount: 0,
      },
    });

    const stream = new BufferWritable();
    await generatePdfReport(reportData, stream);

    const pdfBuffer = stream.getBuffer();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic Number: starts with %PDF-
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('generates report cleanly when target has zero findings', async () => {
    const mockCleanScan = {
      id: 'scan-clean',
      targetId: 'target-clean',
      userId: 'user-1',
      status: ScanStatus.COMPLETED,
      startedAt: new Date(),
      completedAt: new Date(),
      securityScore: 100,
      totalFindings: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      target: {
        id: 'target-clean',
        userId: 'user-1',
        url: 'https://hardened.example.com',
        normalizedUrl: 'https://hardened.example.com',
        hostname: 'hardened.example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      findings: [],
    };

    const reportData = buildReportData({
      reportId: 'rep-clean',
      scan: mockCleanScan,
    });

    const stream = new BufferWritable();
    await generatePdfReport(reportData, stream);

    const pdfBuffer = stream.getBuffer();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('handles special characters and Unicode without throwing', async () => {
    const mockSpecialScan = {
      id: 'scan-special',
      targetId: 'target-1',
      userId: 'user-1',
      status: ScanStatus.COMPLETED,
      startedAt: new Date(),
      completedAt: new Date(),
      securityScore: 70,
      totalFindings: 1,
      criticalCount: 0,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      target: {
        id: 'target-1',
        userId: 'user-1',
        url: 'https://special.example.com?foo=bar&test=<script>',
        normalizedUrl: 'https://special.example.com',
        hostname: 'special.example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      findings: [
        {
          id: 'f-special',
          scanId: 'scan-special',
          scanner: 'headers',
          title: 'Special Chars & "<script>alert(1)</script>" / \\ % #',
          category: 'HEADERS',
          severity: Severity.HIGH,
          confidence: Confidence.HIGH,
          description: 'Testing special chars: <>&"\'/\\% and emojis: 🛡️ 🔒 ⚠️',
          evidence: '<div class="test">foo & bar \'baz\'</div>',
          impact: 'Testing impact text.',
          remediation: 'Testing remediation text.',
          reference: 'https://example.com/ref?a=1&b=2',
          affectedComponent: 'header-name',
          createdAt: new Date(),
        },
      ],
    };

    const reportData = buildReportData({
      reportId: 'rep-special',
      scan: mockSpecialScan,
    });

    const stream = new BufferWritable();
    await generatePdfReport(reportData, stream);

    const pdfBuffer = stream.getBuffer();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
