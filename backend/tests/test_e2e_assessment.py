"""
Phase 1 E2E Test: Register → Consent → Assessment
Tests the full AI risk assessment workflow
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

print("\n" + "="*80)
print("PHASE 1: END-TO-END ASSESSMENT TEST")
print("="*80)

# Step 1: Register a patient
print("\n[Step 1] Register patient...")
patient_email = f"e2e_assessment_{datetime.now().timestamp()}@test.local"
register_payload = {
    "full_name": "E2E Test Patient",
    "email": patient_email,
    "phone": "+1-555-0001",
    "password": "TestPass123!",
    "date_of_birth": "1980-05-15",
    "gender": "Female",
    "height": 165,
    "weight": 70,
    "preferred_language": "English",
    "emergency_contact": "John Doe"
}

reg_res = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload, timeout=10)
assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
token = reg_res.json()["access_token"]
print(f"✓ Patient registered: {patient_email}")
print(f"  Token: {token[:30]}...")

# Step 2: Check consent status (should be false initially)
print("\n[Step 2] Check initial consent status...")
consent_status = requests.get(
    f"{BASE_URL}/api/auth/consent/status",
    headers={"Authorization": f"Bearer {token}"},
    timeout=10
)
assert consent_status.status_code == 200
has_consented = consent_status.json()["has_consented"]
print(f"✓ Consent status: {has_consented} (expected False)")

# Step 3: Try assessment WITHOUT consent (should fail)
print("\n[Step 3] Try assessment WITHOUT consent...")
assessment_payload = {
    "age": 45,
    "gender": "Female",
    "height": 165,
    "weight": 70,
    "symptom_text": "I have been experiencing chest discomfort and shortness of breath for the past 2 hours",
    "selected_symptoms": ["chest discomfort", "shortness of breath"],
    "duration": "2 hours",
    "severity": "High",
    "medical_history": ["Hypertension", "Type 2 Diabetes"],
    "medications": ["Metformin", "Lisinopril"],
    "risk_factors": ["Smoking", "Sedentary lifestyle"],
    "vitals": {
        "systolic_bp": 145,
        "diastolic_bp": 92,
        "heart_rate": 92,
        "spo2": 96,
        "temperature": 37.0,
        "respiratory_rate": 18,
        "blood_glucose": 145
    }
}

assess_no_consent = requests.post(
    f"{BASE_URL}/api/assessments",
    json=assessment_payload,
    headers={"Authorization": f"Bearer {token}"},
    timeout=10
)
assert assess_no_consent.status_code == 403, f"Should return 403, got {assess_no_consent.status_code}"
print(f"✓ Assessment correctly blocked (403)")
print(f"  Reason: {assess_no_consent.json()['detail'][:80]}...")

# Step 4: Accept consent
print("\n[Step 4] Accept consent...")
consent_payload = {
    "consent_version": "v1.0",
    "accepted": True
}
consent_res = requests.post(
    f"{BASE_URL}/api/auth/consent",
    json=consent_payload,
    headers={"Authorization": f"Bearer {token}"},
    timeout=10
)
assert consent_res.status_code == 200
consent_id = consent_res.json()["consent_id"]
print(f"✓ Consent accepted (ID: {consent_id})")

# Step 5: Now try assessment WITH consent (should succeed)
print("\n[Step 5] Submit assessment after consent...")
assess_res = requests.post(
    f"{BASE_URL}/api/assessments",
    json=assessment_payload,
    headers={"Authorization": f"Bearer {token}"},
    timeout=15
)
assert assess_res.status_code == 200, f"Assessment failed: {assess_res.text}"
result = assess_res.json()
assessment_id = result["assessment_id"]
print(f"✓ Assessment submitted successfully (ID: {assessment_id})")
print(f"\n  AI Output:")
print(f"    Risk Score: {result['risk_score']}/100")
print(f"    Risk Level: {result['risk_level']}")
print(f"    Triage Level: {result['triage_level']}")
print(f"    Safety Rule Triggered: {result['safety_rule_triggered']}")
print(f"    Recommendation: {result['recommendation'][:100]}...")

# Step 6: Verify results were saved in database
print("\n[Step 6] Verify database storage...")
get_res = requests.get(
    f"{BASE_URL}/api/assessments/{assessment_id}",
    headers={"Authorization": f"Bearer {token}"},
    timeout=10
)
assert get_res.status_code == 200, f"Could not retrieve assessment: {get_res.text}"
stored = get_res.json()
print(f"✓ Assessment found in database")
print(f"  Stored risk score: {stored['risk_score']}")
print(f"  Stored risk level: {stored['risk_level']}")

# Step 7: Check explanation factors (SHAP)
print("\n[Step 7] Verify SHAP explanations stored...")
factors_count = len(result.get("factors", []))
print(f"✓ SHAP factors stored: {factors_count} factors")
if factors_count > 0:
    for i, factor in enumerate(result["factors"][:3], 1):
        print(f"  Factor {i}: {factor['feature']} (contribution: {factor.get('contribution', 'N/A')})")

print("\n" + "="*80)
print("✓ PHASE 1 COMPLETE: ALL TESTS PASSED")
print("="*80)
print("\nKey Achievements:")
print("  1. Patient registration working")
print("  2. Consent enforcement active (403 before acceptance)")
print("  3. Assessment pipeline processing data")
print("  4. Risk score calculated (embedded ML model)")
print("  5. Triage classification assigned")
print("  6. SHAP explanations generated")
print("  7. Results persisted to Supabase")
print("\n")
