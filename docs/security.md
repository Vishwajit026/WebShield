# WebShield Comprehensive Security Specification

This document details the complete security architecture, defensive controls, threat mitigations, and operational boundaries implemented in **WebShield**.

---

## 1. Implemented Security Protections

### A. Authentication & Password Security
- **Password Hashing**: Implements `argon2id` with tuned memory cost, iteration count, and unique cryptographic salts. Passwords are never stored in plaintext or reversible formats.
- **Short-Lived Access Tokens**: Ephemeral JSON Web Tokens (JWT) signed with HMAC-SHA256 (`JWT_SECRET`) with a 15-minute expiration (`ACCESS_TOKEN_EXPIRES_IN=15m`).
- **In-Memory Token Storage**: Access tokens are held exclusively in runtime JavaScript memory in the React frontend. They are never stored in `localStorage`, `sessionStorage`, or IndexedDB, neutralizing token extraction via Cross-Site Scripting (XSS).
- **Rotating Refresh Tokens**: Refresh tokens are issued via `HttpOnly`, `SameSite=Strict`, `Secure` cookies with a 7-day expiration. Refresh tokens are hashed using SHA-256 before storage in the database `Session` table.

### B. Authorization & Role-Based Access Control (RBAC)
- **Zero Frontend Reliance**: The frontend UI is treated strictly as an ergonomic presentation layer. All security boundaries are gatekept on the backend via deterministic middleware: `authenticate` followed by `requireRole('ADMIN')`.
- **Granular Role Hierarchy**:
  - `USER`: Can manage own targets, scans, comparisons, and reports.
  - `ADMIN`: Can access system-wide metrics, tenant accounts, subsystem health telemetry, global findings, and immutable audit logs.
- **Self-Protection & Last-Admin Invariants**:
  - `SELF_SUSPENSION_BLOCKED`: Administrators are strictly blocked from suspending their own accounts.
  - `SELF_DEMOTION_BLOCKED`: Administrators cannot remove their own admin privileges.
  - `LAST_ADMIN_PROTECTED`: The system queries active administrator counts and prohibits demoting or suspending the sole active admin.

### C. IDOR (Insecure Direct Object Reference) Protection
- **Multi-Tenant Scoping**: All database queries for scans, targets, and reports strictly enforce tenancy by filtering `userId === req.user.id`.
- **Strict Verification**: Accessing a scan, target, or report belonging to another user returns `403 FORBIDDEN` or `404 NOT_FOUND` without disclosing the resource's existence.

### D. Server-Side Request Forgery (SSRF) Defense
- **Synchronous DNS Pre-Resolution**: Target hostnames are resolved to IP addresses before initiating network connections.
- **Comprehensive CIDR Blocklist**:
  - Loopback (`127.0.0.0/8`, `::1`)
  - Private IPv4 (RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Link-Local IPv4/IPv6 (`169.254.0.0/16`, `fe80::/10`)
  - Cloud Metadata (`169.254.169.254`)
  - Broadcast, Carrier-Grade NAT (`100.64.0.0/10`), Documentation, and Multicast ranges.
- **Socket-Level IP Pinning**: Network requests are pinned directly to the pre-validated IP address using custom HTTP/HTTPS socket agents, eliminating DNS Rebinding attacks (Time-of-Check to Time-of-Use / TOCTOU).
- **Recursive Redirect Validation**: Safe redirect handling re-evaluates destination IP safety on every redirect hop.

### E. Input Validation & Sanitization
- **Strict Schema Validation**: All API inputs (registration, login, scan creation, admin mutations) are validated at the route boundary using **Zod** schemas.
- **URL Normalization**: Normalizes schemes, strips invalid ports, rejects non-HTTP/HTTPS protocols, and rejects embedded credentials (`user:pass@host`).
- **Path Traversal Defense**: Report downloads sanitize filenames, validate canonical directories via `path.resolve`, and reject traversal sequences (`..`, `/`, `\`).

### F. Rate Limiting & DoS Mitigation
- **Multi-Tiered Rate Limiting**:
  - `authRateLimit`: 15 requests / 15 min per IP (Brute-force and credential stuffing defense).
  - `scanRateLimit`: 10 scans / 10 min per IP (Scanner resource exhaustion defense).
  - `reportRateLimit`: 10 PDF reports / 10 min per IP (CPU & memory bounding).
  - `adminRateLimit`: 60 admin actions / 15 min per IP (Administrative automation defense).
  - `refreshRateLimit`: 60 token refreshes / 15 min per IP.

### G. Cross-Site Scripting (XSS) & Header Defenses
- **React Output Encoding**: React automatically escapes untrusted text in JSX rendering.
- **Helmet Security Headers**:
  - `X-Frame-Options: DENY` (Anti-Clickjacking).
  - `X-Content-Type-Options: nosniff` (Anti-MIME Sniffing).
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Enforces HTTPS).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `X-Powered-By` explicitly disabled.
- **PDF Download CSP**: Downloads include `Content-Security-Policy: default-src 'none'` and `X-Content-Type-Options: nosniff`.

### H. Cross-Origin Resource Sharing (CORS) & CSRF Defenses
- **Origin Whitelisting**: CORS middleware strictly validates the `Origin` header against configured domains (`CORS_ORIGIN`). Wildcards (`*`) are disallowed when credentials are exchanged.
- **CORS Error Handling**: Unauthorized origins receive a clean `403 CORS_ORIGIN_NOT_ALLOWED`.
- **CSRF Defense**: State-changing API endpoints require a Bearer token in the `Authorization` header, which browsers never send automatically with cross-origin requests. Refresh cookie uses `SameSite=Strict`.

### I. Anti-Caching Policy
- **Sensitive Data Caching Prevention**: All authenticated API responses enforce `Cache-Control: no-store, no-cache, must-revalidate, private` and `Pragma: no-cache`.

### J. Immutable Audit Logging
- **Append-Only Audit Trail**: Every sensitive action (`REGISTER_SUCCESS`, `LOGIN_SUCCESS`, `USER_SUSPENDED`, `ROLE_CHANGED`, `SCAN_CREATED`, `REPORT_GENERATED`) records user ID, IP address, user-agent, action type, timestamp, and JSON metadata.
- **Zero Mutability**: The database exposes no update or delete endpoints for audit records.

### K. Sensitive Data Handling & Redaction
- **Credential Redaction**: Before generating PDF reports, evidence strings are scrubbed of bearer tokens, passwords, and session cookies (`connect.sid`, `phpsessid`, `jwt`).
- **Telemetry Sanitization**: Admin health checks execute active ping checks without disclosing internal IP addresses, database hostnames, or secret keys.
- **Error Masking**: Production errors log details internally while returning generic JSON error messages to clients without stack traces.

---

## 2. Recommended Future Improvements

The following items are recognized as valuable enhancements for future versions beyond the core scope:

| Area | Recommended Enhancement | Rationale |
| :--- | :--- | :--- |
| **Authentication** | Multi-Factor Authentication (MFA / TOTP) | Adds a second authentication factor for administrative and user accounts. |
| **Storage** | Object Storage Encryption (AWS S3 SSE / GCS CMEK) | Enhances encrypted storage for high-volume enterprise PDF archives. |
| **WAF Integration** | Cloudflare / AWS WAF Managed Rules | Edge-level DDoS mitigation, IP reputation scoring, and bot detection. |
| **Rate Limiting** | Distributed Redis Token Bucket | Allows synchronized rate limiting across multi-instance API clusters. |
| **Audit Trails** | Cryptographic Hash Chaining / SIEM Export | Stream audit logs to external immutable SIEM platforms (Splunk/Datadog). |
