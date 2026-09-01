# WebShield Pre-Deployment Security Checklist

This document provides a mandatory pre-deployment audit checklist for verifying that **WebShield** is hardened against common web and cloud infrastructure vulnerabilities before promoting to production.

---

## 1. Secrets & Cryptographic Hygiene

- [ ] **Cryptographic Randomness**: `JWT_SECRET` and `REFRESH_TOKEN_SECRET` are generated using cryptographically secure random bytes (min. 64 characters / 512-bit entropy).
- [ ] **Secret Segregation**: `JWT_SECRET` and `REFRESH_TOKEN_SECRET` have distinct, non-overlapping values.
- [ ] **No Hardcoded Credentials**: Checked repository via `git log` and `grep` to ensure zero API keys, passwords, or connection strings are tracked in version control.
- [ ] **Development Seed Disabled**: Verified `DEV_ADMIN_PASSWORD` is unset or omitted in the production environment.
- [ ] **Database Connection Hardening**: `DATABASE_URL` specifies `?sslmode=require` or `?sslmode=verify-full` to enforce encrypted database transport.

---

## 2. Network & Boundary Protections

- [ ] **CORS Origin Whitelisting**: `CORS_ORIGIN` is configured to the exact production domain (e.g. `https://webshield.example.com`). Wildcards (`*`) are prohibited.
- [ ] **SSRF Multi-Layer Defense**:
  - `validateAndNormalizeUrl` enforces strict `http:` / `https:` protocols and blocks credentials in URL authority (`user:pass@host`).
  - `validateTargetDestination` enforces synchronous DNS lookup and rejects loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), multicast, and cloud metadata (`169.254.169.254`).
  - Socket IP pinning is enabled to prevent DNS rebinding attacks.
- [ ] **TLS Enforcement**: Reverse proxy (Nginx / CloudFront / Cloudflare) forces HTTP-to-HTTPS redirection with HSTS preload.

---

## 3. Authentication & Session Security

- [ ] **In-Memory Access Tokens**: Access tokens are stored strictly in client runtime memory (never stored in `localStorage`, `sessionStorage`, or IndexedDB).
- [ ] **HttpOnly Refresh Cookies**: Refresh tokens are issued via `HttpOnly`, `SameSite=Strict`, `Secure` cookies with 7-day maximum lifespan.
- [ ] **Token Expiration Bounds**: Access tokens expire in 15 minutes (`ACCESS_TOKEN_EXPIRES_IN=15m`).
- [ ] **Session Invalidation on Suspension**: Account suspension sets `isSuspended=true` and immediately revokes all associated refresh tokens.
- [ ] **Password Security**: Passwords are hashed using `argon2id` with tuned memory and iteration costs.

---

## 4. Authorization & RBAC

- [ ] **Backend-Enforced Authorization**: Every `/api/admin/*` route requires `authenticate` followed by `requireRole('ADMIN')`.
- [ ] **IDOR / Multi-Tenant Isolation**: All user-level queries for scans, targets, and reports strictly filter by `userId === req.user.id`.
- [ ] **Self-Protection Invariants**:
  - Admin cannot suspend their own account (`SELF_SUSPENSION_BLOCKED`).
  - Admin cannot demote their own account (`SELF_DEMOTION_BLOCKED`).
  - Last remaining active administrator cannot be suspended or demoted (`LAST_ADMIN_PROTECTED`).

---

## 5. Defense-in-Depth & Anti-Abuse

- [ ] **Multi-Tier Rate Limiting**:
  - `authRateLimit`: 15 attempts / 15 min per IP.
  - `scanRateLimit`: 10 scans / 10 min per IP.
  - `reportRateLimit`: 10 PDF downloads / 10 min per IP.
  - `adminRateLimit`: 60 admin actions / 15 min per IP.
- [ ] **HTTP Security Headers**:
  - `X-Frame-Options: DENY` (Anti-Clickjacking).
  - `X-Content-Type-Options: nosniff` (Anti-MIME Sniffing).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
  - `X-Powered-By` header disabled.
- [ ] **Anti-Caching Directives**: `Cache-Control: no-store, no-cache, must-revalidate, private` applied to all API responses.
- [ ] **Path Traversal Protection**: PDF downloads sanitize filenames, validate canonical storage directories, and reject `..`, `/`, `\`.
- [ ] **Error Sanitization**: Error handler masks unhandled exceptions as generic `INTERNAL_ERROR` without leaking stack traces or SQL errors.
- [ ] **Append-Only Audit Logs**: Audit events record user ID, IP, user-agent, action, timestamp, and metadata with no update/delete capabilities.

---

## 6. Verification Commands

```bash
# 1. Dependency security audit
pnpm audit

# 2. Complete test suite verification (165+ tests passing)
pnpm test

# 3. TypeScript strict typecheck across all workspaces
pnpm typecheck

# 4. Production bundle build
pnpm build
```
