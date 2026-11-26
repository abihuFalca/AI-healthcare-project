#!/usr/bin/env python3
"""Test PostgreSQL connection and data flow."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import json
from database import get_db, hash_password

def test_connection():
    """Test basic PostgreSQL connection."""
    print("=== Testing PostgreSQL Connection ===")
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM users')
        result = cursor.fetchone()
        print(f"✓ PostgreSQL connection successful!")
        print(f"✓ Users table has {result['count']} rows")
        print(f"✓ RealDictCursor working - can access by column name")
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False

def test_login():
    """Test login with demo credentials."""
    print("\n=== Testing Login Flow ===")
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Test patient login
        pwd_hash = hash_password("demo123")
        cursor.execute("""
            SELECT id, email, phone, role, status FROM users
            WHERE (email = %s OR phone = %s) AND password_hash = %s
        """, ("patient@demo.com", "patient@demo.com", pwd_hash))
        
        user = cursor.fetchone()
        if user:
            print(f"✓ Login successful for: {user['email']}")
            print(f"  User ID: {user['id']}, Role: {user['role']}, Status: {user['status']}")
            
            # Get patient profile
            cursor.execute("SELECT id, full_name FROM patient_profiles WHERE user_id = %s", (user['id'],))
            profile = cursor.fetchone()
            if profile:
                print(f"✓ Patient profile found: {profile['full_name']}")
            
            conn.close()
            return True
        else:
            print("✗ Login failed - user not found")
            conn.close()
            return False
            
    except Exception as e:
        print(f"✗ Login test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_assessment_insert():
    """Test inserting a synthetic assessment record."""
    print("\n=== Testing Assessment INSERT with RETURNING id ===")
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get patient ID
        cursor.execute("SELECT id FROM patient_profiles WHERE user_id = (SELECT id FROM users WHERE email = %s)", ("patient@demo.com",))
        patient = cursor.fetchone()
        
        if not patient:
            print("✗ Patient not found")
            return False
            
        patient_id = patient['id']
        print(f"✓ Found patient ID: {patient_id}")
        
        # Insert test assessment
        cursor.execute("""
            INSERT INTO assessments (
                patient_id, assigned_healthcare_worker_id, symptom_text, symptoms_json,
                duration, severity, history_snapshot, risk_factors_snapshot, medications_snapshot,
                vitals_snapshot, risk_score, risk_level, triage_level, safety_rule_triggered,
                safety_rule_details, ai_status, recommendation, model_version, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'COMPLETED', %s, %s, %s) RETURNING id
        """, (
            patient_id, 1, "TEST_WORKFLOW_RECORD mild headache", json.dumps(["headache"]),
            "1 day", "Mild", json.dumps([]), json.dumps([]), json.dumps([]),
            json.dumps({"systolic_bp": 120, "heart_rate": 70}), 25, "LOW", "ROUTINE", False,
            json.dumps([]), "Routine care recommended", "rf-0.1.0", "2026-01-15T10:00:00"
        ))
        
        assessment_id = cursor.fetchone()['id']
        print(f"✓ Assessment inserted with ID: {assessment_id}")
        
        # Verify it exists
        cursor.execute("SELECT id, symptom_text, risk_score, risk_level FROM assessments WHERE id = %s", (assessment_id,))
        verify = cursor.fetchone()
        print(f"✓ Verified assessment: {verify['symptom_text']}, Risk: {verify['risk_level']}")
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"✗ Assessment insert failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    results = []
    results.append(test_connection())
    results.append(test_login())
    results.append(test_assessment_insert())
    
    print(f"\n=== Summary ===")
    print(f"Tests passed: {sum(results)}/{len(results)}")
    
    sys.exit(0 if all(results) else 1)
