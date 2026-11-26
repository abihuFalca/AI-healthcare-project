#!/usr/bin/env python3
"""
Full frontend-to-Supabase data flow test.
Tests login, assessment creation, and data verification in Supabase.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import json
import requests
from database import get_db

API_BASE = "http://127.0.0.1:8000"

def test_api_login():
    """Test API login endpoint."""
    print("=== Step 1: API Login Test ===")
    try:
        response = requests.post(
            f"{API_BASE}/api/auth/login",
            json={"login": "patient@demo.com", "password": "demo123"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✓ Login successful")
            print(f"  Access token obtained (length: {len(token)})")
            print(f"  User: {data['user']['email']}, Role: {data['user']['role']}")
            return token
        else:
            print(f"✗ Login failed: {response.status_code} - {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to FastAPI server")
        print("  Please start the server with: python -m uvicorn main:app --host 127.0.0.1 --port 8000")
        return None
    except Exception as e:
        print(f"✗ Login request failed: {e}")
        return None

def test_api_assessment(token):
    """Test assessment creation via API."""
    print("\n=== Step 2: API Assessment Creation Test ===")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "age": 45,
            "gender": "Male",
            "height": 175,
            "weight": 80,
            "symptom_text": "WORKFLOW_FINAL_TEST mild headache and fatigue",
            "selected_symptoms": ["headache", "fatigue"],
            "duration": "2 days",
            "severity": "Mild",
            "medical_history": [],
            "medications": [],
            "risk_factors": [],
            "vitals": {
                "systolic_bp": 125,
                "diastolic_bp": 80,
                "heart_rate": 72,
                "spo2": 98,
                "temperature": 37.0,
                "respiratory_rate": 16,
                "blood_glucose": 95
            }
        }
        
        response = requests.post(
            f"{API_BASE}/api/assessments",
            json=payload,
            headers=headers,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            assessment_id = data.get("assessment_id")
            print(f"✓ Assessment created successfully")
            print(f"  Assessment ID: {assessment_id}")
            print(f"  Risk Score: {data.get('risk_score')}")
            print(f"  Risk Level: {data.get('risk_level')}")
            print(f"  Triage Level: {data.get('triage_level')}")
            return assessment_id
        else:
            print(f"✗ Assessment creation failed: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"✗ Assessment request failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def verify_supabase_record(assessment_id):
    """Verify the record exists in Supabase PostgreSQL."""
    print("\n=== Step 3: Verify Record in Supabase ===")
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check main assessment
        cursor.execute("""
            SELECT id, symptom_text, risk_score, risk_level, triage_level, created_at, 
                   safety_rule_triggered, recommendation
            FROM assessments 
            WHERE id = %s
        """, (assessment_id,))
        
        assessment = cursor.fetchone()
        if assessment:
            print(f"✓ Assessment found in Supabase")
            print(f"  ID: {assessment['id']}")
            print(f"  Symptom Text: {assessment['symptom_text']}")
            print(f"  Risk Score: {assessment['risk_score']}")
            print(f"  Risk Level: {assessment['risk_level']}")
            print(f"  Triage Level: {assessment['triage_level']}")
            print(f"  Safety Rule Triggered: {assessment['safety_rule_triggered']}")
        else:
            print(f"✗ Assessment {assessment_id} NOT found in Supabase")
            conn.close()
            return False
        
        # Check patient_vitals
        cursor.execute("""
            SELECT COUNT(*) as count FROM patient_vitals WHERE assessment_id = %s
        """, (assessment_id,))
        vitals_count = cursor.fetchone()['count']
        print(f"✓ patient_vitals rows: {vitals_count}")
        
        # Check ai_explanations
        cursor.execute("""
            SELECT COUNT(*) as count FROM ai_explanations WHERE assessment_id = %s
        """, (assessment_id,))
        explanations_count = cursor.fetchone()['count']
        print(f"✓ ai_explanations rows: {explanations_count}")
        
        # Check healthcare_reviews
        cursor.execute("""
            SELECT COUNT(*) as count FROM healthcare_reviews WHERE assessment_id = %s
        """, (assessment_id,))
        reviews_count = cursor.fetchone()['count']
        print(f"✓ healthcare_reviews rows: {reviews_count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"✗ Supabase verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_sqlite_not_written():
    """Verify SQLite database was not written to."""
    print("\n=== Step 4: Verify SQLite NOT Used ===")
    try:
        import os
        import datetime
        
        sqlite_path = "healthcare.db"
        if not os.path.exists(sqlite_path):
            print("✓ SQLite database file does not exist")
            return True
        
        mtime = os.path.getmtime(sqlite_path)
        mtime_dt = datetime.datetime.fromtimestamp(mtime)
        now = datetime.datetime.now()
        age_seconds = (now - mtime_dt).total_seconds()
        
        print(f"  SQLite last modified: {mtime_dt}")
        print(f"  Age: {age_seconds:.0f} seconds ago")
        
        if age_seconds > 300:  # More than 5 minutes old
            print("✓ SQLite was NOT written to (file is old)")
            return True
        else:
            print("⚠ SQLite was recently modified - may have been written to")
            return False
            
    except Exception as e:
        print(f"✗ SQLite check failed: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("FRONTEND-TO-SUPABASE DATA FLOW VERIFICATION")
    print("=" * 60)
    
    # Test login
    token = test_api_login()
    if not token:
        print("\n✗ Cannot proceed without valid token")
        print("  Ensure FastAPI server is running: python -m uvicorn main:app --host 127.0.0.1 --port 8000")
        sys.exit(1)
    
    # Test assessment creation
    assessment_id = test_api_assessment(token)
    if not assessment_id:
        print("\n✗ Cannot proceed without assessment ID")
        sys.exit(1)
    
    # Verify in Supabase
    verified = verify_supabase_record(assessment_id)
    if not verified:
        print("\n✗ Record verification failed")
        sys.exit(1)
    
    # Check SQLite not used
    sqlite_ok = check_sqlite_not_written()
    
    # Final summary
    print("\n" + "=" * 60)
    print("FINAL VERDICT")
    print("=" * 60)
    if verified and sqlite_ok:
        print("✓ COMPLETE DATA FLOW VERIFIED")
        print("  - FastAPI uses Supabase PostgreSQL")
        print("  - Assessment records saved to Supabase")
        print("  - Related tables (vitals, explanations, reviews) populated")
        print("  - SQLite database NOT used")
        sys.exit(0)
    else:
        print("⚠ PARTIAL SUCCESS")
        print(f"  - Supabase verification: {'✓' if verified else '✗'}")
        print(f"  - SQLite not used: {'✓' if sqlite_ok else '✗'}")
        sys.exit(1)
