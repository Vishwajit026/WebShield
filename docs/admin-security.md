# Administrative Security & RBAC Architecture

This document specifies the administrative security model, role-based access control (RBAC), self-protection invariants, and endpoint protection policies implemented in **WebShield Phase 7**.

---

## 1. Zero Trust Authorization Model

In WebShield, **the frontend is never treated as a security boundary**. Visibility controls in the UI exist solely for UX ergonomics. Every administrative operation is gatekept on the backend by deterministic middleware chaining:

```text
Incoming HTTP Request
        │
        ▼
[1] Request ID Sanitization & Tagging (`requestId.ts`)
        │
        ▼
[2] Production Header Hardening (`helmet`)
        │
        ▼
[3] Centralized Rate Limiting (`adminRateLimit`)
        │
        ▼
[4] Token Verification (`authenticate.ts`)
        ├── Validates JWT signature & expiry
        └── Queries DB for `isSuspended === false` (Reject with 403 if suspended)
        │
        ▼
[5] Role Verification (`requireRole('ADMIN')`)
        ├── Validates `req.user.role === 'ADMIN'`
        └── Rejects non-admin (`USER`) requests with HTTP 403 Forbidden
        │
        ▼
[6] Controller & Service Layer Validation (Self-Protection & Last-Admin Checks)
        │
        ▼
[7] Immutable Audit Log Creation (`auditLog.create`)
        │
        ▼
Response Dispatch
```

---

## 2. Role Definitions & Permissions Matrix

WebShield supports two explicit roles defined in the database schema (`Role` enum):

| Capability / Resource | `USER` Role | `ADMIN` Role |
| :--- | :---: | :---: |
| Authenticate / Register / Refresh Sessions | Yes | Yes |
| View Own Scans, Targets & Reports | Yes | Yes |
| Trigger Passive Scans & PDF Reports | Yes | Yes |
| View Global Metrics & System KPIs | **No (403)** | **Yes** |
| Inspect Subsystem Health (DB, Memory, Storage) | **No (403)** | **Yes** |
| List All Tenant Accounts & Filter Status | **No (403)** | **Yes** |
| Inspect Specific User Profile & Sessions | **No (403)** | **Yes** |
| Suspend / Reactivate User Accounts | **No (403)** | **Yes** |
| Change User Roles (`USER` $\leftrightarrow$ `ADMIN`) | **No (403)** | **Yes** |
| Explore System-Wide Scans & Target Findings | **No (403)** | **Yes** |
| View Global Immutable Audit Logs | **No (403)** | **Yes** |
| Download Any Generated PDF Report | **No (403)** | **Yes** |

---

## 3. Self-Protection & Last-Admin Safeguards

To prevent catastrophic administrative lockout or rogue self-exemption, the backend enforces strict domain-level business constraints in `admin.service.ts`:

### A. Self-Suspension Prevention
An administrator cannot suspend their own account:
```typescript
if (targetUserId === adminId) {
  throw new AppError(400, 'You cannot suspend your own administrative account.', 'SELF_SUSPENSION_BLOCKED');
}
```

### B. Self-Demotion Prevention
An administrator cannot remove their own `ADMIN` role:
```typescript
if (targetUserId === adminId && newRole !== 'ADMIN') {
  throw new AppError(400, 'You cannot demote your own account from administrator.', 'SELF_DEMOTION_BLOCKED');
}
```

### C. Last Active Administrator Protection
The system counts the number of active (non-suspended) `ADMIN` accounts before allowing any suspension or demotion:
```typescript
const activeAdminCount = await prisma.user.count({
  where: { role: 'ADMIN', isSuspended: false },
});

if (activeAdminCount <= 1) {
  throw new AppError(400, 'Cannot modify or suspend the last active administrator account.', 'LAST_ADMIN_PROTECTED');
}
```

---

## 4. Session Invalidation on Suspension

When an administrator suspends a user:
1. The user's `isSuspended` flag is set to `true` in the database.
2. All active refresh tokens/sessions for that user are immediately revoked (`isRevoked: true`).
3. Any active access tokens presented by that user are rejected on the very next HTTP request because `authenticate.ts` verifies the user's active status directly against the database.
4. Future login and refresh attempts return `403 Forbidden` with `"Account is suspended. Contact administrator."`.

---

## 5. Rate Limiting for Admin Mutations

To defend against administrative brute-force or credential stuffing against sensitive actions, dedicated rate limiters are applied:
- `adminRateLimit`: 30 requests per minute window per IP for state-changing admin actions (suspend, reactivate, role changes).
- `reportRateLimit`: 10 PDF downloads/generations per minute per IP.
