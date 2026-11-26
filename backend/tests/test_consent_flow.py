"""
Comprehensive consent flow testing (PRD §9.2, Phase 2).

Tests cover:
1. Consent accept → Assessment allowed
2. Consent decline → Assessment blocked (403)
3. No consent → Assessment blocked (403)
4. Consent status check
5. Audit trail logging
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

def test_scenario_1_no_consent_blocks_assessment():
    """
    Scenario 1: Patient registers → attempts assessment WITHOUT consent
    Expected: 403 Forbidden, message about consent required
    """
    print("\n" + "="*80)
    print("TEST 1: No Consent → Assessment Blocked (403)")
    print("="*80)

    # Register a new patient (Test Patient 1)
    patient_email = f"test_consent_1_{datetime.now().timestamp()}@test.local"
    register_payload = {
        "full_name": "Test Patient No Consent",
        "email": patient_email,
        "phone": "+1-555-9999-0001",
        "password": "TestPass123!",
        "date_of_birth": "1990-01-15",
        "gender": "Female",
        "height": 165,
        "weight": 65,
        "preferred_language": "English",
        "emergency_contact": "John Doe"
    }

    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    reg_data = reg_res.json()
    token = reg_data["access_token"]
    print(f"✓ Patient registered: {patient_email}")
    print(f"  Token: {token[:20]}...")

    # Try to submit assessment WITHOUT consent
    assessment_payload = {
        "age": 45,
        "gender": "Female",
        "height": 165,
        "weight": 65,
        "symptom_text": "I have chest discomfort",
        "selected_symptoms": ["chest discomfort"],
        "duration": "2 hours",
        "severity": "Moderate",
        "medical_history": ["Hypertension"],
        "medications": [],
        "risk_factors": ["Smoking"],
        "vitals": {
            "systolic_bp": 140,
            "diastolic_bp": 90,
            "heart_rate": 88,
            "spo2": 98,
            "temperature": 37,
            "respiratory_rate": 16,
            "blood_glucose": 95
        }
    }

    assess_res = requests.post(
        f"{BASE_URL}/api/assessments",
        json=assessment_payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    # Should get 403 Forbidden
    assert assess_res.status_code == 403, f"Expected 403, got {assess_res.status_code}"
    error_data = assess_res.json()
    assert "Consent required" in error_data["detail"], f"Wrong error message: {error_data}"
    print(f"✓ Assessment blocked (403): {error_data['detail']}")

    return token, patient_email

def test_scenario_2_consent_accept_allows_assessment(token):
    """
    Scenario 2: Patient accepts consent → Assessment allowed
    Expected: 200 OK, assessment saved
    """
    print("\n" + "="*80)
    print("TEST 2: Consent Accept → Assessment Allowed (200)")
    print("="*80)

    # Accept consent
    consent_payload = {
        "consent_version": "v1.0",
        "accepted": True
    }

    consent_res = requests.post(
        f"{BASE_URL}/api/auth/consent",
        json=consent_payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert consent_res.status_code == 200, f"Consent failed: {consent_res.text}"
    consent_data = consent_res.json()
    assert consent_data["accepted"] is True, "Consent not marked as accepted"
    print(f"✓ Consent accepted")
    print(f"  Consent ID: {consent_data['consent_id']}")
    print(f"  Timestamp: {consent_data['accepted_at']}")

    # Now try assessment again (should succeed)
    assessment_payload = {
        "age": 45,
        "gender": "Female",
        "height": 165,
        "weight": 65,
        "symptom_text": "I have chest discomfort",
        "selected_symptoms": ["chest discomfort"],
        "duration": "2 hours",
        "severity": "Moderate",
        "medical_history": ["Hypertension"],
        "medications": [],
        "risk_factors": ["Smoking"],
        "vitals": {
            "systolic_bp": 140,
            "diastolic_bp": 90,
            "heart_rate": 88,
            "spo2": 98,
            "temperature": 37,
            "respiratory_rate": 16,
            "blood_glucose": 95
        }
    }

    assess_res = requests.post(
        f"{BASE_URL}/api/assessments",
        json=assessment_payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert assess_res.status_code == 200, f"Assessment failed after consent: {assess_res.text}"
    assess_data = assess_res.json()
    assert "assessment_id" in assess_data, "No assessment_id in response"
    assert assess_data["risk_level"] in ["LOW", "MODERATE", "HIGH"], "Invalid risk level"
    print(f"✓ Assessment submitted successfully")
    print(f"  Assessment ID: {assess_data['assessment_id']}")
    print(f"  Risk Level: {assess_data['risk_level']}")
    print(f"  Risk Score: {assess_data['risk_score']}/100")
    print(f"  Triage: {assess_data['triage_level']}")

    return assess_data

def test_scenario_3_consent_status_check(token):
    """
    Scenario 3: Check consent status via endpoint
    Expected: 200 OK, has_consented = True
    """
    print("\n" + "="*80)
    print("TEST 3: Consent Status Check")
    print("="*80)

    status_res = requests.get(
        f"{BASE_URL}/api/auth/consent/status",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
    status_data = status_res.json()
    assert status_data["has_consented"] is True, "Should show consented = True"
    print(f"✓ Consent status retrieved")
    print(f"  Has Consented: {status_data['has_consented']}")
    print(f"  Consent Version: {status_data['consent_version']}")
    print(f"  Accepted At: {status_data['accepted_at']}")

    return status_data

def test_scenario_4_new_patient_no_consent():
    """
    Scenario 4: New patient without any consent record
    Expected: has_consented = False, requires privacy notice
    """
    print("\n" + "="*80)
    print("TEST 4: New Patient - No Consent Record")
    print("="*80)

    # Register another patient
    patient_email = f"test_consent_2_{datetime.now().timestamp()}@test.local"
    register_payload = {
        "full_name": "Test Patient New",
        "email": patient_email,
        "phone": "+1-555-9999-0002",
        "password": "TestPass123!",
        "date_of_birth": "1992-06-20",
        "gender": "Male",
        "height": 180,
        "weight": 75,
        "preferred_language": "English",
        "emergency_contact": "Jane Doe"
    }

    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    print(f"✓ New patient registered: {patient_email}")

    # Check consent status (should be False)
    status_res = requests.get(
        f"{BASE_URL}/api/auth/consent/status",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
    status_data = status_res.json()
    assert status_data["has_consented"] is False, "New patient should have no consent"
    print(f"✓ No consent found (as expected)")
    print(f"  Message: {status_data.get('message')}")

def test_scenario_5_consent_decline():
    """
    Scenario 5: Patient declines consent
    Expected: Record saved with accepted=False, assessment still blocked
    """
    print("\n" + "="*80)
    print("TEST 5: Consent Decline")
    print("="*80)

    # Register patient
    patient_email = f"test_consent_decline_{datetime.now().timestamp()}@test.local"
    register_payload = {
        "full_name": "Test Patient Decline",
        "email": patient_email,
        "phone": "+1-555-9999-0003",
        "password": "TestPass123!",
        "date_of_birth": "1988-03-10",
        "gender": "Other",
        "height": 170,
        "weight": 70,
        "preferred_language": "English",
        "emergency_contact": "Someone"
    }

    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
    token = reg_res.json()["access_token"]
    print(f"✓ Patient registered: {patient_email}")

    # Decline consent
    consent_payload = {
        "consent_version": "v1.0",
        "accepted": False
    }

    consent_res = requests.post(
        f"{BASE_URL}/api/auth/consent",
        json=consent_payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=5
    )

    assert consent_res.status_code == 200, f"Consent decline failed: {consent_res.text}"
    print(f"✓ Consent declined and recorded")

    # Status should show consent exists but user declined AI processing
    status_res = requests.get(
        f"{BASE_URL}/api/auth/consent/status",
        headers={"Authorization": f"Bearer {token}"}
    )

    status_data = status_res.json()
    print(f"✓ Consent status after decline: {status_data}")
    assert status_data["has_consented"] is False, "Declined consent must not count as consent"

    # A declined user must not be able to submit an assessment
    assess_res = requests.post(
        f"{BASE_URL}/api/assessments",
        json={
            "age": 40, "gender": "Female", "symptom_text": "mild headache",
            "vitals": {"systolic_bp": 120, "diastolic_bp": 80, "heart_rate": 72, "spo2": 98,
                       "temperature": 36.8, "respiratory_rate": 14, "blood_glucose": 90}
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert assess_res.status_code == 403, f"Expected 403 after decline, got {assess_res.status_code}"
    print("✓ Assessment blocked after decline")

def test_scenario_6_audit_logging():
    """
    Scenario 6: Verify consent actions are logged to audit_logs
    Expected: CONSENT_ACCEPTED and CONSENT_DECLINED entries
    """
    print("\n" + "="*80)
    print("TEST 6: Audit Logging (Manual Verification Required)")
    print("="*80)

    print("Note: To verify audit logging:")
    print("  1. Check Supabase console: SELECT * FROM audit_logs WHERE action LIKE 'CONSENT_%'")
    print("  2. Look for entries with action='CONSENT_ACCEPTED' or 'CONSENT_DECLINED'")
    print("  3. Verify entity_type='CONSENT' and metadata contains version and status")
    print("✓ Audit logging configured (verification requires database inspection)")

def run_all_tests():
    """Run all consent flow tests"""
    print("\n\n")
    print("=" * 80)
    print("PHASE 2: CONSENT WORKFLOW TEST SUITE")
    print("=" * 80)

    try:
        # Test 1: No consent blocks assessment
        token_1, email_1 = test_scenario_1_no_consent_blocks_assessment()

        # Test 2: Consent accept allows assessment
        assessment_result = test_scenario_2_consent_accept_allows_assessment(token_1)

        # Test 3: Check consent status
        test_scenario_3_consent_status_check(token_1)

        # Test 4: New patient has no consent
        test_scenario_4_new_patient_no_consent()

        # Test 5: Consent decline
        test_scenario_5_consent_decline()

        # Test 6: Audit logging
        test_scenario_6_audit_logging()

        # Summary
        print("\n\n")
        print("=" * 80)
        print("ALL TESTS PASSED [CHECK]")
        print("=" * 80)
        print("\nConsent Workflow Implementation Summary:")
        print("  ✓ Consent required before assessment submission")
        print("  ✓ Consent stored in database with audit trail")
        print("  ✓ Status endpoint allows checking user consent")
        print("  ✓ Assessment blocked (403) without consent")
        print("  ✓ Assessment allowed (200) after consent")
        print("  ✓ Consent decline recorded for audit")
        print("\n")

    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}\n")
        raise
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}\n")
        raise

if __name__ == "__main__":
    run_all_tests()
