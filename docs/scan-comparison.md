# WebShield Scan Comparison & Diffing Engine

## 1. Overview
WebShield provides automated **Scan Comparison** to track how a target's defensive posture changes across assessments. By diffing baseline scans against recent re-scans, teams can verify vulnerability remediation, detect regressions, and track security score trajectory over time.

---

## 2. Deterministic Finding Fingerprinting

To reliably track findings across scans even if underlying database IDs change, the engine computes a composite **Finding Fingerprint**:

$$\text{Fingerprint} = \text{SHA256}(\text{scanner} \parallel \text{"::"} \parallel \text{category} \parallel \text{"::"} \parallel \text{title} \parallel \text{"::"} \parallel \text{affectedComponent})$$

- `scanner`: Identifier of the executing scanner module (e.g. `headers-scanner`).
- `category`: Standardized category enum (`HEADERS`, `TLS`, `COOKIES`, `CORS`, etc.).
- `title`: Canonical finding title (e.g. `Missing Content-Security-Policy Header`).
- `affectedComponent`: Normalized header name, cookie name, or URL path.

---

## 3. Comparison Classification States

When comparing Baseline Scan $A$ and Comparison Scan $B$, each finding is assigned one of four definitive status tags:

| Status | Definition | Visual Indicator |
| :--- | :--- | :--- |
| `RESOLVED` | Existed in Scan $A$, but **absent** in Scan $B$ (issue fixed). | Green Badge (`✓ RESOLVED`) |
| `NEW` | Present in Scan $B$, but **absent** in Scan $A$ (new risk introduced). | Red Badge (`+ NEW RISK`) |
| `PERSISTENT` | Present in both Scan $A$ and Scan $B$ with unchanged severity and confidence. | Gray/Slate Badge (`PERSISTENT`) |
| `CHANGED` | Present in both Scan $A$ and Scan $B$, but severity or confidence altered. | Blue Badge (`CHANGED`) |

---

## 4. Score Delta & Metrics

The comparison engine calculates:
- **Score Delta**: $\Delta \text{Score} = \text{Score}_B - \text{Score}_A$
  - Positive $\Delta$: Posture improvement (e.g. `+15`).
  - Negative $\Delta$: Posture regression (e.g. `-10`).
- **Counts**: `resolvedCount`, `newCount`, `persistentCount`, and `changedCount`.

---

## 5. Security & Access Control (IDOR Protection)

To prevent cross-tenant information disclosure:
- Both scans must belong strictly to the authenticated `userId`.
- Both scans must have reached terminal `COMPLETED` status.
- Attempting to compare scans across different user accounts returns a strict `403 Forbidden` error.
