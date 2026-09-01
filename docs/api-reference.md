# WebShield REST API Reference

All API endpoints are prefixed with `/api`. Authenticated endpoints require a standard HTTP Authorization header: `Authorization: Bearer <access_token>`.

---

## 1. System Health

### `GET /api/health`
Public liveness probe for monitoring and load balancers.

- **Authentication**: None
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "WebShield API is running",
  "timestamp": "2026-08-27T17:30:00.000Z"
}
```

---

## 2. Authentication & Sessions (`/api/auth`)

### `POST /api/auth/register`
Creates a new tenant user account and generates a session.

- **Rate Limit**: 15 req / 15 min
- **Request Body**:
```json
{
  "name": "Alex Security",
  "email": "alex@example.com",
  "password": "SuperSecretPassword123!"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "cuid...", "name": "Alex Security", "email": "alex@example.com", "role": "USER" },
    "accessToken": "eyJhbGciOi..."
  },
  "message": "Registration successful"
}
```
*(Sets `refreshToken` HttpOnly cookie)*

### `POST /api/auth/login`
Authenticates with email and password.

- **Rate Limit**: 15 req / 15 min
- **Request Body**: `{ "email": "alex@example.com", "password": "SuperSecretPassword123!" }`
- **Response `200 OK`**: User profile and access token.

### `POST /api/auth/refresh`
Issues a new short-lived access token using the rotating HttpOnly refresh cookie.

- **Rate Limit**: 60 req / 15 min
- **Response `200 OK`**: `{ "success": true, "data": { "accessToken": "eyJhbGciOi..." } }`

### `POST /api/auth/logout`
Revokes the current session and clears the refresh cookie.

- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "success": true, "message": "Logged out successfully" }`

### `GET /api/auth/me`
Fetches the currently authenticated user profile.

- **Authentication**: Bearer Token
- **Response `200 OK`**: `{ "success": true, "data": { "user": { ... } } }`

### `GET /api/auth/sessions`
Lists all active sessions associated with the user account.

- **Authentication**: Bearer Token

### `POST /api/auth/sessions/revoke-others`
Revokes all active sessions except the current one.

- **Authentication**: Bearer Token

---

## 3. Scans & Assessment (`/api/scans`)

### `POST /api/scans`
Initiates a passive security scan against a target URL.

- **Authentication**: Bearer Token
- **Rate Limit**: 10 req / 10 min
- **Request Body**: `{ "url": "https://example.com" }`
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "scan": {
      "id": "cuid...",
      "status": "COMPLETED",
      "securityScore": 85,
      "totalFindings": 3,
      "criticalCount": 0,
      "highCount": 1,
      "mediumCount": 1,
      "lowCount": 1,
      "infoCount": 0,
      "findings": [ ... ],
      "target": { "id": "...", "hostname": "example.com", "url": "https://example.com" }
    }
  }
}
```

### `GET /api/scans`
Lists paginated scans for the authenticated user.

- **Authentication**: Bearer Token
- **Query Params**: `page` (int), `limit` (int), `status` (`COMPLETED` | `FAILED` | `RUNNING`), `search` (string)

### `GET /api/scans/:id`
Retrieves full details and findings for a specific scan (IDOR protected).

- **Authentication**: Bearer Token

### `GET /api/scans/:id/findings`
Retrieves findings for a scan with optional filters (`severity`, `category`).

- **Authentication**: Bearer Token

### `POST /api/scans/:id/cancel`
Cancels an active scan (`QUEUED` or `RUNNING`).

- **Authentication**: Bearer Token

### `GET /api/scans/compare`
Compares two completed scans to generate diffing metrics.

- **Authentication**: Bearer Token
- **Query Params**: `before` (scan ID), `after` (scan ID)
- **Response `200 OK`**: Diff metrics, new findings, recurring findings, resolved findings, and score delta.

---

## 4. Reports & PDF Generation (`/api/reports` & `/api/scans/:id/reports`)

### `POST /api/scans/:id/reports`
Triggers generation of an executive PDF report for a completed scan.

- **Authentication**: Bearer Token
- **Rate Limit**: 10 req / 10 min
- **Response `201 Created`**: Report metadata.

### `GET /api/reports`
Lists all generated reports for the authenticated user.

- **Authentication**: Bearer Token
- **Query Params**: `page` (int), `limit` (int)

### `GET /api/reports/:id`
Retrieves metadata for a specific report.

- **Authentication**: Bearer Token

### `GET /api/reports/:id/download`
Streams the compiled PDF binary document.

- **Authentication**: Bearer Token
- **Headers Returned**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="webshield-example.com-2026-08-27.pdf"`
  - `Content-Security-Policy: default-src 'none'`

---

## 5. Targets (`/api/targets`)

### `GET /api/targets`
Lists all unique target assets registered by the user.

- **Authentication**: Bearer Token

### `GET /api/targets/:id`
Retrieves a target asset and its historical scans.

- **Authentication**: Bearer Token

---

## 6. Dashboard Metrics (`/api/dashboard`)

### `GET /api/dashboard/stats`
Aggregates security metrics: average score, total scans, critical findings count, recent scans, and score trends.

- **Authentication**: Bearer Token

---

## 7. Administrative Subsystem (`/api/admin`)

*All `/api/admin/*` endpoints strictly require `role === 'ADMIN'`.*

### `GET /api/admin/overview`
High-level system KPIs (total users, active scans, failure rates, audit counts).

### `GET /api/admin/health`
Real-time component health checks (DB latency, scanner readiness, memory, storage).

### `GET /api/admin/users`
Paginated directory of tenant user accounts with role and suspension filters.

### `GET /api/admin/users/:id`
Deep user inspector including profile details and active sessions.

### `POST /api/admin/users/:id/suspend`
Suspends user account and revokes active sessions. Blocked for self-suspension or last admin.

### `POST /api/admin/users/:id/reactivate`
Reactivates a suspended user account.

### `POST /api/admin/users/:id/role`
Changes user role (`USER` $\leftrightarrow$ `ADMIN`). Blocked for self-demotion or last admin.

### `GET /api/admin/scans`
System-wide paginated scan explorer.

### `GET /api/admin/scans/:id`
Full scan inspection with admin audit logging.

### `GET /api/admin/findings`
System-wide findings queryable by severity, category, and keyword.

### `GET /api/admin/reports`
System-wide PDF report catalog.

### `GET /api/admin/audit-logs`
Immutable system audit trail with filtering by action, user, and date range.
