"""
Simplified E2E: Register → Accept Consent → Assessment
"""
import requests
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

print("\n=== SIMPLIFIED E2E TEST ===\n")

# 1. Register
email = f"e2e_{datetime.now().timestamp()}@test.local"
print(f"[1] Registering: {email}")
reg = requests.post(f"{BASE_URL}/api/auth/register", json={
    "full_name": "Test Patient", "email": email, "phone": "+1-555-0001",
    "password": "TestPass123!", "date_of_birth": "1980-05-15",
    "gender": "Female", "height": 165, "weight": 70,
    "preferred_language": "English", "emergency_contact": "John"
}, timeout=30)
assert reg.status_code == 200
token = reg.json()["access_token"]
print(f"✓ Registered\n")

# 2. Accept consent (no need to check status first)
print(f"[2] Accepting consent...")
consent = requests.post(f"{BASE_URL}/api/auth/consent", json={
    "consent_version": "v1.0", "accepted": True
}, headers={"Authorization": f"Bearer {token}"}, timeout=30)
assert consent.status_code == 200
print(f"✓ Consent accepted\n")

# 3. Submit assessment
print(f"[3] Submitting assessment...")
assess = requests.post(f"{BASE_URL}/api/assessments", json={
    "age": 45, "gender": "Female", "height": 165, "weight": 70,
    "symptom_text": "chest discomfort and shortness of breath for 2 hours",
    "selected_symptoms": ["chest discomfort", "shortness of breath"],
    "duration": "2 hours", "severity": "High",
    "medical_history": ["Hypertension"], "medications": [],
    "risk_factors": ["Smoking"],
    "vitals": {
        "systolic_bp": 145, "diastolic_bp": 92, "heart_rate": 92,
        "spo2": 96, "temperature": 37.0, "respiratory_rate": 18,
        "blood_glucose": 145
    }
}, headers={"Authorization": f"Bearer {token}"}, timeout=30)

if assess.status_code != 200:
    print(f"✗ Assessment failed: {assess.status_code}")
    print(f"  {assess.text[:500]}")
    exit(1)

result = assess.json()
print(f"✓ Assessment submitted\n")

# 4. Display results
print(f"=== AI ASSESSMENT RESULTS ===")
print(f"Risk Score: {result['risk_score']}/100")
print(f"Risk Level: {result['risk_level']}")
print(f"Triage Level: {result['triage_level']}")
print(f"Safety Rule Triggered: {result['safety_rule_triggered']}")
print(f"Factors: {len(result.get('factors', []))} stored")
print(f"\n✓ END-TO-END TEST PASSED")
