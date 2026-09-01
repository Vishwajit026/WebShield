# WebShield — Portfolio & Project Showcase

---

## Project

**WebShield — Full-Stack Web Security Assessment & Vulnerability Analysis Platform**

- **Live Production URL**: [https://webshield-security.surge.sh](https://webshield-security.surge.sh)

---

## Problem

Modern web applications frequently suffer from security regressions caused by missing security headers (CSP, HSTS), weak cookie flags (`Secure`, `HttpOnly`, `SameSite`), permissive CORS configurations, TLS misconfigurations, and information leakage. 

Traditional vulnerability assessment solutions present major friction points for engineering teams:
1. **Intrusive Scanners**: Active scanners often send aggressive fuzzing payloads or exploit injections that risk corrupting databases or taking down production services.
2. **Complex CLI Workflows**: Tools like `nmap` or `curl` scripts lack structured historical tracking, visual diffing, and executive-level PDF reporting.
3. **Lack of Tenant & Governance Controls**: Standalone scanner tools offer no multi-tenant isolation, role-based access control, or immutable audit logging for enterprise compliance.

---

## Solution

WebShield provides a safe, passive, full-stack web vulnerability assessment platform built with **TypeScript, Node.js, Express, React 18, and PostgreSQL/Prisma**:

- **Passive & Non-Destructive**: Performs thorough security assessments via controlled HTTP/HTTPS probing without exploiting systems or disrupting uptime.
- **SSRF-Safe Engine**: Eliminates Server-Side Request Forgery risks through synchronous DNS pre-resolution, comprehensive CIDR blocklists (RFC1918, cloud metadata), and custom socket IP pinning.
- **Posture Diffing & Trend Tracking**: Compares consecutive scans on the same target to highlight `NEW`, `RECURRING`, and `RESOLVED` findings with score delta indicators.
- **Executive PDF Export**: Deterministically renders branded multi-page A4 reports using PDFKit with automatic sensitive data redaction.
- **Zero Trust Admin Governance**: Features an enterprise admin console with user account management, session revocation, last-admin safeguards, subsystem telemetry, and append-only audit logging.

---

## Technical Highlights

- **Modular Monorepo Architecture**: Clean separation between the headless `@webshield/security-engine` (zero external dependencies), the `@webshield/api` REST gateway, and the `@webshield/web` React 18 SPA using `pnpm` workspaces.
- **Streaming Document Generation**: Memory-bounded streaming architecture using **PDFKit** that compiles multi-page executive security reports with dynamic table layouts, evidence boxes, and page numbering directly to disk/stream.
- **In-Memory JWT & Rotating Cookie Lifecycle**: Mitigates XSS token theft by storing ephemeral access tokens (15m expiry) exclusively in client JavaScript memory while rotating refresh tokens via `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
- **Algorithmic Bounded Scoring**: Deterministic security scoring engine (0–100) combining category-weighted deductions with finding deduplication and severity weighting.
- **Comprehensive Quality Assurance**: 165+ automated unit, integration, and RBAC security test suites executing with 100% pass rate.

---

## Security Highlights

- **Multi-Layer SSRF Defense**: Synchronous DNS resolution + RFC1918/Loopback/Metadata blocklisting + Socket IP pinning to prevent DNS rebinding attacks.
- **Multi-Tenant IDOR Isolation**: All user-level queries strictly enforce `userId === req.user.id` on database queries.
- **Backend-Enforced RBAC**: Middleware-level gatekeeping (`authenticate` + `requireRole('ADMIN')`) for administrative endpoints.
- **Self-Protection & Last-Admin Invariants**: Application logic strictly prohibits administrators from suspending themselves, demoting their own roles, or removing the last active administrator.
- **Multi-Tier Rate Limiting**: Dedicated rate limiting algorithms protecting auth (15/15min), scans (10/10min), PDF reports (10/10min), and admin actions (60/15min).
- **Sensitive Data Redaction**: Automatic scrubbing of passwords, authorization headers, and session cookies from finding evidence strings before storage and PDF compilation.
- **Immutable Audit Logging**: Cryptographically timed, append-only audit log records user actions with zero mutation/deletion endpoints.

---

## Architecture

```text
[React 18 Frontend (Vite 5 / Tailwind)]
                 │
           (HTTP / JSON)
                 ▼
[Express API Gateway (TypeScript / Helmet / RateLimit)]
        ├── [Auth & RBAC Middleware]
        ├── [Multi-Tenant Controller Scoping]
        │
        ├──► [@webshield/security-engine]
        │         ├── SSRF Guard (DNS Pre-Resolution)
        │         ├── Socket IP Pinning (Anti-Rebinding)
        │         ├── 9 Modular Passive Scanners
        │         └── Bounded Scoring & Diffing Engine
        │
        ├──► [PDF Reporting Engine (PDFKit)]
        │         └── Multi-Page Executive Reports & Data Redaction
        │
        └──► [PostgreSQL Database (Prisma ORM 5)]
                  └── Users, Sessions, AuditLogs, Targets, Scans, Findings, Reports
```

---

## Engineering Challenges & Solutions

### 1. Preventing Server-Side Request Forgery (SSRF) & DNS Rebinding
- **Challenge**: Standard URL parsing does not protect against DNS rebinding (where an attacker's domain resolves to a public IP during validation, but returns `127.0.0.1` or `169.254.169.254` during socket connection).
- **Solution**: Implemented a two-phase guard: synchronous DNS resolution against a comprehensive CIDR blocklist followed by a custom `http.Agent` / `https.Agent` that pins the TCP socket connection directly to the pre-validated IP address.

### 2. Multi-Tenant IDOR Protection with Fine-Grained Authorization
- **Challenge**: Preventing unauthorized users from viewing or modifying target assets, scan results, or PDF reports belonging to other tenants.
- **Solution**: Enforced strict ownership validation in the service layer where all Prisma database lookups scope queries with `userId === req.user.id`, rejecting cross-tenant attempts with standard `403 FORBIDDEN` or `404 NOT_FOUND` responses.

### 3. Last-Admin & Self-Protection Invariants
- **Challenge**: Preventing administrative lockout caused by accidental self-suspension, self-demotion, or removing the sole remaining administrator.
- **Solution**: Built domain-level invariants in `admin.service.ts` that verify the target user ID against the requesting admin ID and query active administrator counts before executing any suspension or role modification.

### 4. Memory-Bounded PDF Document Compilation
- **Challenge**: Generating complex multi-page PDF documents containing tables, score badges, evidence boxes, and remediation notes without consuming excessive server memory.
- **Solution**: Engineered a stream-based PDF generator using PDFKit that streams chunks directly to disk and HTTP response streams, ensuring predictable memory consumption even under concurrent requests.

---

## Resume Bullet Points

• **Architected & built WebShield**, a full-stack web vulnerability assessment platform using **TypeScript, Node.js, Express, React 18, and PostgreSQL/Prisma**, featuring a modular passive scanner evaluating 9 security vectors.

• **Engineered a multi-layered SSRF defense engine** with synchronous DNS resolution, RFC1918 blocklists, and socket-level IP pinning, completely eliminating DNS rebinding and cloud metadata exposure attack vectors.

• **Built an administrative governance system** featuring Zero Trust RBAC, last-admin invariants, self-protection guards, subsystem health telemetry, and immutable audit logging across 12 dedicated endpoints.

• **Designed secure REST APIs and streaming PDF pipelines** using **PDFKit** with multi-tenant IDOR scoping, ephemeral in-memory JWT authentication, rotating HttpOnly refresh cookies, and automated credential redaction.
