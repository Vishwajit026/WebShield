# WebShield Portfolio Screenshot Capture Checklist

This checklist specifies the exact 12 screenshots recommended for inclusion in GitHub READMEs, portfolio websites, and case study decks.

---

## Safety & Redaction Rules (MANDATORY)

> [!CAUTION]
> **NEVER capture or display**:
> - Real API keys, JWT secrets, or cryptographic tokens.
> - Real user passwords or plaintext credentials.
> - Personal email addresses, phone numbers, or private identities.
> - Internal private IP addresses (`10.x.x.x`, `192.168.x.x`, `172.16.x.x`) or local filesystem paths.
> - Real production database connection strings.
> - Sensitive unredacted authorization headers in network inspect tabs.

---

## 12 Screenshot Specifications

| # | Screen Name | Route / View | What to Show (Visible) | What NOT to Show (Hidden) |
|---|:---|:---|:---|:---|
| **1** | **Landing Page** | `/` | Hero section, "Enterprise-Grade Security Assessment" badge, 9 security capability cards, CTA buttons ("Get Started", "Sign In"), and Responsible-Use notice. | Browser developer tools, private URLs, debug overlays. |
| **2** | **Authentication & Sign-In** | `/login` | Branded dark-mode login card, input fields for email/password, "Sign In" button, link to register, clean validation styling. | Real user credentials or browser autofill passwords. |
| **3** | **Security Dashboard** | `/dashboard` | Aggregate security score gauge (circular SVG), total scans KPI card, critical findings KPI card, recent scan activity timeline. | Internal test usernames with sensitive personal names. |
| **4** | **New Scan Launcher** | `/dashboard/scan` | Target URL input field with example placeholder (`https://example.com`), "Start Security Scan" CTA button, passive assessment scope explanation. | Internal intranet URLs (`http://localhost`, `10.0.0.1`, etc.). |
| **5** | **Scan Results Overview** | `/dashboard/scans/:id` | Target URL, timestamp, overall security score badge (e.g. `85/100`), severity count pills (Critical, High, Medium, Low), and scanner summary. | Raw unredacted session cookies or auth tokens in network logs. |
| **6** | **Finding Detail Modal** | `/dashboard/scans/:id` (Modal) | Finding title (e.g. `Missing Content-Security-Policy`), severity pill (`HIGH`), category, sanitized evidence box, impact analysis, remediation code snippet, reference link. | Sensitive tokens or internal server paths in evidence box. |
| **7** | **Security Score & Category Breakdown** | `/dashboard/scans/:id` | Bounded score visualization, category score deduction cards (Headers, Cookies, TLS, CORS, Info Disclosure), status badges. | Arbitrary non-standard score metrics. |
| **8** | **Scan Comparison & Diffing** | `/dashboard/scans/compare` | Two compared scans on the same target, score delta indicator (+15 or -10), categorized finding tabs (`NEW`, `RESOLVED`, `RECURRING`). | Mismatched target comparison errors. |
| **9** | **Executive PDF Report Preview** | PDF Viewer | Branded A4 cover page with confidentiality banner, executive summary, score deduction matrix table, sanitized finding catalog with severity colors. | Real client company names or private assessment targets. |
| **10** | **Admin Dashboard & Health** | `/admin` & `/admin/health` | System KPI cards (Total Users, Active Scans, Failure Rate), global severity distribution chart, subsystem health tiles (PostgreSQL latency, scanner readiness, memory, storage). | Database passwords, hostnames, port numbers, or private internal IP addresses. |
| **11** | **User Management Console** | `/admin/users` | Tenant user accounts table, role badges (`USER` / `ADMIN`), status badges (`Active` / `Suspended`), "Change Role" dropdown, "Suspend User" confirmation modal. | Real personal email addresses or password hashes. |
| **12** | **Immutable Audit Trail** | `/admin/audit-logs` | Filterable audit event table, event badges (`LOGIN_SUCCESS`, `USER_SUSPENDED`, `SCAN_CREATED`), timestamps, IP addresses (sample mock IPs), expandable JSON metadata. | Production API keys or plain authorization headers in JSON metadata payloads. |
