"""End-to-end: Register → Consent workflow verification"""
import requests
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

print("="*60)
print("END-TO-END CONSENT FLOW VERIFICATION")
print("="*60)

# 1. Register
email = f"e2e_test_{datetime.now().timestamp()}@test.local"
print(f"\n[1] Register: {email}")
reg = requests.post(f"{BASE_URL}/api/auth/register", json={
    "full_name": "E2E Test Patient",
    "email": email,
    "phone": "+1-555-9999-9999",
    "password": "TestPass123!",
    "date_of_birth": "1990-01-01",
    "gender": "Female",
    "height": 165,
    "weight": 65,
    "preferred_language": "English",
    "emergency_contact": "Test Contact"
}, timeout=10)
assert reg.status_code == 200
token = reg.json()["access_token"]
print(f"    ✓ Success (token: {token[:20]}...)")

# 2. Check consent (should be false)
print("\n[2] Check consent status")
status = requests.get(f"{BASE_URL}/api/auth/consent/status", 
    headers={"Authorization": f"Bearer {token}"}, timeout=10)
assert status.status_code == 200
assert status.json()["has_consented"] == False
print(f"    ✓ No consent found (as expected)")

# 3. Accept consent
print("\n[3] Accept consent")
consent = requests.post(f"{BASE_URL}/api/auth/consent", json={
    "consent_version": "v1.0",
    "accepted": True
}, headers={"Authorization": f"Bearer {token}"}, timeout=10)
assert consent.status_code == 200
assert consent.json()["accepted"] == True
print(f"    ✓ Consent accepted (ID: {consent.json()['consent_id']})")

# 4. Verify consent accepted
print("\n[4] Re-check consent status")
status2 = requests.get(f"{BASE_URL}/api/auth/consent/status",
    headers={"Authorization": f"Bearer {token}"}, timeout=10)
assert status2.status_code == 200
assert status2.json()["has_consented"] == True
print(f"    ✓ Consent confirmed accepted")

print("\n" + "="*60)
print("END-TO-END FLOW VERIFIED [CHECK]")
print("="*60)
print("\nWorkflow Summary:")
print("  Register → No Consent → Accept Consent → Consent Confirmed")
print("\nNext: Assessment can now be submitted (tested separately)")
print("="*60)
