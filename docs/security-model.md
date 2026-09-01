# WebShield Security Model & Architecture (Phase 2)

This document describes the security controls, cryptographic standards, session management policies, and threat mitigations implemented in Phase 2.

---

## 1. Authentication & Cryptography

### Password Storage
- **Algorithm**: Argon2id (hybrid version of Argon2 resistant to side-channel and GPU-based attacks).
- **Parameters**:
  - Memory: 64 MiB (`memoryCost: 65536`)
  - Time iterations: 3 (`timeCost: 3`)
  - Parallelism: 1 (`parallelism: 1`)
- **Salts**: 128-bit cryptographically secure random salt generated per hash by Argon2.
- **Passwords are never logged or stored in plaintext anywhere in the system.**

### Token Architecture
- **Dual-Token System**:
  - **Access Token**: Short-lived JWT (15 minutes). Signed with `HS256` using `JWT_SECRET`. Contains minimal claims (`sub`: userId, `role`: USER | ADMIN). Returned in JSON response bodies and stored **in-memory only** on the frontend (never written to `localStorage` or `sessionStorage` to mitigate token exfiltration via XSS).
  - **Refresh Token**: Long-lived random 256-bit token (7 days). Stored in the database as a **SHA-256 hash** (`tokenHash`) in the `Session` model (never raw). Sent to the client strictly via **`HttpOnly` cookies** (`SameSite=Lax/Strict`, `Secure=true` in production).

---

## 2. Session Management & Lifecycle

- **Multi-Device Support**: Each login generates a distinct `Session` record containing the device's IP, User-Agent, creation timestamp, and expiry.
- **Revocation**:
  - Users can view all their active sessions.
  - Users can revoke a specific session (e.g., lost phone).
  - Users can revoke all other sessions with one action ("Sign out other devices").
- **IDOR / BOLA Prevention**: Session revocation strictly validates that `session.userId === req.user.id`. Requests attempting to revoke another user's session are rejected with HTTP 403 Forbidden.
- **Silent Refresh & Automatic Re-authentication**: Frontend Axios interceptor detects expired access tokens (401), automatically invokes `/api/auth/refresh` using the HttpOnly cookie, queues concurrent requests, updates the in-memory token, and replays failed calls seamlessly.

---

## 3. Authorization & RBAC

- **Roles**: `USER` and `ADMIN`.
- **Enforcement**: Server-side middleware `requireRole(Role.USER, Role.ADMIN)`. Role claims are parsed strictly from the verified JWT signature, completely ignoring any forged user-supplied role parameters in request payloads.

---

## 4. Threat Mitigations

| Threat | Mitigation Implemented |
|---|---|
| **Brute Force / Credential Stuffing** | `express-rate-limit` limits login and register attempts to 10 requests per 15-minute window in production. |
| **Account Enumeration** | Identical generic error message (`"Invalid email or password."`) and identical HTTP 401 status for non-existent emails and incorrect passwords. |
| **XSS Token Theft** | Access tokens are held in-memory; refresh tokens are stored in `HttpOnly` cookies inaccessible to JavaScript. |
| **CSRF** | SameSite cookie policy (`Lax` in dev, `Strict` in prod), scoped `path: /api/auth`, and custom `Authorization: Bearer` headers required for authenticated mutations. |
| **Injection Attacks** | Parameterized queries handled entirely by Prisma ORM; input validated and sanitized with Zod schemas. |
| **Clickjacking / MIME Sniffing** | Enforced via `helmet` security headers. |
| **Information Disclosure** | Centralized error handler suppresses internal errors and stack traces in production responses. |

---

## 5. Security Audit Logging

Security-critical events are logged to the `AuditLog` table:
- `REGISTER`
- `LOGIN_SUCCESS` / `LOGIN_FAILED`
- `LOGOUT`
- `TOKEN_REFRESH`
- `SESSION_REVOKED` / `ALL_OTHER_SESSIONS_REVOKED`

Audit log recording is asynchronous and non-blocking — an audit service failure never interrupts or breaks the user authentication flow.
