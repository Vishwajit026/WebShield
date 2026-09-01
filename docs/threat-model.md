# WebShield Security Threat Model & Risk Analysis

This document details the threat modeling, STRIDE risk evaluation, attack surfaces, and mitigation controls for the **WebShield Enterprise Security Assessment Platform**.

---

## 1. Threat Analysis & Mitigation Matrix

| Threat | Risk | Mitigation | Remaining Risk |
| :--- | :---: | :--- | :--- |
| **SSRF (Server-Side Request Forgery)** | **High** | Synchronous DNS resolution, strict CIDR blocklisting (RFC1918, loopback, link-local, cloud metadata `169.254.169.254`), and custom socket IP pinning to eliminate DNS rebinding. | Complex IPv6 dual-stack transitions or external open proxy relays if intentionally scanned by user. |
| **IDOR (Insecure Direct Object Reference)** | **High** | Multi-tenant database query scoping enforcing `userId === req.user.id` across all scan, target, and report endpoints. | None within application logic; relies on database query integrity. |
| **Privilege Escalation** | **High** | Backend `requireRole('ADMIN')` middleware gatekeeping all `/api/admin/*` routes; self-demotion and last-admin domain invariants. | Compromise of an existing administrator's credentials. |
| **Path Traversal** | **High** | Deterministic UUID filenames (`{reportId}.pdf`), character rejection (`..`, `/`, `\`), and canonical storage path validation (`path.resolve`). | Misconfiguration of underlying server filesystem permissions. |
| **Brute Force & Credential Stuffing** | **Medium** | Tiered rate limiting on auth endpoints (15 req / 15 min / IP); Argon2id password hashing with unique salts. | Distributed attacks across large botnets without IP-reputation WAF at edge. |
| **XSS (Cross-Site Scripting)** | **Medium** | React automatic JSX context-aware output encoding; access tokens held exclusively in memory (never in `localStorage`). | Potential third-party script injection if untrusted dependencies are introduced. |
| **CSRF (Cross-Site Request Forgery)** | **Medium** | State-changing API endpoints mandate Bearer JWT Authorization header; refresh cookies enforce `SameSite=Strict`. | Cross-origin requests in non-standard embedded WebView environments. |
| **Information Disclosure** | **Medium** | Health checks scrub internal IPs, hostnames, and secrets; centralized error handler masks production stack traces; sensitive cookies redacted from reports. | Verbose upstream server error responses captured as scan evidence. |
| **Denial of Service (DoS)** | **Medium** | Concurrency bounds (max 2 active scans per user), 10s socket timeouts, request budget caps (max 10 probes/scan), rate limiting on PDF generation. | High-volume network layer volumetric DDoS targeting the host infrastructure. |

---

## 2. Key Attack Surfaces & Detailed Defenses

### A. SSRF (Server-Side Request Forgery)
- **Threat**: Attacker supplies `http://169.254.169.254`, `http://127.0.0.1`, `http://localhost`, or private RFC1918 addresses in the target scan URL to inspect internal metadata servers or intranet services.
- **Defense**: Multi-layer SSRF Guard:
  - Synchronous DNS resolution to determine all target IP addresses.
  - Verification against comprehensive IP blocklists (loopback, link-local, private, broadcast, documentation ranges).
  - DNS Rebinding defense via custom `http.Agent` / `https.Agent` pinning requests to the validated IP address.
  - Safe redirect following with recursive IP validation on every redirect step.

### B. Administrative Privilege Escalation & Bypass
- **Threat**: Attacker sends requests to `/api/admin/users/123/role` or manipulates client state.
- **Defense**:
  - Backend enforcement via `requireRole('ADMIN')` that checks `req.user.role === 'ADMIN'`.
  - Frontend `AdminRoute` shows explicit `403 Forbidden` access-denied state if unauthorized.
  - Database schema enforces enum constraints (`USER`, `ADMIN`).

### C. Self-Lockout & Administrative Hijacking
- **Threat**: Admin accidentally suspends themselves or rogue admin demotes all other admins.
- **Defense**:
  - `admin.service.ts` blocks self-suspension (`SELF_SUSPENSION_BLOCKED`).
  - `admin.service.ts` blocks self-demotion (`SELF_DEMOTION_BLOCKED`).
  - `admin.service.ts` queries active admin count and prevents modifying the last remaining admin (`LAST_ADMIN_PROTECTED`).

### D. Path Traversal on Report Retrieval
- **Threat**: Attacker supplies `../../etc/passwd` or malicious filenames in report retrieval.
- **Defense**:
  - Report files stored with strict UUID filenames (`{reportId}.pdf`).
  - `path.resolve` and boundary verification ensures file path resides strictly inside `REPORTS_STORAGE_DIR`.
  - Content-Disposition and MIME-Type headers strictly set to `application/pdf`.

---

## 3. Security Boundary Summary

```text
[Public Internet]
       │
   (HTTPS / TLS)
       │
[Reverse Proxy / WAF]
       │
   (X-Request-ID, Strict-Transport-Security, Frameguard, NoSniff)
       │
[WebShield Backend Gateway]
       ├── Rate Limiting (Global, Auth, Scan, Admin, Report)
       ├── Authentication (JWT + Session Status)
       └── Authorization (Role === 'ADMIN')
       │
       ├── [Scanner Core] ─── (SSRF Guard & IP Pinning) ───► [External Target]
       ├── [PDF Engine] ───── (Sandbox & Path Check) ──────► [Storage]
       └── [Database Layer] ─ (Prisma ORM & Parameterized) ──► [PostgreSQL]
```
