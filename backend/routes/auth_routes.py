from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db, hash_password
from auth_utils import create_access_token, get_current_user, log_audit_event

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    login: str  # Email or phone
    password: str

class PatientRegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    date_of_birth: str
    gender: str
    height: Optional[float] = None
    weight: Optional[float] = None
    preferred_language: Optional[str] = "English"
    emergency_contact: Optional[str] = None

class DoctorRegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: str
    professional_role: str
    professional_id: str
    hospital_name: str
    department: str

@router.post("/login")
def login(req: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    pwd_hash = hash_password(req.password)
    
    cursor.execute("""
        SELECT id, email, phone, role, status FROM users
        WHERE (email = %s OR phone = %s) AND password_hash = %s
    """, (req.login.lower().strip(), req.login.strip(), pwd_hash))
    user_row = cursor.fetchone()

    if not user_row:
        log_audit_event(None, "FAILED_LOGIN", "USER", None, f"Attempted login with: {req.login}")
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    user = dict(user_row)
    if user["status"] == "DEACTIVATED":
        conn.close()
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact an administrator.")

    # Update last login
    now_iso = datetime.now().isoformat()
    cursor.execute("UPDATE users SET last_login = %s WHERE id = %s", (now_iso, user["id"]))
    conn.commit()

    token = create_access_token(user["id"], user["email"], user["role"])
    log_audit_event(user["id"], "USER_LOGIN", "USER", str(user["id"]), f"Successful login for {user['email']}")

    # Get associated details
    profile_data = None
    if user["role"] == "PATIENT":
        cursor.execute("SELECT * FROM patient_profiles WHERE user_id = %s", (user["id"],))
        p = cursor.fetchone()
        profile_data = dict(p) if p else None
    elif user["role"] == "HEALTHCARE_WORKER":
        cursor.execute("SELECT * FROM healthcare_workers WHERE user_id = %s", (user["id"],))
        d = cursor.fetchone()
        profile_data = dict(d) if d else None

    conn.close()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "status": user["status"],
            "profile": profile_data
        }
    }

@router.post("/register")
def register_patient(req: PatientRegisterRequest):
    conn = get_db()
    cursor = conn.cursor()

    # Check existing
    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    now_iso = datetime.now().isoformat()
    pwd_hash = hash_password(req.password)

    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, created_at)
        VALUES (%s, %s, %s, 'PATIENT', 'ACTIVE', %s) RETURNING id
    """, (req.email.lower(), req.phone, pwd_hash, now_iso))
    user_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO patient_profiles (user_id, full_name, date_of_birth, gender, height, weight, preferred_language, emergency_contact, consent_accepted, consent_accepted_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
    """, (user_id, req.full_name, req.date_of_birth, req.gender, req.height, req.weight, req.preferred_language, req.emergency_contact, now_iso))

    conn.commit()
    log_audit_event(user_id, "PATIENT_REGISTER", "USER", str(user_id), f"New patient registered: {req.full_name}")

    token = create_access_token(user_id, req.email.lower(), "PATIENT")
    conn.close()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email.lower(),
            "role": "PATIENT",
            "status": "ACTIVE",
            "full_name": req.full_name
        }
    }

@router.post("/register-doctor")
def register_doctor(req: DoctorRegisterRequest):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    now_iso = datetime.now().isoformat()
    pwd_hash = hash_password(req.password)

    # Healthcare-worker status starts as PENDING until Admin approval (PRD AUTH-4, Section 4.1)
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, created_at)
        VALUES (%s, %s, %s, 'HEALTHCARE_WORKER', 'PENDING', %s) RETURNING id
    """, (req.email.lower(), req.phone, pwd_hash, now_iso))
    user_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO healthcare_workers (user_id, full_name, professional_role, professional_id, hospital_name, department, verification_status)
        VALUES (%s, %s, %s, %s, %s, %s, 'PENDING')
    """, (user_id, req.full_name, req.professional_role, req.professional_id, req.hospital_name, req.department))

    conn.commit()
    log_audit_event(user_id, "DOCTOR_REGISTER_PENDING", "USER", str(user_id), f"Clinician registration submitted for approval: {req.full_name} ({req.professional_id})")

    token = create_access_token(user_id, req.email.lower(), "HEALTHCARE_WORKER")
    conn.close()

    return {
        "access_token": token,
        "token_type": "bearer",
        "status": "PENDING",
        "message": "Registration submitted successfully. Your clinical credentials are pending administrative verification.",
        "user": {
            "id": user_id,
            "email": req.email.lower(),
            "role": "HEALTHCARE_WORKER",
            "status": "PENDING",
            "full_name": req.full_name
        }
    }

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    log_audit_event(user["id"], "USER_LOGOUT", "USER", str(user["id"]), "User logged out")
    return {"message": "Logged out successfully"}
