# WebShield Technical Interview Guide & FAQs

This guide contains detailed, code-accurate technical explanations for questions frequently asked in software engineering and security engineering interviews.

---

### 1. What is WebShield?
**Answer**: WebShield is a full-stack web application security assessment platform. It performs passive, non-destructive evaluations of external web targets across 9 security vectors (HTTPS enforcement, HTTP security headers, cookie security flags, CORS policies, information disclosure, technology fingerprinting, TLS configurations, `security.txt`, and DNS records). It provides bounded security scoring (0–100), scan comparison diffing, streaming executive PDF generation, and an enterprise administrative console with Zero Trust RBAC.

---

### 2. Why did you build it?
**Answer**: Many real-world security vulnerabilities stem from simple, preventable misconfigurations (e.g., missing CSP, weak cookie flags, or overly permissive CORS). Traditional vulnerability scanners are often intrusive CLI tools that risk taking down production services with active fuzzing payloads, or they lack historical posture tracking, diffing, and executive PDF reporting. I built WebShield to provide engineering and security teams with a safe, automated, passive tool to continuously assess their public-facing web posture without operational risk.

---

### 3. What technologies did you use?
**Answer**:
- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6, TanStack Query 5, Recharts 2, Axios.
- **Backend API**: Node.js 20+, Express 4, TypeScript.
- **Security Engine**: Standalone TypeScript package (`@webshield/security-engine`) utilizing native Node.js `http`/`https`/`dns`/`crypto` APIs.
- **PDF Engine**: PDFKit with custom streaming layout builders.
- **Database & ORM**: PostgreSQL 15+ and Prisma ORM 5.
- **Security & Cryptography**: Argon2id for password hashing, `jsonwebtoken` for access tokens, SHA-256 for session hashes, Helmet for HTTP headers, and Express Rate Limit.
- **Testing**: Vitest 2, Supertest, v8 Coverage.

---

### 4. How does the architecture work?
**Answer**: WebShield is structured as a `pnpm` monorepo:
1. `apps/web`: React SPA client communicating with the backend via REST API calls.
2. `apps/api`: Express REST API gateway managing authentication, authorization, database transactions via Prisma, and PDF compilation.
3. `packages/security-engine`: Headless, zero-database security library containing URL validators, SSRF guards, socket IP pinners, 9 modular scanners, and the scoring/comparison engine.
4. `packages/shared`: Shared TypeScript types across frontend and backend.

Requests flow: `Client ──► Express Gateway (Middleware Chain) ──► Controllers ──► Services ──► Security Engine / Prisma ORM ──► PostgreSQL`.

---

### 5. How does the scanner work?
**Answer**: When a scan is initiated, the target URL is validated and normalized. The target's hostname is resolved synchronously via DNS and checked against an SSRF blocklist. If safe, the `ScannerEngine` concurrently dispatches 9 specialized scanner modules using a custom HTTP agent pinned to the resolved IP. The scanners inspect HTTP status codes, redirection hops, response headers, cookies, and TLS certificate metadata. Raw evidence is extracted, sanitized of sensitive credentials, deduplicated, scored, and persisted in a single database transaction.

---

### 6. How did you prevent SSRF?
**Answer**: I implemented a multi-tiered SSRF defense:
1. **URL Validation**: Rejects non-HTTP/HTTPS protocols, credentials in authority (`user:pass@host`), and invalid port ranges.
2. **DNS Pre-Resolution**: Synchronously resolves all IPv4/IPv6 addresses associated with the hostname.
3. **CIDR Blocklisting**: Compares resolved IPs against a blocklist including loopback (`127.0.0.0/8`, `::1`), private RFC1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), cloud metadata (`169.254.169.254`), broadcast, CGNAT, and multicast ranges.
4. **Socket IP Pinning (Anti-DNS Rebinding)**: Standard HTTP clients re-resolve DNS during the socket connect phase, creating a TOCTOU vulnerability. WebShield uses a custom `http.Agent` / `https.Agent` that overrides `createConnection` to connect directly to the pre-validated IP address while preserving the `Host` header for virtual hosting.
5. **Safe Redirects**: Evaluates the destination IP on every redirect hop with maximum hop limits.

---

### 7. How did you prevent IDOR?
**Answer**: The frontend is never trusted to dictate resource access. All service-layer database queries for scans, targets, and reports strictly filter using the authenticated user's ID (`userId === req.user.id`), derived directly from the verified JWT payload. Cross-tenant access attempts return `403 FORBIDDEN` or `404 NOT_FOUND`.

---

### 8. How does authentication work?
**Answer**: WebShield implements an ephemeral access token + rotating refresh token lifecycle:
- **Registration/Login**: Validates credentials against `argon2id` password hashes. Upon success, generates a 15-minute access token (JWT) and a 7-day refresh token.
- **In-Memory Access Token**: The access token is returned in the JSON response payload and held strictly in client JavaScript memory. It is never stored in `localStorage` or `sessionStorage`, eliminating XSS token theft.
- **HttpOnly Refresh Cookie**: The refresh token is set in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie.
- **Silent Refresh**: An Axios response interceptor catches `401 Unauthorized` responses and calls `/api/auth/refresh` using the cookie to seamlessly restore the in-memory access token without interrupting the user.

---

### 9. How does RBAC work?
**Answer**: RBAC is enforced on the backend via Express middleware chaining:
1. `authenticate`: Verifies JWT signature and checks `user.isSuspended === false` directly in the database.
2. `requireRole('ADMIN')`: Verifies `req.user.role === 'ADMIN'`. If a non-admin user attempts access, it immediately rejects with `403 FORBIDDEN`.
3. Frontend `AdminRoute`: Checks role for UI routing, displaying an "Access Denied" screen if unauthorized.

---

### 10. How are sessions secured?
**Answer**: 
- Refresh tokens are hashed using SHA-256 before storage in the `Session` table (`tokenHash`), preventing token compromise even if the database is leaked.
- Users can view all active sessions (IP address, user agent, creation date) and revoke individual or all other sessions.
- When an administrator suspends a user, all active sessions for that user are immediately revoked, and `authenticate` rejects subsequent access token requests immediately.

---

### 11. How does rate limiting work?
**Answer**: WebShield employs tiered rate limiting via `express-rate-limit`:
- `authRateLimit`: 15 requests / 15 minutes per IP on login/register (brute-force defense).
- `scanRateLimit`: 10 scans / 10 minutes per IP (resource abuse defense).
- `reportRateLimit`: 10 PDF reports / 10 minutes per IP (CPU/memory bounding).
- `adminRateLimit`: 60 administrative mutations / 15 minutes per IP.
- Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are returned in standard HTTP headers.

---

### 12. How are findings generated?
**Answer**: Each scanner module returns structured `RawFinding` objects containing category, title, description, severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), confidence (`HIGH`, `MEDIUM`, `LOW`), sanitized evidence, impact analysis, remediation recommendations, and external references. The engine generates a SHA-256 fingerprint from `scanner + category + title + affectedComponent` to eliminate duplicate findings.

---

### 13. How is the security score calculated?
**Answer**: The scoring engine starts at a baseline of **100 points** and subtracts points based on unique finding severities:
- `CRITICAL`: -25 points
- `HIGH`: -15 points
- `MEDIUM`: -8 points
- `LOW`: -3 points
- `INFO`: 0 points
Point deductions are bounded per category (e.g., max -30 points from Headers) to ensure a single misconfigured category does not disproportionately zero the entire score. The final score is clamped between **0 and 100**.

---

### 14. How does PDF reporting work?
**Answer**: PDF generation uses **PDFKit** to build stream-based multi-page A4 documents:
1. Data builder extracts scan and target details, recalculates score breakdowns, and sanitizes all evidence strings of passwords and session tokens.
2. The generator streams the document: branded cover page, executive summary, score deduction matrix, detailed finding catalog with evidence boxes, methodology disclosures, and legal limitations.
3. The stream writes directly to disk (`apps/api/storage/reports/{reportId}.pdf`) and streams to the client with `Content-Type: application/pdf` and `Content-Security-Policy: default-src 'none'`.

---

### 15. How does the admin panel work?
**Answer**: The admin panel (`/admin`) is restricted to users with the `ADMIN` role. It provides:
- System overview KPIs and global severity distributions.
- User management with role promotion/demotion and suspension workflows.
- Self-protection safeguards (blocks self-suspension, self-demotion, and modifying the last active administrator).
- System-wide scan explorer and global findings search.
- Subsystem health telemetry (PostgreSQL latency, scanner engine status, memory, disk storage) without exposing internal credentials or IP addresses.
- Immutable audit log browser.

---

### 16. Why are audit logs important?
**Answer**: Audit logs provide non-repudiation and forensic visibility into critical system events (`REGISTER_SUCCESS`, `LOGIN_SUCCESS`, `USER_SUSPENDED`, `USER_REACTIVATED`, `ROLE_CHANGED`, `SCAN_CREATED`, `REPORT_GENERATED`). Each log captures the user ID, client IP address, user-agent string, action enum, timestamp, and JSON metadata. The audit log is append-only with no update/delete APIs, ensuring log integrity.

---

### 17. What security limitations remain?
**Answer**:
- **Passive-Only Scope**: WebShield does not perform active exploitation (e.g., SQL injection fuzzing or authenticated session crawling).
- **In-Memory Rate Limiting**: The default rate limiter uses in-memory tracking, which operates per-process rather than globally across distributed load-balanced clusters (can be upgraded to Redis).
- **Public Domain Scans Only**: The SSRF guard strictly blocks internal network testing.

---

### 18. What would you improve next?
**Answer**:
1. **Distributed Rate Limiting**: Integrate Redis token-bucket rate limiting for multi-instance API deployments.
2. **Multi-Factor Authentication (MFA)**: Add TOTP-based 2FA for administrative and user accounts.
3. **Scheduled Recurring Scans**: Add cron-based background scan orchestration to alert users on security regressions.
4. **Webhook Alerts**: Integrate Slack/Discord/webhook notifications when security scores drop below a configured threshold.
