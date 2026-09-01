# WebShield

**Full-Stack Web Security Assessment & Vulnerability Analysis Platform**

WebShield is a non-destructive, passive web security scanning platform that analyzes the external security posture of web targets. It detects misconfigurations across HTTP headers, SSL/TLS setups, cookie policies, CORS configurations, information exposure, and technology stacks, offering comprehensive scan diffing, executive PDF reports, and an enterprise administrative console.

---

## Overview

Modern web applications frequently suffer from security regressions caused by missing defensive headers, insecure cookie configurations, overly permissive cross-origin policies, and information disclosure. Many security tools are either excessively complex command-line utilities or aggressive penetration testing tools that risk disrupting production services.

WebShield solves this problem by providing a safe, automated, passive security assessment platform. By issuing controlled, non-destructive HTTP/HTTPS probe requests, WebShield evaluates web applications against industry security standards without attempting offensive exploits, payload injections, or denial-of-service attacks.

The platform provides developers, security engineers, and administrators with clear visibility into their security posture. Key capabilities include bounded security scoring (0–100), historical posture tracking, scan-to-scan differential analysis, streaming executive PDF generation, and an administrative subsystem with Zero Trust role-based access control (RBAC).

---

## Features

- **Passive Security Scanning**: Evaluates targets across 9 distinct security vectors without intrusive exploitation.
- **SSRF Defense Architecture**: Multi-layered protection with synchronous DNS pre-resolution, comprehensive CIDR blocklists (RFC1918, loopback, link-local, cloud metadata), and socket-level IP pinning.
- **Dynamic Security Scoring**: Deterministic, bounded scoring algorithm (0–100) with category-weighted deductions and deduplicated finding fingerprints.
- **Scan History & Trend Analysis**: Interactive timeline tracking target security scores, severity distributions, and posture evolution.
- **Scan Comparison & Diffing Engine**: Compares consecutive scans to identify `NEW`, `RECURRING`, and `RESOLVED` findings alongside score delta metrics.
- **Executive PDF Reporting**: Multi-page PDF reports generated via PDFKit with executive summaries, finding catalogs, evidence boxes, and remediation instructions.
- **Zero Trust Admin Console**: Dedicated administrative portal with user management, system-wide scan visibility, subsystem health telemetry, and immutable audit logging.
- **Defense-in-Depth Authentication**: Ephemeral in-memory JWTs (15-minute lifespan), rotating HttpOnly refresh cookies (7-day lifespan), Argon2id password hashing, and instant session invalidation on user suspension.

---

## Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vite 5, Tailwind CSS 3 | Single Page Application (SPA) |
| **State & Routing** | React Router 6, TanStack Query 5, Axios, Recharts 2 | Client-side routing, caching, and visualization |
| **Backend API** | Node.js (v20+), Express 4, TypeScript | REST API Gateway & Business Logic |
| **Security Engine** | Custom modular engine (`@webshield/security-engine`) | Passive assessment, SSRF guard, IP pinning |
| **PDF Reporting** | PDFKit | Memory-bounded streaming PDF document generation |
| **Database & ORM** | PostgreSQL 15+, Prisma ORM 5 | Relational persistence & type-safe queries |
| **Security & Auth** | Argon2id, jsonwebtoken, Helmet, Express Rate Limit | Hashing, JWT verification, headers, rate limits |
| **Testing** | Vitest 2, Supertest, v8 Coverage | Unit, integration, and RBAC authorization tests |

---

## Architecture

WebShield is organized as a modular TypeScript monorepo using `pnpm` workspaces:

```text
                               ┌─────────────────────────┐
                               │   React Frontend (SPA)  │
                               │   Port 5173 (Dev)       │
                               └────────────┬────────────┘
                                            │ HTTP (Bearer JWT / HttpOnly Cookie)
                                            ▼
                               ┌─────────────────────────┐
                               │   Express API Gateway   │
                               │   Port 5000 (Dev)       │
                               └───────┬──────────┬──────┘
                                       │          │
                     ┌─────────────────┘          └─────────────────┐
                     ▼                                              ▼
       ┌───────────────────────────┐                  ┌───────────────────────────┐
       │   @webshield/             │                  │   Prisma ORM 5            │
       │   security-engine         │                  │   PostgreSQL 15+          │
       │   (Passive Scanner)       │                  │   (Relational DB)         │
       └─────────────┬─────────────┘                  └───────────────────────────┘
                     │
                     ▼ (SSRF-Guarded HTTP/HTTPS)
       ┌───────────────────────────┐
       │   External Web Target     │
       └───────────────────────────┘
```

The assessment lifecycle flows sequentially:

```text
Scan Request ──► SSRF Pre-Validation ──► Socket IP Pinning ──► Modular Scanners ──► Finding Deduplication ──► Score Calculation ──► Report Generation
```

---

## Security

WebShield applies defense-in-depth principles across every architectural layer:

1. **Authentication**: Access tokens are held strictly in client memory (never in `localStorage` or `sessionStorage`), mitigating XSS token extraction. Refresh tokens are transmitted via `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
2. **Authorization & RBAC**: Strict backend validation on every route. Administrative endpoints (`/api/admin/*`) require verified `ADMIN` role. User resource queries enforce IDOR isolation by scoping to `req.user.id`.
3. **SSRF Guard**: Pre-resolves DNS records and blocks all private, loopback, link-local, and cloud metadata IP ranges (`169.254.169.254`). Socket connections are pinned to the verified IP to prevent DNS rebinding attacks.
4. **Self-Protection Guards**: Administrators cannot suspend their own accounts, demote their own privileges, or modify the last remaining active administrator.
5. **Anti-Abuse Rate Limiting**: Multi-tiered rate limiters protect authentication (15 req/15 min), scans (10 scans/10 min), PDF generation (10 reports/10 min), and admin mutations (60 req/15 min).
6. **Hardened Headers & Caching**: Helmet enforces HSTS (1-year preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`. Authenticated API responses include `Cache-Control: no-store`.
7. **Immutable Audit Trail**: Administrative actions, authentication events, and scan events are recorded in an append-only audit log with no update or delete endpoints.

---

## Scanner

The security engine (`@webshield/security-engine`) executes 9 modular passive checks:

- **HTTPS Enforcement**: Verifies HTTP-to-HTTPS redirection, plain HTTP exposure, and mixed-content risks.
- **HTTP Security Headers**: Audits Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- **Cookie Security**: Inspects `Set-Cookie` headers for missing `Secure`, `HttpOnly`, and `SameSite` flags.
- **CORS Misconfigurations**: Detects wildcard access (`Access-Control-Allow-Origin: *`) combined with credentials (`Access-Control-Allow-Credentials: true`).
- **Information Disclosure**: Identifies sensitive server banners (`Server`, `X-Powered-By`, `X-AspNet-Version`).
- **Technology Fingerprinting**: Non-intrusively detects web frameworks (Express, Django, Laravel, ASP.NET, WordPress) to provide targeted security guidance.
- **TLS Protocol & Ciphers**: Evaluates supported TLS versions (TLS 1.2, 1.3 vs deprecated TLS 1.0, 1.1) and certificate validity.
- **Security Contact (`security.txt`)**: Checks for published security policies under `/.well-known/security.txt`.
- **DNS Hygiene**: Inspects basic DNS configurations and canonical names.

---

## Reporting

WebShield transforms completed scan data into professional, executive-ready PDF reports:

- **Multi-Page Layout**: Rendered deterministically using PDFKit with a formal security theme.
- **Executive Summary**: High-level posture analysis, severity counts, and automated security observations.
- **Score Breakdown Table**: Transparent itemization of point deductions categorized by scanner vector.
- **Detailed Findings Catalog**: Prioritized findings sorted by severity with sanitized raw evidence, impact assessments, remediation recommendations, and external references.
- **Sensitive Data Redaction**: Automatically redacts authorization tokens, passwords, and session cookies from evidence strings before PDF generation.
- **Memory-Bounded Streaming**: Streams PDF binaries directly to disk and client downloads, preventing server memory spikes.

---

## Admin Panel

The administrative console (`/admin`) provides system-wide visibility and governance:

- **System KPIs & Metrics**: Overview of total tenant users, active scans, global severity counts, and failure rates.
- **User Governance**: Searchable user directory with role management (`USER` $\leftrightarrow$ `ADMIN`) and account suspension/reactivation workflows.
- **Session Revocation**: Suspending a user immediately revokes all active sessions and rejects subsequent API requests.
- **System-Wide Scan Explorer**: Search and inspect scans across all tenants.
- **Global Findings & Reports**: Filter findings across the entire platform by severity, category, or keyword.
- **Subsystem Health Telemetry**: Live diagnostic checks for PostgreSQL query latency, scanner engine status, memory usage, and storage capacity without exposing private infrastructure IPs or credentials.
- **Audit Log Explorer**: Comprehensive, filterable trail of all system events.

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- **PostgreSQL**: `v14.x` or higher

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/webshield.git
cd webshield
```

### 2. Install Dependencies

```bash
pnpm install
```

---

## Environment Variables

Copy the example environment template to `.env`:

```bash
cp .env.example .env
```

Generate secure random secrets for token signing:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Configure `.env` with your environment values:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/webshield
JWT_SECRET=your_generated_jwt_secret_at_least_64_characters
REFRESH_TOKEN_SECRET=your_generated_refresh_secret_at_least_64_characters
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
DEV_ADMIN_PASSWORD=your_secure_dev_password_at_least_12_chars
SCAN_TIMEOUT=10000
MAX_SCAN_REQUESTS=10
```

---

## Database Setup

Initialize the database schema using Prisma:

```bash
# Generate Prisma Client
pnpm --filter @webshield/api db:generate

# Run database migrations
pnpm --filter @webshield/api db:migrate

# Seed development admin user (optional)
pnpm --filter @webshield/api db:seed
```

---

## Running Locally

Start both the backend API and frontend development server concurrently:

```bash
pnpm dev
```

- **Frontend Client**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/api/health`

Alternatively, run services individually:

```bash
# Run API backend only
pnpm dev:api

# Run React frontend only
pnpm dev:web
```

---

## Testing

WebShield maintains a comprehensive automated testing suite:

```bash
# Run all unit, integration, and security tests (165+ tests)
pnpm test

# Run TypeScript typechecks across all workspaces
pnpm typecheck

# Run ESLint across all projects
pnpm lint

# Build production bundles
pnpm build
```

---

## Security / Responsible Use

> [!IMPORTANT]
> **Authorized Testing Only**: Only scan web targets that you own or have received explicit, written authorization to assess.
>
> **Scope & Limitations**: WebShield executes non-destructive, passive security checks. A clean scan does not guarantee that a target is entirely free from vulnerabilities. This tool is designed to complement—not replace—manual penetration testing, source code analysis, and comprehensive vulnerability assessments.

---

## Project Structure

```text
webshield/
├── apps/
│   ├── web/                        # React 18 + Vite frontend SPA
│   │   ├── src/
│   │   │   ├── components/         # Reusable UI components (ScoreGauge, Badges, Modals)
│   │   │   ├── contexts/           # AuthContext (in-memory token management)
│   │   │   ├── layouts/            # AppLayout (User) & AdminLayout (Admin)
│   │   │   ├── pages/              # Dashboard, Scan, Compare, Reports, Profile, Admin/*
│   │   │   └── services/           # Typed API client services
│   └── api/                        # Express + TypeScript backend API
│       ├── src/
│       │   ├── __tests__/          # Vitest integration, unit & RBAC test suites
│       │   ├── controllers/        # Express controllers (Auth, Scan, Report, Admin)
│       │   ├── middleware/         # Auth, RBAC, Rate Limiting, Error Handling, Request ID
│       │   ├── routes/             # API routes with route-level security barriers
│       │   ├── services/           # Business logic & PDF generation pipeline
│       │   │   └── pdf/            # PDFKit report generation engine
│       │   └── utils/              # Argon2 password, JWT, errors, logger
│       └── storage/reports         # Generated PDF binaries (gitignored)
├── packages/
│   ├── shared/                     # Shared TypeScript types and interfaces
│   └── security-engine/            # Isolated passive security scanner engine
│       ├── src/
│       │   ├── comparison/         # Scan comparison & diffing engine
│       │   ├── engine/             # ScannerEngine orchestrator
│       │   ├── network/            # SSRF-safe HTTP client with socket IP pinning
│       │   ├── scanners/           # 9 modular passive scanners
│       │   ├── scoring/            # Deduplication & bounded scoring engine
│       │   └── validation/         # URL normalization & SSRF guard
├── prisma/
│   ├── schema.prisma               # PostgreSQL relational schema
│   └── seed.ts                     # Dev admin seed script
└── docs/                           # Comprehensive engineering & security documentation
```

---

## Screenshots

*(Screenshots can be added here for portfolio presentations. See [docs/screenshots.md](docs/screenshots.md) for the capture checklist.)*

- **Security Dashboard**: High-level overview of recent scans, average security score, and critical findings.
- **Scan Results & Findings**: Detailed breakdown of detected security headers, cookie flags, and remediation guides.
- **Scan Comparison**: Visual diffing showing resolved, new, and recurring findings across consecutive scans.
- **Executive PDF Report**: Exported multi-page report with score deduction breakdown and raw evidence.
- **Admin Console**: Subsystem health telemetry, user management, and immutable audit logs.

---

## Future Improvements

- **Scheduled Recurring Scans**: Automated cron-based periodic scanning of saved target assets.
- **Webhook & SIEM Integration**: Dispatching security finding alerts to Slack, Microsoft Teams, or SIEM platforms (Splunk/Elastic).
- **Subdomain Discovery**: Passive DNS enumeration using public Certificate Transparency (CT) logs.
- **Multi-Factor Authentication (MFA)**: TOTP-based two-factor authentication for user and administrative accounts.

---

## License

Private — All rights reserved.
