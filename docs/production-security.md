# Production Security Hardening & Safe Operations

This document details the production security controls, HTTP security headers, request tracing, and information disclosure protections implemented in **WebShield Phase 7**.

---

## 1. HTTP Security Headers (Helmet Hardening)

WebShield configures Express with `@helmet` using production-grade headers:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000, // 1 Year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' }, // Anti-clickjacking
    noSniff: true,                 // Anti-MIME sniffing
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
```

---

## 2. Request Correlation & End-to-End Tracing

To allow secure incident response and audit correlation without disclosing sensitive user tokens, every incoming HTTP request is assigned a unique, sanitized Correlation ID via `requestId.ts`:

- **Header Inspected / Assigned**: `X-Request-ID`
- **Sanitization**: Any client-provided `X-Request-ID` is validated against `/^[a-zA-Z0-9_-]{8,64}$/`. If invalid or missing, a cryptographic UUIDv4 is generated.
- **Propagation**: Attached to `req.id` and reflected on the response headers (`res.setHeader('X-Request-ID', reqId)`).

---

## 3. Information Exposure Defenses

### A. Health Check Data Minimization (`GET /api/admin/health`)
The health check executes active component checks (Database ping, Scanner engine availability, App uptime, PDF storage) while rigorously stripping:
- Database hostnames, port numbers, usernames, and passwords
- JWT signing secrets and cookie keys
- Local operating system file paths
- Internal network private IP addresses

### B. Error Handling Sanitization
All unhandled exceptions in `errorHandler.ts` return structured responses:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred."
  }
}
```
Stack traces and internal runtime errors are logged securely to backend logs tagged with the Correlation ID, never transmitted to the client in production mode.

---

## 4. Multi-Layer Rate Limiting

| Limiter | Target Routes | Threshold | Purpose |
| :--- | :--- | :--- | :--- |
| `globalRateLimit` | All API endpoints (`/api/*`) | 120 req / min / IP | General traffic shaping & DoS protection |
| `authRateLimit` | Auth endpoints (`/api/auth/*`) | 15 req / 15 min / IP | Brute force & credential stuffing defense |
| `scanRateLimit` | Scan endpoints (`/api/scans`) | 10 req / min / IP | Resource exhaustion defense on scanner engine |
| `adminRateLimit` | Admin mutation routes (`/api/admin/users/*`) | 30 req / min / IP | Protection against automated admin changes |
| `reportRateLimit` | PDF generation (`/api/reports/*`) | 10 req / min / IP | PDF compilation resource bounding |
