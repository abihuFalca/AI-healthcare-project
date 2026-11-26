# Phase 2 Safety & Consent Verification Report

**Project:** AI Healthcare — Early Risk Detection and Triage System  
**Verification Date:** 2025  
**Scope:** Phase 2 — Safety rules, consent enforcement, audit logging, database storage  
**Method:** Static code review (no code changes; backend running separately on port 8000)

---

## Files Examined

| File | Purpose |
|------|----------|
| `backend/routes/assessment_routes.py` | POST /api/assessments endpoint — main triage pipeline |
| `backend/ai/safety_rules.py` | Deterministic emergency rule engine |
| `backend/routes/auth_routes.py` | Consent endpoints: POST /api/auth/consent, GET /api/auth/consent/status |
| `backend/database.py` | Table definitions: assessments, consent_records, audit_logs, patient_vitals |

---

## Control 1 — Consent Check Before Any Data Processing

**Status: PRESENT ✅**

In `assessment_routes.py`, the very first action inside the `create_assessment` handler (after dependency injection) is a query against `consent_records`:

```python
cursor.execute("""
    SELECT id FROM consent_records
    WHERE user_id = %s
    ORDER BY accepted_at DESC LIMIT 1
""", (user["id"],))
consent_row = cursor.fetchone()

if not consent_row:
    conn.close()
    raise HTTPException(
        status_code=403,
        detail="Consent required: You must review and accept the privacy notice before submitting an assessment. "
               "Please complete the consent screen and try again."
    )
```

**Observations:**
- Consent is checked before NLP parsing, safety rule evaluation, risk scoring, or any database write.
- A missing consent record returns HTTP 403 with an actionable user message.
- The database connection is explicitly closed before raising the exception (no resource leak).
- The check uses `consent_records` (the immutable audit table), not just the `patient_profiles.consent_accepted` boolean — this is the correct table per PRD §9.2 and §11.2.

**Gap / Recommendation:**  
The consent check verifies that **a** record exists but does not verify that the most recent record has `accepted: true`. The `consent_records` table stores every submission (accepted and declined) in one table without an `accepted` column — declined consent is differentiated only by audit log action (`CONSENT_DECLINED`). If a user explicitly declines consent and a record is therefore inserted, the current check would incorrectly treat that declined record as valid consent. Consider:
1. Adding an `accepted BOOLEAN NOT NULL DEFAULT TRUE` column to `consent_records`, or
2. Checking the `patient_profiles.consent_accepted` boolean in addition to the record existence check.

---

## Control 2 — Deterministic Safety Rule Engine

**Status: PRESENT ✅**

File: `backend/ai/safety_rules.py`

`evaluate_safety_rules()` is a pure-Python deterministic function — no ML, no external calls. It returns `(is_emergency: bool, triggered_rules: List[str], recommendation_override: str)`. It is called in `assessment_routes.py` **before** the ML risk model, ensuring no probabilistic score can suppress an emergency override.

### Rules Implemented

| Rule | Trigger Condition |
|------|-------------------|
| Cardiac Pattern | Chest pain/discomfort + autonomic signs (sweating, dyspnea, dizziness, radiating pain) |
| Neurological Emergency | Sudden weakness, facial droop, slurred speech, loss of consciousness, thunderclap headache |
| Severe Hypoxemia | SpO2 < 90% |
| Acute Respiratory Distress | Free-text: cannot breathe, gasping, choking |
| Hypertensive Crisis | Systolic BP ≥ 180 mmHg OR Diastolic BP ≥ 120 mmHg |
| Hypotensive Shock | Systolic BP < 85 mmHg |
| Severe Tachycardia | Heart rate ≥ 135 bpm |
| Severe Bradycardia | Heart rate < 45 bpm |
| Hyperpyrexia | Temperature ≥ 40.0 °C |
| Hypothermia | Temperature < 35.0 °C |
| Severe Hyperglycemia/DKA | Blood glucose ≥ 400 mg/dL |
| Severe Hypoglycemia | Blood glucose ≤ 50 mg/dL |
| Acute Systemic Emergency | Free-text: heavy bleeding, seizure, convulsions, anaphylaxis, throat swelling |
| Mental Health Crisis | Free-text: suicide, kill myself, end my life, self harm |

**What is NOT present in safety_rules.py:**
- ❌ Duplicate assessment prevention (24-hour window check)
- ❌ Input null-rejection / required-field validation
- ❌ Output validation (risk score NaN / range guard)
- ❌ Clinician override handling

These items are either implemented elsewhere or absent entirely — see details below.

### Duplicate Assessment Prevention
**Status: NOT IN safety_rules.py — CHECK assessment_routes.py: ABSENT ⚠️**

Neither `safety_rules.py` nor `assessment_routes.py` contains a query checking whether the same patient submitted an assessment within the last 24 hours. There is no guard against rapid resubmission. This is a gap.

**Recommendation:** Before inserting the assessment record, check:
```sql
SELECT id FROM assessments
WHERE patient_id = %s AND created_at > NOW() - INTERVAL '24 hours'
LIMIT 1;
```
If a recent assessment exists, return HTTP 429 with a message directing the user to view their previous result.

### Input Validation (Null / Range)
**Status: PRESENT in assessment_routes.py ✅**

The `validate_vitals_limits()` function in `assessment_routes.py` enforces hard biologically-plausible limits for every vital sign field. Out-of-range values raise HTTP 400. Pydantic field validation on `AssessmentCreateRequest` catches `age` outside 1–120 at the schema level.

Null vitals are allowed (all fields are `Optional`) — the intent is that vitals may not always be available. This is an acceptable design decision for a patient-facing triage tool.

### Output Validation (Risk Score Range / NaN Guard)
**Status: NOT IMPLEMENTED ⚠️**

The output of `predict_patient_risk()` is used directly without a range or NaN check before database insertion. If the ML model returns `NaN` or a value outside 0–100, the malformed value would be stored in `assessments.risk_score`. 

**Recommendation:** After calling `predict_patient_risk()`, add:
```python
import math
if math.isnan(score) or not (0 <= score <= 100):
    raise HTTPException(status_code=500, detail="Risk model returned an invalid score; please retry.")
```

### Clinician Override Handling
**Status: PARTIAL — via healthcare_reviews table ✅ (no real-time override endpoint)**

The `healthcare_reviews` table supports `final_triage_status` and `clinical_notes`, allowing a doctor to record a manual triage override after review. The doctor queue (`doctor_routes.py`) presumably allows writing to this table. A real-time "override" button that updates `assessments.triage_level` mid-session is not visible in this file — that is out of scope for Phase 2 and appropriate for a separate doctor-review flow.

---

## Control 3 — Consent Endpoints

**Status: PRESENT ✅**

File: `backend/routes/auth_routes.py`

### POST /api/auth/consent
- Accepts `{ consent_version: str, accepted: bool }`.
- Checks for an existing record for the same `(user_id, consent_version)` pair — returns it without duplicating if already recorded.
- Inserts a new `consent_records` row.
- If the user is a PATIENT and `accepted=True`, also updates `patient_profiles.consent_accepted = TRUE`.
- Logs `CONSENT_ACCEPTED` or `CONSENT_DECLINED` to the audit trail.
- Returns `{ consent_id, accepted, consent_version, accepted_at, message }`.

### GET /api/auth/consent/status
- Returns the most recent consent record for the authenticated user.
- If no record exists: `{ has_consented: false, message: "..." }`.
- If a record exists: `{ has_consented: true, consent_id, consent_version, accepted_at }`.
- Note: `has_consented: true` is returned whenever **any** record exists, regardless of the `accepted` boolean (same gap as Control 1).

**Gap:** See Control 1 gap — the `has_consented` flag does not distinguish between an accepted and a declined consent record.

---

## Control 4 — Audit Logging

**Status: PRESENT ✅**

### Schema (database.py)
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata TEXT,
    ip_address TEXT,
    created_at TIMESTAMP NOT NULL
);
```

### Call Site in assessment_routes.py
After a successful assessment commit:
```python
log_audit_event(
    user["id"], "ASSESSMENT_CREATED", "ASSESSMENT", str(assessment_id),
    f"Score: {score}, Level: {risk_level}, Triage: {triage_level}, SafetyTriggered: {is_emergency}"
)
```

`log_audit_event` is imported from `auth_utils.py` and is used consistently across login, logout, registration, consent, and assessment creation events. The metadata field captures risk score, level, triage level, and whether a safety rule fired — sufficient for an audit trail.

**Observation:** The audit log does not capture the patient's IP address on assessment creation (only on login events in the seed data). The `log_audit_event` signature accepts `ip_address` but the assessment call omits it. This is a minor gap for production — FastAPI's `Request` object would need to be injected to capture the client IP.

---

## Control 5 — Assessment Database Storage

**Status: PRESENT ✅**

The `create_assessment` handler writes to four tables in a single transaction:

| Table | What is stored |
|-------|----------------|
| `assessments` | Full assessment record: symptoms, vitals snapshot (JSON), risk score, risk level, triage level, safety rule flags, recommendation, model version |
| `patient_vitals` | Structured vitals row linked to assessment and patient |
| `ai_explanations` | Up to 5 SHAP-compatible factor rows with feature name, contribution, importance, and explanation text |
| `healthcare_reviews` | Pending review record linked to the assigned clinician |

A patient confirmation notification and (when HIGH risk) a doctor alert notification are also inserted within the same `conn.commit()` block.

**Observation:** The single `conn.commit()` at the end means a failure after assessment insert but before notification insert could leave orphaned assessment records with no review or notification. Wrapping the entire pipeline in an explicit `try/except` with `conn.rollback()` on failure would improve atomicity. Currently there is no explicit rollback path.

---

## Summary Table

| Safety Control | Status | Notes |
|----------------|--------|-------|
| Consent check (403 before processing) | ✅ PRESENT | Checks existence, not acceptance value — see gap |
| Consent endpoints (POST + GET) | ✅ PRESENT | Both endpoints functional |
| Emergency safety rules engine | ✅ PRESENT | 14 rule categories, runs before ML model |
| Vital sign range validation | ✅ PRESENT | Hard limits (400) + soft warnings |
| Duplicate assessment prevention (24h) | ⚠️ MISSING | Not implemented anywhere in the pipeline |
| Risk score output validation (NaN/range) | ⚠️ MISSING | Model output used unvalidated |
| Audit log on assessment creation | ✅ PRESENT | Written after commit; IP address not captured |
| Database storage (assessments + vitals + explanations + reviews) | ✅ PRESENT | All four tables written in one transaction |
| Transaction rollback on error | ⚠️ MISSING | No try/except rollback path |
| Clinician override (real-time) | ➖ OUT OF SCOPE | Supported via healthcare_reviews post-hoc review |

---

## Curl Commands for Manual Testing

### 1. Obtain a patient token
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login": "patient@demo.com", "password": "demo123"}' \
  | python -m json.tool
```

### 2. Check consent status (no consent recorded yet)
```bash
curl -s http://localhost:8000/api/auth/consent/status \
  -H "Authorization: Bearer <TOKEN>" | python -m json.tool
```

### 3. Record consent
```bash
curl -s -X POST http://localhost:8000/api/auth/consent \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"consent_version": "v1.0", "accepted": true}' \
  | python -m json.tool
```

### 4. Submit assessment without consent (expect 403)
```bash
# First create a NEW test user with no consent record, get their token, then:
curl -s -X POST http://localhost:8000/api/assessments \
  -H "Authorization: Bearer <NEW_USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "age": 45, "gender": "Male",
    "symptom_text": "headache",
    "selected_symptoms": ["headache"],
    "duration": "2 days", "severity": "Mild",
    "medical_history": [], "medications": [], "risk_factors": [],
    "vitals": {}
  }'
# Expected: HTTP 403, detail: "Consent required: ..."
```

### 5. Submit assessment triggering cardiac safety rule (expect EMERGENCY)
```bash
curl -s -X POST http://localhost:8000/api/assessments \
  -H "Authorization: Bearer <TOKEN_WITH_CONSENT>" \
  -H "Content-Type: application/json" \
  -d '{
    "age": 58, "gender": "Male",
    "symptom_text": "chest pain with sweating and dizziness",
    "selected_symptoms": ["chest pain", "sweating", "dizziness"],
    "duration": "30 minutes", "severity": "Severe",
    "medical_history": ["Hypertension"], "medications": [], "risk_factors": [],
    "vitals": {"systolic_bp": 160, "heart_rate": 105, "spo2": 96}
  }'
# Expected: safety_rule_triggered: true, triage_level: "EMERGENCY"
```

### 6. Submit assessment with implausible vital (expect 400)
```bash
curl -s -X POST http://localhost:8000/api/assessments \
  -H "Authorization: Bearer <TOKEN_WITH_CONSENT>" \
  -H "Content-Type: application/json" \
  -d '{
    "age": 45, "gender": "Female",
    "symptom_text": "mild cough",
    "selected_symptoms": [], "duration": "1 day", "severity": "Mild",
    "medical_history": [], "medications": [], "risk_factors": [],
    "vitals": {"systolic_bp": 350}
  }'
# Expected: HTTP 400, detail: "Systolic BP 350 mmHg is outside biologically plausible limits"
```

---

## Recommendations (Priority Order)

1. **[HIGH] Fix consent declined vs. accepted ambiguity.** Add an `accepted BOOLEAN NOT NULL DEFAULT TRUE` column to `consent_records`, or reject the assessment if `patient_profiles.consent_accepted` is `FALSE`. Both the 403 guard and the `/consent/status` endpoint should key off the acceptance value, not mere record existence.

2. **[HIGH] Add duplicate assessment prevention.** Query for an assessment from the same patient within the last 24 hours before inserting. Return HTTP 429 with a link to the existing result.

3. **[MEDIUM] Add risk score output guard.** Validate `score` is in [0, 100] and not NaN before database insertion.

4. **[MEDIUM] Add transaction rollback.** Wrap the assessment insertion block in `try/except` with `conn.rollback()` on failure so a mid-pipeline error does not leave partial records.

5. **[LOW] Capture client IP in assessment audit log.** Inject `Request` into the endpoint signature and pass `request.client.host` to `log_audit_event`.

---
*Report generated by static code review — no code was modified, no database changes were made.*
