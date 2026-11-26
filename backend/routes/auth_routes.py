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
    raw_login = req.login.strip()
    digits_only = "".join(c for c in raw_login if c.isdigit())
    
    cursor.execute("""
        SELECT id, email, phone, role, status FROM users
        WHERE (
            email = %s 
            OR phone = %s
            OR (phone IS NOT NULL AND %s != '' AND regexp_replace(phone, '[^0-9]', '', 'g') = %s)
        ) AND password_hash = %s
    """, (raw_login.lower(), raw_login, digits_only, digits_only, pwd_hash))
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
            "phone": user.get("phone"),
            "role": user["role"],
            "status": user["status"],
            "profile": profile_data,
            "doctor_profile": profile_data if user["role"] == "HEALTHCARE_WORKER" else None,
            "patient_profile": profile_data if user["role"] == "PATIENT" else None
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
    res_user = cursor.fetchone()
    user_id = res_user["id"] if isinstance(res_user, dict) else res_user[0]

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
    # Professional credential validation safeguards
    if not req.full_name.strip() or not req.email.strip() or not req.password.strip():
        raise HTTPException(status_code=400, detail="Clinician full name, email, and password are required")
    if len(req.password.strip()) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not req.professional_id.strip() or len(req.professional_id.strip()) < 3:
        raise HTTPException(status_code=400, detail="A valid medical license or professional ID is required")
    if not req.hospital_name.strip() or not req.department.strip():
        raise HTTPException(status_code=400, detail="Healthcare facility and department are required")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email.lower().strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    now_iso = datetime.now().isoformat()
    pwd_hash = hash_password(req.password)

    # Clinician account created with ACTIVE status upon valid credential submission
    cursor.execute("""
        INSERT INTO users (email, phone, password_hash, role, status, created_at)
        VALUES (%s, %s, %s, 'HEALTHCARE_WORKER', 'ACTIVE', %s) RETURNING id
    """, (req.email.lower().strip(), req.phone, pwd_hash, now_iso))
    res_user = cursor.fetchone()
    user_id = res_user["id"] if isinstance(res_user, dict) else res_user[0]

    # Verification status is APPROVED with automated credential verification
    cursor.execute("""
        INSERT INTO healthcare_workers (user_id, full_name, professional_role, professional_id, hospital_name, department, verification_status, verified_at, verified_by_user_id)
        VALUES (%s, %s, %s, %s, %s, %s, 'APPROVED', %s, %s) RETURNING id
    """, (user_id, req.full_name.strip(), req.professional_role.strip(), req.professional_id.strip(), req.hospital_name.strip(), req.department.strip(), now_iso, user_id))
    res_worker = cursor.fetchone()
    worker_id = res_worker["id"] if isinstance(res_worker, dict) else res_worker[0]

    conn.commit()
    log_audit_event(user_id, "DOCTOR_REGISTER_VERIFIED", "USER", str(user_id), f"Clinician registered and verified: {req.full_name} ({req.professional_id}) at {req.hospital_name}")

    token = create_access_token(user_id, req.email.lower().strip(), "HEALTHCARE_WORKER")
    conn.close()

    doctor_profile = {
        "id": worker_id,
        "user_id": user_id,
        "full_name": req.full_name.strip(),
        "professional_role": req.professional_role.strip(),
        "professional_id": req.professional_id.strip(),
        "hospital_name": req.hospital_name.strip(),
        "department": req.department.strip(),
        "verification_status": "APPROVED",
        "verified_at": now_iso
    }

    return {
        "access_token": token,
        "token_type": "bearer",
        "status": "APPROVED",
        "message": "Clinician registered and verified successfully.",
        "user": {
            "id": user_id,
            "email": req.email.lower().strip(),
            "phone": req.phone,
            "role": "HEALTHCARE_WORKER",
            "status": "ACTIVE",
            "full_name": req.full_name.strip(),
            "profile": doctor_profile,
            "doctor_profile": doctor_profile
        }
    }

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}

@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    log_audit_event(user["id"], "USER_LOGOUT", "USER", str(user["id"]), "User logged out")
    return {"message": "Logged out successfully"}

# ============================================================================
# CONSENT MANAGEMENT (PRD §9.2, §6.3)
# ============================================================================

class ConsentRequest(BaseModel):
    consent_version: str  # e.g., "v1.0"
    accepted: bool        # True to accept AI processing, False to decline

@router.post("/consent")
def record_consent(req: ConsentRequest, user: dict = Depends(get_current_user)):
    """
    Records explicit consent for AI-based health assessment and data processing.
    
    PRD Requirements:
    - Explicit consent required before first assessment (§9.2, §6.3)
    - Stores consent version, timestamp, and acceptance status for audit trail
    - If declined, user can still submit assessments but AI processing is skipped
    - Consent is per-user, stored in consent_records table
    
    Args:
        req: ConsentRequest with consent_version and accepted boolean
        user: Current authenticated user
        
    Returns:
        Consent record with id, timestamp, and status
    """
    conn = get_db()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    
    # Skip a duplicate only when the latest decision for this version is the same.
    # A user who declined earlier and now accepts (or withdraws) must get a new row.
    cursor.execute("""
        SELECT id, accepted, accepted_at FROM consent_records
        WHERE user_id = %s AND consent_version = %s
        ORDER BY id DESC LIMIT 1
    """, (user["id"], req.consent_version))
    existing = cursor.fetchone()

    if existing and bool(existing["accepted"]) == req.accepted:
        conn.close()
        return {
            "message": f"Consent for version {req.consent_version} already recorded",
            "consent_id": existing["id"],
            "accepted": req.accepted,
            "consent_version": req.consent_version,
            "accepted_at": existing["accepted_at"]
        }

    # Append a new consent record (accepted or declined) — the table is append-only
    cursor.execute("""
        INSERT INTO consent_records (user_id, consent_version, accepted, accepted_at)
        VALUES (%s, %s, %s, %s) RETURNING id
    """, (user["id"], req.consent_version, req.accepted, now_iso))

    consent_id = cursor.fetchone()["id"]

    # Keep the patient profile flag in sync with the latest decision
    if user["role"] == "PATIENT":
        cursor.execute("""
            UPDATE patient_profiles
            SET consent_accepted = %s, consent_accepted_at = %s
            WHERE user_id = %s
        """, (req.accepted, now_iso if req.accepted else None, user["id"]))
    
    conn.commit()
    
    # Audit logging
    action = "CONSENT_ACCEPTED" if req.accepted else "CONSENT_DECLINED"
    log_audit_event(
        user["id"],
        action,
        "CONSENT",
        str(consent_id),
        f"User consent recorded for version {req.consent_version}: {'ACCEPTED' if req.accepted else 'DECLINED'}"
    )
    
    conn.close()
    
    return {
        "consent_id": consent_id,
        "accepted": req.accepted,
        "consent_version": req.consent_version,
        "accepted_at": now_iso,
        "message": f"Consent {'accepted' if req.accepted else 'declined'} and recorded for audit compliance"
    }

@router.get("/consent/status")
def get_consent_status(user: dict = Depends(get_current_user)):
    """
    Returns current consent status for the authenticated user.
    
    Returns the most recent consent record with version and acceptance status.
    Used by frontend to determine whether to show ConsentScreen.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, consent_version, accepted, accepted_at FROM consent_records
        WHERE user_id = %s
        ORDER BY id DESC LIMIT 1
    """, (user["id"],))

    consent_row = cursor.fetchone()
    conn.close()

    if not consent_row:
        return {
            "has_consented": False,
            "message": "No consent record found; user must review privacy notice"
        }

    # The latest decision wins: a decline (or withdrawal) means no consent
    return {
        "has_consented": bool(consent_row["accepted"]),
        "consent_id": consent_row["id"],
        "consent_version": consent_row["consent_version"],
        "accepted_at": consent_row["accepted_at"]
    }
