# WebShield Security Scoring Methodology

## 1. Overview
WebShield calculates a deterministic **Security Score** on a normalized integer scale of `0` to `100`. The scoring engine operates on a subtractive model starting from a base baseline of **100 points**, applying bounded deductions for confirmed findings based on **Severity** and **Confidence**.

---

## 2. Base Deductions by Severity

Each finding incurs a baseline point deduction corresponding to its security severity rating:

| Severity | Base Point Deduction | Description |
| :--- | :--- | :--- |
| **CRITICAL** | `-25 points` | Severe risk directly compromising transport encryption or exposing critical data (e.g., cleartext HTTP without redirect, expired/untrusted certificate). |
| **HIGH** | `-15 points` | Major defensive omission or vulnerable configuration (e.g., missing CSP, sensitive cookies lacking `Secure` or `HttpOnly`). |
| **MEDIUM** | `-8 points` | Standard defensive misconfiguration (e.g., missing anti-clickjacking headers, weak SameSite policies, CORS wildcard with credentials). |
| **LOW** | `-3 points` | Minor defensive hygiene gaps (e.g., missing `Referrer-Policy`, meta generator banners). |
| **INFO** | `-0 points` | Informational intelligence (e.g., detected technology, robots.txt presence) with zero score penalty. |

---

## 3. Confidence Weighting Multipliers

To minimize the impact of speculative heuristics, point deductions are scaled by the scanner's confidence score:

| Confidence | Multiplier |
| :--- | :--- |
| **HIGH** | `1.0` (100% deduction applied) |
| **MEDIUM** | `0.75` (75% deduction applied) |
| **LOW** | `0.50` (50% deduction applied) |

Formula for single finding deduction:
$$\text{Deduction} = \lfloor \text{BaseDeduction} \times \text{ConfidenceMultiplier} \rfloor$$

---

## 4. Severity Deduction Caps & Bounds

To prevent a single category of low/medium findings from artificially driving the overall score to zero, the engine enforces maximum category and severity caps:

- **CRITICAL**: No cap (multiple critical failures can reduce score to minimum).
- **HIGH Total Cap**: Max `-60 points`.
- **MEDIUM Total Cap**: Max `-35 points`.
- **LOW Total Cap**: Max `-15 points`.
- **Global Clamping**: The final score is strictly clamped between `[0, 100]`.

---

## 5. Security Posture Grades

The numerical score maps to categorical posture grades:

| Score Range | Grade | Posture Assessment |
| :--- | :--- | :--- |
| **90 – 100** | `Excellent` | Robust defensive posture with comprehensive headers, modern TLS, and secure cookies. |
| **75 – 89** | `Good` | Solid security controls with minor configuration improvements recommended. |
| **50 – 74** | `Moderate` | Moderate security posture with missing defense-in-depth headers or weak cookie flags. |
| **25 – 49** | `Poor` | Weak posture with several high-severity misconfigurations. |
| **0 – 24** | `Critical` | Severe vulnerabilities or total lack of basic transport security controls. |

---

## 6. Score Explanation Breakdown

Every scan produces a structured `ScoreExplanation` containing:
- Base score (`100`)
- Itemized deductions per finding category
- Total points deducted
- Summary explanation string explaining primary deduction drivers.
