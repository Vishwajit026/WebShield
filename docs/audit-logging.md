# Security Audit Logging Architecture

This document outlines the immutable audit logging subsystem, event taxonomy, data minimization practices, and querying capabilities implemented in **WebShield Phase 7**.

---

## 1. Core Principles

1. **Immutability**: Audit logs are append-only historical records. The API exposes no endpoints for updating (`PUT`/`PATCH`) or deleting (`DELETE`) audit records.
2. **Context Enrichment**: Every log entry captures:
   - Unique Event ID
   - Initiating User (ID, Email, Name, Role) or `null` for anonymous/system actions
   - Action Identifier (strictly typed `AuditAction` enum)
   - Client IPv4/IPv6 Address (sanitized from `X-Forwarded-For` or socket)
   - User Agent Header (truncated/sanitized)
   - Structured JSON Metadata Payload
   - Nanosecond-precision timestamp (`createdAt`)
3. **Data Minimization & Redaction**: Under no circumstances are raw passwords, plaintext JWT tokens, session secrets, or full credit card / identity numbers written to the audit log metadata.

---

## 2. Audit Event Taxonomy

| Action Identifier | Trigger Condition | Captured Metadata |
| :--- | :--- | :--- |
| `LOGIN_SUCCESS` | User successfully authenticated via `/api/auth/login` | `{ email, role, sessionId }` |
| `LOGIN_FAILED` | Invalid credentials provided during authentication | `{ email, reason }` |
| `REGISTER_SUCCESS` | New user account created | `{ email, role }` |
| `PASSWORD_CHANGED` | User changed account password | `{ userId }` |
| `SESSION_REVOKED` | User revoked a specific session token | `{ sessionId }` |
| `ALL_SESSIONS_REVOKED` | User revoked all active sessions | `{ count }` |
| `SCAN_CREATED` | User or admin initiated a new security assessment | `{ scanId, targetUrl, hostname }` |
| `SCAN_COMPLETED` | Assessment finished scanning and scored | `{ scanId, score, totalFindings }` |
| `SCAN_FAILED` | Assessment terminated due to network/engine error | `{ scanId, errorMessage }` |
| `SCAN_CANCELLED` | Running assessment cancelled by user/admin | `{ scanId }` |
| `REPORT_GENERATED` | PDF report compiled and saved to disk | `{ reportId, scanId, fileName }` |
| `REPORT_DOWNLOADED` | PDF report streamed to client browser | `{ reportId, fileName }` |
| `USER_SUSPENDED` | Admin suspended user account & revoked sessions | `{ targetUserId, targetEmail, revokedSessions }` |
| `USER_REACTIVATED` | Admin reactivated suspended user account | `{ targetUserId, targetEmail }` |
| `ROLE_CHANGED` | Admin modified user role (USER $\leftrightarrow$ ADMIN) | `{ targetUserId, targetEmail, previousRole, newRole }` |
| `ADMIN_VIEWED_USER` | Admin inspected sensitive user profile details | `{ viewedUserId, viewedEmail }` |
| `ADMIN_VIEWED_SCAN` | Admin inspected tenant scan details | `{ viewedScanId, targetHostname }` |
| `ADMIN_VIEWED_REPORT`| Admin downloaded or inspected tenant report | `{ viewedReportId }` |

---

## 3. Database Schema

```prisma
model AuditLog {
  id        String       @id @default(uuid())
  userId    String?
  action    AuditAction
  ipAddress String?
  userAgent String?
  metadata  Json?
  createdAt DateTime     @default(now())

  user      User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 4. Querying & Admin Audit Trail UI

Administrators can inspect system audit logs via `GET /api/admin/audit-logs` or the dedicated **Audit Trail** dashboard at `/admin/audit-logs`:
- **Filtering**: By `action`, `userId`, `startDate`, and `endDate`.
- **Pagination**: Configurable page size and total record counting.
- **Payload Inspection**: JSON payload viewer for inspecting structured event context.
