# WebShield Security Reporting & PDF Export Architecture

This document describes the design, architecture, security controls, and formatting specifications of the **WebShield Reporting Engine** introduced in Phase 6.

---

## 1. Overview & Objectives

WebShield transforms raw vulnerability and configuration scans into professional, client-ready security assessment reports in standard A4 PDF format.

Key design principles:
1. **Zero Fabrication**: Every score, finding, affected component, and date originates strictly from recorded scan data.
2. **Deterministic & Structured Layout**: Professional corporate styling with consistent typography, branded cover page, executive summaries, score breakdown formulas, detailed technical evidence boxes, remediation guides, and safety disclaimers.
3. **Sensitive Data Redaction**: Automatic stripping and masking of authorization tokens, Bearer headers, passwords, secrets, and session cookies (`connect.sid`, `phpsessid`, `jwt`, `token`) before document compilation.
4. **Strict Security Controls**:
   - **IDOR Protection**: Multi-tenant authorization ensures users can only generate and download reports for scans they own (`scan.userId === authenticatedUser.id` and `report.userId === authenticatedUser.id`).
   - **Path Traversal Defense**: Strict validation rejecting `..`, `/`, and `\` in identifiers, combined with canonical path prefix assertions against the server's designated report storage directory.
   - **Audit Trail**: Every report generation event is immutably recorded in the security audit log (`AuditAction.REPORT_GENERATED`).

---

## 2. Architecture & Data Flow

```text
┌───────────────────────────┐
│     Client / Browser      │
└─────────────┬─────────────┘
              │  POST /api/scans/:id/reports
              ▼
┌───────────────────────────┐
│  Scan / Report Controller │ ── (Checks ownership & COMPLETED status)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│    Report Data Builder    │ ── (Sanitizes credentials, sorts findings,
└─────────────┬─────────────┘     calculates summary observations)
              │
              ▼
┌───────────────────────────┐
│    PDFKit Report Engine   │ ── (Renders multi-page A4 PDF stream)
└─────────────┬─────────────┘
              │
              ├─────────────────────────────┬─────────────────────────────┐
              ▼                             ▼                             ▼
   Local File Storage            Database Record Update             Audit Logger
(`apps/api/storage/reports`)      (Prisma `Report` status)    (`REPORT_GENERATED`)
```

---

## 3. PDF Document Structure

The generated report contains the following structured sections:

1. **Cover Page**:
   - WebShield branding header with cybersecurity shield badge.
   - Confidentiality banner: `CONFIDENTIAL - AUTHORIZED ASSESSMENT ONLY`.
   - Assessment Metadata: Target URL, Hostname, Assessment ID, Generation Date, and Scope Classification.
   - Prominent **Security Score Badge** with colored grade capsule (`Excellent`, `Good`, `Moderate`, `Poor`, `Critical`).
2. **Executive Summary**:
   - Assessment overview explaining the passive evaluation scope.
   - Metric cards displaying counts for **Critical**, **High**, **Medium**, **Low**, and **Informational** findings.
   - Automated posture observations dynamically derived from scan categories.
3. **Security Score Breakdown**:
   - Explanation of the scoring formula (base 100 with severity deductions and caps).
   - Summary breakdown table showing deduction weights, detected finding counts, and net impact.
4. **Detailed Technical Findings Catalog**:
   - Deterministically ordered: **Severity (Critical → Info)**, then Category, then Title.
   - Each finding includes:
     - Header bar with severity badge, category, confidence rating, and affected component.
     - Technical description and business/security impact.
     - **Monospace Evidence Box** displaying sanitized raw headers or evidence snippets.
     - **Actionable Remediation Box** with concrete hardening steps.
     - Clickable reference links (OWASP, RFC, MDN).
5. **Security Posture Trend / Scan Comparison** (when comparison data exists):
   - Score delta (+/-) and counts for Resolved, New, and Persistent findings.
6. **Methodology & Safety Limits**:
   - Explicit list of active non-destructive scanner modules (Headers, Cookies, TLS/SSL, Info Disclosure, DNS).
   - Rate limit and request budget disclosures.
   - Active SSRF protection and non-destructive execution guarantees.
7. **Legal Scope & Limitations Disclaimer**:
   - Non-destructive point-in-time assessment notice.
   - Clear statement that passive scanning does not replace in-depth manual penetration testing or application source code audits.
8. **Running Headers & Footers**:
   - Dynamically applied across all pages after cover with confidentiality marking and page numbering ("Page X of Y").

---

## 4. API Endpoints

### 1. Generate Report for Scan
- **Route**: `POST /api/scans/:id/reports`
- **Auth**: Required (`USER` or `ADMIN`)
- **Status**: `201 Created`
- **Response**:
```json
{
  "success": true,
  "data": {
    "report": {
      "id": "cm...report_id",
      "scanId": "cm...scan_id",
      "status": "COMPLETED",
      "fileName": "webshield-example.com-2026-08-27.pdf",
      "fileSize": 45120,
      "createdAt": "2026-08-27T10:00:00.000Z",
      "generatedAt": "2026-08-27T10:00:02.000Z",
      "targetHostname": "example.com",
      "targetUrl": "https://example.com",
      "securityScore": 88
    }
  }
}
```

### 2. Download Report PDF
- **Route**: `GET /api/reports/:id/download`
- **Auth**: Required (`USER` or `ADMIN`)
- **Headers**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="webshield-example.com-2026-08-27.pdf"`
- **Response**: Binary PDF Stream

### 3. Get Report Metadata
- **Route**: `GET /api/reports/:id`
- **Auth**: Required (`USER` or `ADMIN`)
- **Status**: `200 OK`

### 4. List User Reports
- **Route**: `GET /api/reports?page=1&limit=20`
- **Auth**: Required (`USER` or `ADMIN`)
- **Status**: `200 OK`

---

## 5. Security & Protection Controls

| Risk | Mitigation |
| :--- | :--- |
| **IDOR (Unauthorized Report Access)** | Verified at service layer: `report.userId === authenticatedUser.id` and `scan.userId === authenticatedUser.id`. Rejects with `403 Forbidden`. |
| **Path Traversal (`../../etc/passwd`)** | 1. Input filtering rejects `..`, `/`, `\` in report identifiers.<br>2. `path.resolve(report.filePath)` must strictly start with `path.resolve(REPORTS_STORAGE_DIR)`. |
| **Credential Leakage in Reports** | Automated regex sanitizer replaces Bearer tokens, passwords, API keys, and session cookies with `[REDACTED]`. |
| **Tampering & Stale Reports** | Reports are linked immutably to a specific scan ID and its static finding records. |
| **Resource Exhaustion** | Reuses already generated valid PDF report if one exists for the scan instead of recompiling. |
