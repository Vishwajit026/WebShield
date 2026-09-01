# Vulnerable Test Application

> ⚠️ **WARNING: LOCAL ONLY — NEVER DEPLOY PUBLICLY**
>
> This directory will contain a deliberately vulnerable web application
> for controlled security testing of WebShield's scanner.
>
> It must **never** be deployed to any public-facing environment.

## Status

Phase 1 — Not yet implemented.

## Purpose

The vulnerable test application provides a controlled local target
with known vulnerabilities so that WebShield's scanner can be
validated against predictable results.

## Planned Vulnerabilities (Phase 8)

The following vulnerability categories are planned for implementation:

- Missing/misconfigured HTTP security headers
- Weak or missing Content Security Policy
- Insecure cookie flags
- CORS misconfigurations
- SSL/TLS issues (simulated)
- Sensitive information disclosure
- Open redirects

## Usage (Phase 8)

```bash
# Start the vulnerable app locally (development only)
npm run dev --workspace=vulnerable-test-app

# Target URL for WebShield scanner
http://localhost:3999
```

## Security Constraints

- This app intentionally contains vulnerabilities.
- It MUST only run on `localhost`.
- It MUST NOT be accessible from the internet.
- It MUST NOT be deployed to any staging or production environment.
- It MUST be clearly labeled as a test target in all documentation.
