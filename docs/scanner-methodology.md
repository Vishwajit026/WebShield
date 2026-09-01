# WebShield Scanner Methodology & Architecture (Phase 3 – Phase 5)

This document provides a technical overview of the WebShield security assessment engine, its passive scanner modules, SSRF defense mechanisms, scoring calculations, and scan comparison diffing.

---

## 1. Scanner Architecture

```
User Target Submission
          ↓
URL Parsing & Scheme Whitelist (http/https only)
          ↓
Multi-Layered SSRF Guard (IPv4/IPv6, Cloud Metadata, DNS Resolution)
          ↓
Controlled HTTP Client (Budgets, Timeouts, Safe Redirects)
          ↓
Modular Passive Scanners
  ├── HTTPS & SSL/TLS Scanner
  ├── HTTP Security Headers Scanner
  ├── Cookie Security Flags Scanner
  ├── CORS Policy Scanner
  ├── Information Disclosure Scanner
  ├── Technology Detection Scanner
  ├── TLS Protocol & Cipher Scanner
  └── Well-Known & Policy Files Scanner
          ↓
Finding Deduplication (Composite Fingerprinting)
          ↓
Security Score Calculation (100 - Severity/Confidence Deductions)
          ↓
Persistent Storage (Target, Scan, Findings) & Comparison Engine
```

---

## 2. Target Validation & Normalization

Target URLs are strictly validated prior to initiating network connections:
- **Allowed Schemes**: `http://`, `https://` only.
- **Blocked Schemes**: `file://`, `javascript:`, `data:`, `ftp:`, `gopher:`, `ssh:`, etc.
- **Credential Stripping**: Targets with embedded credentials (`user:pass@`) are rejected.
- **Normalization**: Hostnames are lowercased, default ports (`:80`, `:443`) are stripped from authority, and trailing slashes are standardized.

---

## 3. Multi-Layered SSRF Protection

WebShield employs active defense-in-depth against Server-Side Request Forgery:

### A. Static IP & Hostname Filtering
- **Loopback**: `127.0.0.0/8`, `::1`, `localhost`, `*.localhost`.
- **RFC 1918 Private Ranges**: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- **IPv6 Local / Reserved**: `fc00::/7` (ULA), `fe80::/10` (Link-Local), `::ffff:0:0/96` (IPv4-mapped).
- **Link-Local & Broadcast**: `169.254.0.0/16`, `0.0.0.0/8`, `255.255.255.255/32`, `224.0.0.0/4`.
- **Cloud Metadata Endpoints**: `169.254.169.254` (AWS/GCP/Azure/DO), `100.100.100.200` (Alibaba), `metadata.google.internal`.
- **Dangerous Hostnames & Encodings**: `*.local`, `*.internal`, `*.corp`, `*.lan`, decimal IP notations (`2130706433`), hex IP notations (`0x7f000001`).

### B. DNS Resolution & Rebinding Prevention
- All target hostnames are resolved for both `A` and `AAAA` records.
- If **any** returned IP address falls within a prohibited range, the connection is aborted immediately.

### C. Redirect Re-Validation
- HTTP redirects (301, 302, 303, 307, 308) are never followed blindly.
- Each redirect hop destination is parsed and re-validated against all SSRF rules before initiating the subsequent request.
- Hard limit of `MAX_REDIRECTS = 5`.

---

## 4. Request Safety Controls

| Parameter | Default | Purpose |
|---|---|---|
| `SCAN_TIMEOUT` | 10,000 ms | Prevents slow-loris hangs or infinite socket reads. |
| `MAX_SCAN_REQUESTS` | 20 | Shared request budget across all engine probes. |
| `MAX_REDIRECTS` | 5 | Prevents redirect loops or amplification. |
| `MAX_RESPONSE_SIZE` | 5,242,880 bytes (5 MB) | Streams are truncated to prevent memory exhaustion (DoS). |
| `User-Agent` | `WebShieldSecurityScanner/1.0 (+https://webshield.local)` | Transparent scanner identification. |

---

## 5. Security Scanners Catalog

### 1. HTTPS & SSL/TLS Scanner (`https`)
- **Checks**: Verifies default HTTPS usage, automatic HTTP-to-HTTPS redirection, certificate validity, untrusted authorities, and impending expiration (< 30 days). Also detects passive mixed-content form submissions (`<form action="http://...">`).
- **Severity**: HIGH for unencrypted HTTP or invalid certificates; MEDIUM for missing redirects; LOW for certificates expiring soon or mixed content forms.

### 2. HTTP Security Headers Scanner (`headers`)
- **Checks**:
  - `Content-Security-Policy`: Missing policy, `unsafe-inline`, `unsafe-eval`, wildcard sources.
  - `Strict-Transport-Security`: Missing HSTS on HTTPS, `max-age` < 180 days, `includeSubDomains`, `preload`.
  - `X-Content-Type-Options`: Missing `nosniff`.
  - `X-Frame-Options` & `frame-ancestors`: Anti-clickjacking defenses.
  - `Referrer-Policy`: Missing or overly permissive policies (`no-referrer-when-downgrade`, `unsafe-url`).
  - `Permissions-Policy`: Browser feature delegation restrictions.
  - `Cross-Origin-Opener-Policy` (COOP) and `Cross-Origin-Resource-Policy` (CORP).
  - Sensitive `Cache-Control` (`no-store`) on sensitive endpoints.
- **Severity**: HIGH for missing CSP / HSTS on HTTPS; MEDIUM for missing anti-clickjacking; LOW for XCTO / Referrer-Policy / COOP; INFO for Permissions-Policy.

### 3. Cookie Security Flags Scanner (`cookies`)
- **Checks**: Inspects `Set-Cookie` headers for `Secure`, `HttpOnly`, and `SameSite` flags. Employs sensitive name heuristics (`session`, `auth`, `token`, `jwt`, `sid`, `id`, `connect.sid`, `phpsessid`, `jsessionid`, `csrftoken`). Evaluates overly permissive `Domain` scoping.
- **Sanitization**: Cookie values in finding evidence are strictly redacted (`cookie_name=[REDACTED]; Secure; ...`).
- **Severity**: HIGH for sensitive cookies missing `Secure` or `HttpOnly`; MEDIUM for missing `SameSite`; HIGH for `SameSite=None` without `Secure`.

### 4. CORS Policy Scanner (`cors`)
- **Checks**: Evaluates `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, `null` origins, dynamic reflection via `Vary: Origin`, and dangerous HTTP methods (`DELETE`, `PUT`) exposed to wildcards.
- **Severity**: HIGH for wildcard `*` with credentials allowed; MEDIUM for `null` origin; INFO for public API wildcards.

### 5. Information Disclosure Scanner (`information-disclosure`)
- **Checks**: Flags verbose `Server` versions (e.g. `Apache/2.4.41 (Ubuntu)`), `X-Powered-By` (e.g. `Express`, `PHP`), ASP.NET framework headers, and HTML `<meta name="generator">` tags.
- **Severity**: LOW (Reconnaissance findings).

### 6. Technology Detection Scanner (`technology-detection`)
- **Checks**: Passively identifies frameworks (React, Vue, Angular, Next.js, Laravel, Django, Express), CMS (WordPress), web servers (Nginx, Apache), and CDNs (Cloudflare).
- **Severity**: INFO (Asset inventory).

### 7. TLS Protocol & Cipher Scanner (`tls`)
- **Checks**: Inspects negotiated TLS protocol versions and ciphers. Flags deprecated versions (TLS 1.0, TLS 1.1, SSLv3), weak ciphers (RC4, 3DES, DES, MD5), and certificate Subject Alternative Name (SAN) mismatch.
- **Severity**: HIGH for deprecated protocols/ciphers; MEDIUM for SAN mismatches.

### 8. Well-Known & Policy Files Scanner (`well-known`)
- **Checks**: Passively probes for standardized `/.well-known/security.txt` and `/robots.txt` within the global request budget.
- **Severity**: INFO (Presence or absence of coordinated vulnerability disclosure contact information).

---

## 6. Limitations & Safe Boundaries

1. **Non-Destructive Only**: WebShield performs passive inspection of HTTP responses and TLS handshakes. It does NOT execute payloads, SQL injection, XSS exploitation, fuzzing, port scanning, or brute-force attacks.
2. **Surface Analysis**: The scanner inspects public endpoints reachable via HTTP/HTTPS; it does not crawl complex multi-step authenticated workflows.
3. **Assessment Scope Notice**: WebShield performs non-destructive security checks and does not guarantee that a target is free from vulnerabilities. This assessment does not replace comprehensive manual penetration testing or source code audits.
