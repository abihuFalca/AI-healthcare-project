import psycopg2
import psycopg2.extras
import os
import json
import hashlib
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def hash_password(password: str) -> str:
    """Deterministic hash with salt for demo simplicity."""
    return hashlib.sha256(f"salt_med_{password}".encode()).hexdigest()

def get_db():
    """Returns a PostgreSQL connection using Supabase DATABASE_URL."""
    conn = psycopg2.connect(DATABASE_URL)
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('PATIENT', 'HEALTHCARE_WORKER', 'ADMIN')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING', 'DEACTIVATED')),
        last_login TIMESTAMP,
        created_at TIMESTAMP NOT NULL
    );
    """)

    # Patient profiles (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        date_of_birth DATE NOT NULL,
        gender TEXT NOT NULL,
        height REAL,
        weight REAL,
        preferred_language TEXT DEFAULT 'English',
        emergency_contact TEXT,
        consent_accepted BOOLEAN DEFAULT TRUE,
        consent_accepted_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Healthcare workers (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS healthcare_workers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        professional_role TEXT NOT NULL,
        professional_id TEXT NOT NULL,
        hospital_name TEXT NOT NULL,
        department TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
        verified_at TIMESTAMP,
        verified_by_user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Medical history (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medical_history (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        condition TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        diagnosed_date DATE,
        notes TEXT,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
    );
    """)

    # Medications (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medications (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        medication_name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
        start_date DATE,
        end_date DATE,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
    );
    """)

    # Risk factors (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS risk_factors (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        factor_type TEXT NOT NULL,
        value TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id) ON DELETE CASCADE
    );
    """)

    # Assessments (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        assigned_healthcare_worker_id INTEGER,
        symptom_text TEXT,
        symptoms_json TEXT NOT NULL,
        duration TEXT,
        severity TEXT,
        history_snapshot TEXT,
        risk_factors_snapshot TEXT,
        medications_snapshot TEXT,
        vitals_snapshot TEXT,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('LOW', 'MODERATE', 'HIGH')),
        triage_level TEXT NOT NULL CHECK(triage_level IN ('ROUTINE', 'PROMPT', 'IMMEDIATE', 'EMERGENCY')),
        safety_rule_triggered BOOLEAN DEFAULT FALSE,
        safety_rule_details TEXT,
        ai_status TEXT DEFAULT 'COMPLETED',
        recommendation TEXT NOT NULL,
        model_version TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id)
    );
    """)

    # Patient vitals (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patient_vitals (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        assessment_id INTEGER NOT NULL,
        systolic_bp REAL,
        diastolic_bp REAL,
        heart_rate REAL,
        spo2 REAL,
        temperature REAL,
        respiratory_rate REAL,
        blood_glucose REAL,
        recorded_at TIMESTAMP NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patient_profiles(id),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    );
    """)

    # AI explanations (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_explanations (
        id SERIAL PRIMARY KEY,
        assessment_id INTEGER NOT NULL,
        feature TEXT NOT NULL,
        contribution REAL NOT NULL,
        importance TEXT NOT NULL CHECK(importance IN ('high', 'medium', 'low')),
        explanation_text TEXT NOT NULL,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    );
    """)

    # Healthcare reviews (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS healthcare_reviews (
        id SERIAL PRIMARY KEY,
        assessment_id INTEGER NOT NULL,
        healthcare_worker_id INTEGER NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING', 'REVIEWED', 'ESCALATED', 'CLOSED')),
        clinical_notes TEXT,
        final_triage_status TEXT,
        reviewed_at TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id),
        FOREIGN KEY (healthcare_worker_id) REFERENCES healthcare_workers(id)
    );
    """)

    # Notifications (Section 11.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        link_url TEXT,
        created_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Audit logs (Section 11.1)
    cursor.execute("""
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
    """)

    # System configuration & model information (Section 6.10, ADM-6, ADM-7)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP NOT NULL
    );
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()

def seed_initial_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] > 0:
        return  # Already seeded

    now = datetime.now()
    yesterday = datetime.now() - timedelta(days=1)
    two_weeks_ago = datetime.now() - timedelta(days=14)
    month_ago = datetime.now() - timedelta(days=30)

    # 1. Admin
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, last_login, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, ("admin@healthsystem.org", "+1-800-555-0100", hash_password("demo123"), "ADMIN", "ACTIVE", now, month_ago))
    admin_user_id = cursor.fetchone()[0]

    # 2. Approved Doctor (Dr. Sarah Chen, Cardiology)
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, last_login, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, ("doctor@hospital.com", "+1-555-019-2834", hash_password("demo123"), "HEALTHCARE_WORKER", "ACTIVE", yesterday, month_ago))
    doc1_user_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO healthcare_workers (user_id, full_name, professional_role, professional_id, hospital_name, department, verification_status, verified_at, verified_by_user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (doc1_user_id, "Dr. Sarah Chen, MD", "Cardiologist / Lead Triage Clinician", "MD-NY-84920", "St. Jude Metropolitan Hospital", "Cardiology & Emergency Triage", "APPROVED", month_ago, 1))
    doc1_id = cursor.fetchone()[0]

    # 3. Pending Doctor (Dr. Alex Patel, Needs verification for ADM-3 demo!)
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, last_login, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, ("newdoc@clinic.com", "+1-555-014-9988", hash_password("demo123"), "HEALTHCARE_WORKER", "PENDING", None, yesterday))
    doc2_user_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO healthcare_workers (user_id, full_name, professional_role, professional_id, hospital_name, department, verification_status, verified_at, verified_by_user_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (doc2_user_id, "Dr. Alex Patel, MD", "Emergency Medicine Resident", "MED-RES-2026-441", "City General Trauma Center", "Emergency Medicine", "PENDING", None, None))
    doc2_id = cursor.fetchone()[0]

    # 4. Patient: John Doe (Section 15 Demo Scenario: Age 58, hypertension history)
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, last_login, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, ("patient@demo.com", "+1-555-012-3456", hash_password("demo123"), "PATIENT", "ACTIVE", now, month_ago))
    pat1_user_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO patient_profiles (user_id, full_name, date_of_birth, gender, height, weight, preferred_language, emergency_contact, consent_accepted, consent_accepted_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s) RETURNING id
    """, (pat1_user_id, "John Doe", "1968-04-12", "Male", 178, 86, "English", "Mary Doe (Spouse) - 555-012-3457", month_ago))
    pat1_id = cursor.fetchone()[0]

    # John Doe Medical History (Section 15 Demo: Hypertension)
    cursor.execute("""
        INSERT INTO medical_history (patient_id, condition, status, diagnosed_date, notes)
        VALUES (%s, %s, %s, %s, %s)
    """, (pat1_id, "Hypertension", "ACTIVE", "2019-06-15", "Stage 1 primary hypertension, managed with oral medication"))

    # John Doe Medications
    cursor.execute("""
        INSERT INTO medications (patient_id, medication_name, dosage, frequency, start_date)
        VALUES (%s, %s, %s, %s, %s)
    """, (pat1_id, "Amlodipine", "5mg", "Once daily morning", "2021-01-10"))

    # John Doe Risk Factors
    cursor.execute("""
        INSERT INTO risk_factors (patient_id, factor_type, value, notes)
        VALUES (%s, %s, %s, %s)
    """, (pat1_id, "Smoking", "Former smoker", "Quit 4 years ago (15 pack-years)"))
    cursor.execute("""
        INSERT INTO risk_factors (patient_id, factor_type, value, notes)
        VALUES (%s, %s, %s, %s)
    """, (pat1_id, "Family History", "Father had CAD at age 62", "First-degree relative cardiovascular history"))

    # John Doe Past Assessment 1 (30 days ago - LOW risk: routine check)
    cursor.execute("""
        INSERT INTO assessments (patient_id, assigned_healthcare_worker_id, symptom_text, symptoms_json, duration, severity, history_snapshot, risk_factors_snapshot, medications_snapshot, vitals_snapshot, risk_score, risk_level, triage_level, safety_rule_triggered, ai_status, recommendation, model_version, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, 'COMPLETED', %s, 'rf-0.1.0', %s) RETURNING id
    """, (
        pat1_id, doc1_id,
        "Mild seasonal dry cough for two days, no fever.",
        json.dumps(["cough"]), "2 days", "Mild",
        json.dumps(["Hypertension"]), json.dumps(["Former smoker", "Family History"]), json.dumps(["Amlodipine 5mg"]),
        json.dumps({"systolic_bp": 128, "diastolic_bp": 82, "heart_rate": 72, "spo2": 98, "temperature": 36.8, "respiratory_rate": 16, "blood_glucose": 95}),
        24, "LOW", "ROUTINE",
        "Routine healthcare consultation / monitoring. Continue current prescribed medications and log vitals regularly.",
        month_ago
    ))
    past_asm1_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO patient_vitals (patient_id, assessment_id, systolic_bp, diastolic_bp, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_at)
        VALUES (%s, %s, 128, 82, 72, 98, 36.8, 16, 95, %s)
    """, (pat1_id, past_asm1_id, month_ago))
    cursor.execute("""
        INSERT INTO ai_explanations (assessment_id, feature, contribution, importance, explanation_text)
        VALUES (%s, %s, %s, %s, %s)
    """, (past_asm1_id, "age_and_history", 0.12, "low", "Age and treated hypertension present baseline risk"))
    cursor.execute("""
        INSERT INTO ai_explanations (assessment_id, feature, contribution, importance, explanation_text)
        VALUES (%s, %s, %s, %s, %s)
    """, (past_asm1_id, "normal_vitals", -0.15, "low", "Normal resting vitals and oxygen saturation offset acute concerns"))

    # John Doe Past Assessment 2 (14 days ago - MODERATE risk: mild dizziness and elevated BP)
    cursor.execute("""
        INSERT INTO assessments (patient_id, assigned_healthcare_worker_id, symptom_text, symptoms_json, duration, severity, history_snapshot, risk_factors_snapshot, medications_snapshot, vitals_snapshot, risk_score, risk_level, triage_level, safety_rule_triggered, ai_status, recommendation, model_version, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, 'COMPLETED', %s, 'rf-0.1.0', %s) RETURNING id
    """, (
        pat1_id, doc1_id,
        "Occasional dizziness when standing up and mild headache over past week.",
        json.dumps(["dizziness", "headache"]), "5 days", "Moderate",
        json.dumps(["Hypertension"]), json.dumps(["Former smoker", "Family History"]), json.dumps(["Amlodipine 5mg"]),
        json.dumps({"systolic_bp": 142, "diastolic_bp": 90, "heart_rate": 84, "spo2": 97, "temperature": 36.9, "respiratory_rate": 17, "blood_glucose": 105}),
        52, "MODERATE", "PROMPT",
        "Prompt healthcare consultation. Schedule an in-person or telehealth review with your clinician within 48-72 hours to assess blood pressure control.",
        two_weeks_ago
    ))
    past_asm2_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO patient_vitals (patient_id, assessment_id, systolic_bp, diastolic_bp, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_at)
        VALUES (%s, %s, 142, 90, 84, 97, 36.9, 17, 105, %s)
    """, (pat1_id, past_asm2_id, two_weeks_ago))
    cursor.execute("""
        INSERT INTO healthcare_reviews (assessment_id, healthcare_worker_id, review_status, clinical_notes, final_triage_status, reviewed_at)
        VALUES (%s, %s, 'REVIEWED', 'Advised patient to monitor morning and evening BP; adjust dosage if persistent above 140/90.', 'PROMPT', %s)
    """, (past_asm2_id, doc1_id, two_weeks_ago))

    # 5. Additional Patient: Maria Garcia (Age 64, Type 2 Diabetes, High Risk queue item)
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, last_login, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, ("maria@example.com", "+1-555-017-8899", hash_password("demo123"), "PATIENT", "ACTIVE", yesterday, month_ago))
    pat2_user_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO patient_profiles (user_id, full_name, date_of_birth, gender, height, weight, preferred_language, emergency_contact, consent_accepted, consent_accepted_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s) RETURNING id
    """, (pat2_user_id, "Maria Garcia", "1962-09-22", "Female", 162, 74, "English", "Carlos Garcia - 555-017-8890", month_ago))
    pat2_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO medical_history (patient_id, condition, status, diagnosed_date, notes)
        VALUES (%s, %s, %s, %s, %s)
    """, (pat2_id, "Diabetes Type 2", "ACTIVE", "2015-03-10", "Insulin-dependent, recent peripheral neuropathy"))
    cursor.execute("""
        INSERT INTO assessments (patient_id, assigned_healthcare_worker_id, symptom_text, symptoms_json, duration, severity, history_snapshot, risk_factors_snapshot, medications_snapshot, vitals_snapshot, risk_score, risk_level, triage_level, safety_rule_triggered, ai_status, recommendation, model_version, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, 'COMPLETED', %s, 'rf-0.1.0', %s) RETURNING id
    """, (
        pat2_id, doc1_id,
        "Feeling unusually drowsy with blurred vision and excessive thirst today.",
        json.dumps(["drowsiness", "blurred vision", "excessive thirst"]), "8 hours", "Severe",
        json.dumps(["Diabetes Type 2"]), json.dumps(["Physical inactivity"]), json.dumps(["Metformin 1000mg", "Glargine 20u"]),
        json.dumps({"systolic_bp": 138, "diastolic_bp": 88, "heart_rate": 96, "spo2": 97, "temperature": 37.2, "respiratory_rate": 20, "blood_glucose": 320}),
        76, "HIGH", "IMMEDIATE",
        "Immediate clinical assessment. Markedly elevated glucose and osmotic symptoms warrant urgent evaluation.",
        yesterday
    ))
    past_asm3_id = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO patient_vitals (patient_id, assessment_id, systolic_bp, diastolic_bp, heart_rate, spo2, temperature, respiratory_rate, blood_glucose, recorded_at)
        VALUES (%s, %s, 138, 88, 96, 97, 37.2, 20, 320, %s)
    """, (pat2_id, past_asm3_id, yesterday))
    cursor.execute("""
        INSERT INTO ai_explanations (assessment_id, feature, contribution, importance, explanation_text)
        VALUES (%s, 'blood_glucose_critical', 0.32, 'high', 'Blood glucose 320 mg/dL is severely elevated above target range')
    """, (past_asm3_id,))
    cursor.execute("""
        INSERT INTO ai_explanations (assessment_id, feature, contribution, importance, explanation_text)
        VALUES (%s, 'diabetic_hyperglycemia_symptoms', 0.28, 'high', 'Excessive thirst, drowsiness and blurred vision align with acute hyperglycemic decompensation')
    """, (past_asm3_id,))
    cursor.execute("""
        INSERT INTO healthcare_reviews (assessment_id, healthcare_worker_id, review_status, clinical_notes, final_triage_status, reviewed_at)
        VALUES (%s, %s, 'PENDING', NULL, NULL, NULL)
    """, (past_asm3_id, doc1_id))

    # Notifications
    cursor.execute("""
        INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
        VALUES (%s, 'Triage Review Update', 'Dr. Sarah Chen reviewed your recent health check. Triage confirmed: PROMPT consultation.', 'REVIEW_COMPLETED', TRUE, '/patient/history', %s)
    """, (pat1_user_id, two_weeks_ago))
    cursor.execute("""
        INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
        VALUES (%s, 'High Risk Alert: Immediate Attention Required', 'Patient Maria Garcia submitted an assessment flagged HIGH (Risk Score: 76, Glucose: 320). Awaiting clinical review.', 'HIGH_RISK_ALERT', FALSE, '/doctor/queue', %s)
    """, (doc1_user_id, yesterday))

    # System Configuration (ADM-6)
    settings = [
        ("risk_threshold_low", "39", "Upper score limit for LOW risk band (0-39)"),
        ("risk_threshold_moderate", "69", "Upper score limit for MODERATE risk band (40-69)"),
        ("risk_threshold_high", "100", "Score range for HIGH risk band (70-100)"),
        ("vital_systolic_bp_warn_high", "180", "Systolic BP warning upper limit (mmHg)"),
        ("vital_systolic_bp_warn_low", "90", "Systolic BP warning lower limit (mmHg)"),
        ("vital_heart_rate_warn_high", "120", "Heart rate warning upper limit (bpm)"),
        ("vital_heart_rate_warn_low", "50", "Heart rate warning lower limit (bpm)"),
        ("vital_spo2_warn_low", "94", "SpO2 critical warning threshold (%)"),
        ("model_active_version", "rf-0.1.0", "Active production model version"),
        ("model_algorithm", "Calibrated Random Forest + Explainable SHAP", "Algorithm family"),
        ("safety_rules_version", "v1.2-cardiac-neuro", "Deterministic safety rules engine version")
    ]
    for k, v, d in settings:
        cursor.execute("""
            INSERT INTO system_settings (setting_key, setting_value, description, updated_at)
            VALUES (%s, %s, %s, %s)
        """, (k, v, d, now))

    # Audit Logs (SEC-7, ADM-5)
    audit_events = [
        (1, "SYSTEM_INIT", "CONFIG", "0", "Initial system configuration and clinical safety rules loaded", "127.0.0.1", month_ago),
        (doc1_user_id, "USER_LOGIN", "USER", str(doc1_user_id), "Doctor Dr. Sarah Chen logged in", "192.168.1.10", yesterday),
        (pat1_user_id, "ASSESSMENT_CREATED", "ASSESSMENT", str(past_asm1_id), "Assessment submitted, score 24 (LOW)", "192.168.1.25", month_ago),
        (pat1_user_id, "ASSESSMENT_CREATED", "ASSESSMENT", str(past_asm2_id), "Assessment submitted, score 52 (MODERATE)", "192.168.1.25", two_weeks_ago),
        (doc1_user_id, "REVIEW_SUBMITTED", "ASSESSMENT", str(past_asm2_id), "Doctor completed clinical review and triage confirmation", "192.168.1.10", two_weeks_ago),
        (pat2_user_id, "ASSESSMENT_CREATED", "ASSESSMENT", str(past_asm3_id), "Assessment submitted, score 76 (HIGH)", "192.168.1.88", yesterday),
    ]
    for u_id, act, e_type, e_id, meta, ip, ts in audit_events:
        cursor.execute("""
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (u_id, act, e_type, e_id, meta, ip, ts))

    conn.commit()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully with Supabase PostgreSQL!")
