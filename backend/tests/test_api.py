import sys
from pathlib import Path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("--- 1. Testing Health Check ---")
    res = client.get("/api/health")
    assert res.status_code == 200, res.text
    print("Health check OK:", res.json())

    print("\n--- 2. Testing Patient Login ---")
    res = client.post("/api/auth/login", json={"login": "patient@demo.com", "password": "demo123"})
    assert res.status_code == 200, res.text
    pat_token = res.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print("Patient login OK! Token received.")

    print("\n--- 3. Testing Doctor Login ---")
    res = client.post("/api/auth/login", json={"login": "doctor@hospital.com", "password": "demo123"})
    assert res.status_code == 200, res.text
    doc_token = res.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    print("Doctor login OK! Token received.")

    print("\n--- 4. Testing Admin Login ---")
    res = client.post("/api/auth/login", json={"login": "admin@healthsystem.org", "password": "demo123"})
    assert res.status_code == 200, res.text
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("Admin login OK! Token received.")

    print("\n--- 5. Testing NLP Symptom Extractor (Section 6.5) ---")
    nlp_res = client.post("/api/ai/analyze-symptoms", json={
        "text": "I have chest discomfort and dizziness for 3 hours and I am sweating."
    }, headers=pat_headers)
    assert nlp_res.status_code == 200, nlp_res.text
    nlp_data = nlp_res.json()
    print("NLP Extraction Result:", nlp_data)
    assert "chest discomfort" in nlp_data["extracted_symptoms"], "Missing chest discomfort"
    assert "dizziness" in nlp_data["extracted_symptoms"], "Missing dizziness"
    assert "sweating" in nlp_data["extracted_symptoms"], "Missing sweating"
    assert "3 hours" in nlp_data["duration"], "Duration parsing mismatch"

    print("\n--- 6. Testing Hackathon Demo Scenario (PRD Section 15) ---")
    # Patient 58, hypertension, "I have chest discomfort and dizziness for 3 hours and I am sweating", BP 165/100, HR 108, SpO2 96%
    asm_res = client.post("/api/assessments", json={
        "age": 58,
        "gender": "Male",
        "height": 178,
        "weight": 86,
        "symptom_text": "I have chest discomfort and dizziness for 3 hours and I am sweating.",
        "selected_symptoms": ["chest discomfort", "dizziness", "sweating"],
        "duration": "3 hours",
        "severity": "Moderate",
        "medical_history": ["Hypertension"],
        "medications": ["Amlodipine 5mg"],
        "risk_factors": ["Former smoker", "Family History"],
        "vitals": {
            "systolic_bp": 165,
            "diastolic_bp": 100,
            "heart_rate": 108,
            "spo2": 96,
            "temperature": 37.1,
            "respiratory_rate": 18,
            "blood_glucose": 110
        }
    }, headers=pat_headers)
    assert asm_res.status_code == 200, asm_res.text
    asm_data = asm_res.json()
    print("Demo Assessment Outcome:")
    print(f"  Assessment ID: {asm_data['assessment_id']}")
    print(f"  Risk Score: {asm_data['risk_score']}/100")
    print(f"  Risk Level: {asm_data['risk_level']}")
    print(f"  Triage Urgency: {asm_data['triage_level']}")
    print(f"  Safety Rule Triggered: {asm_data['safety_rule_triggered']}")
    print(f"  Contributing Factors: {[f['label'] + ' (+' + str(f['contribution']) + ')' for f in asm_data['factors']]}")
    print(f"  Recommendation: {asm_data['recommendation']}")

    assert asm_data["risk_level"] == "HIGH", f"Expected HIGH risk level, got {asm_data['risk_level']}"
    assert asm_data["safety_rule_triggered"] is True, "Expected cardiac safety rule to trigger!"
    assert len(asm_data["factors"]) >= 3, "Expected at least 3 contributing factors"

    print("\n--- 7. Testing Doctor High-Risk Queue and Clinical Review (DOC-3, DOC-5) ---")
    queue_res = client.get("/api/doctor/high-risk", headers=doc_headers)
    assert queue_res.status_code == 200, queue_res.text
    q_items = queue_res.json()["high_risk_queue"]
    print(f"Doctor High-Risk Queue has {len(q_items)} prioritized patients.")

    # Submit Review for this assessment
    rev_res = client.post("/api/doctor/reviews", json={
        "assessment_id": asm_data["assessment_id"],
        "review_status": "REVIEWED",
        "clinical_notes": "Cardiac pattern confirmed. Patient advised to proceed to ER immediately. Cardiology team notified.",
        "final_triage_status": "EMERGENCY"
    }, headers=doc_headers)
    assert rev_res.status_code == 200, rev_res.text
    print("Doctor clinical review submitted successfully!")

    print("\n--- 8. Testing Admin Verification Workflow (ADM-3) ---")
    # Fetch pending healthcare workers
    workers_res = client.get("/api/admin/healthcare-workers", headers=admin_headers)
    assert workers_res.status_code == 200, workers_res.text
    workers = workers_res.json()["healthcare_workers"]
    pending = [w for w in workers if w["verification_status"] == "PENDING"]
    print(f"Pending healthcare worker approvals: {len(pending)}")
    if pending:
        target_id = pending[0]["id"]
        appr_res = client.put(f"/api/admin/healthcare-workers/{target_id}/approve", json={
            "verification_status": "APPROVED",
            "notes": "Medical license verified with state medical council."
        }, headers=admin_headers)
        assert appr_res.status_code == 200, appr_res.text
        print(f"Approved doctor ID {target_id} successfully!")

    print("\n--- 9. Testing Audit Trail (SEC-7, ADM-5) ---")
    audit_res = client.get("/api/admin/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200, audit_res.text
    logs = audit_res.json()["audit_logs"]
    print(f"Total audit log records captured: {len(logs)}")
    assert len(logs) >= 5, "Audit logs should capture all operations"

    print("\n=== ALL PRD BACKEND & CLINICAL PIPELINE TESTS PASSED! ===")

if __name__ == '__main__':
    run_tests()
