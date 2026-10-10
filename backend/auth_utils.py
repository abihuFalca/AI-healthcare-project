"""
Authentication, Token Management, RBAC & Audit Logging
PRD Section 6.1 & 9.1
"""

import jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db

SECRET_KEY = "med_triage_super_secure_clinical_jwt_secret_key_2026"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return hashlib.sha256(f"salt_med_{password}".encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(user_id: int, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def log_audit_event(
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    metadata: Optional[str] = None,
    ip_address: str = "127.0.0.1"
):
    """Writes an immutable record to the audit_logs table (SEC-7, ADM-5)."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, action, entity_type, str(entity_id or ""), metadata, ip_address, datetime.now().isoformat()))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to record audit log: {e}")

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication credentials were not provided")
    
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, phone, role, status FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="User account not found")

    user = dict(row)
    
    # Check account status (AUTH-7)
    if user["status"] == "DEACTIVATED":
        conn.close()
        raise HTTPException(status_code=403, detail="This account has been deactivated. Please contact support.")

    # Attach profile or clinician record
    if user["role"] == "PATIENT":
        cursor.execute("SELECT id, full_name, date_of_birth, gender, height, weight, preferred_language, consent_accepted FROM patient_profiles WHERE user_id = ?", (user_id,))
        p_row = cursor.fetchone()
        user["profile"] = dict(p_row) if p_row else None
    elif user["role"] == "HEALTHCARE_WORKER":
        cursor.execute("SELECT id, full_name, professional_role, professional_id, hospital_name, department, verification_status FROM healthcare_workers WHERE user_id = ?", (user_id,))
        w_row = cursor.fetchone()
        user["doctor_profile"] = dict(w_row) if w_row else None

    conn.close()
    return user

def require_role(allowed_roles: list):
    """Dependency for RBAC validation (SEC-2)."""
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Access denied: Requires role in {allowed_roles}")
        
        # Enforce healthcare worker verification requirement (AUTH-4, DOC-8)
        if user["role"] == "HEALTHCARE_WORKER":
            doc_prof = user.get("doctor_profile")
            if not doc_prof or doc_prof.get("verification_status") != "APPROVED":
                raise HTTPException(
                    status_code=403,
                    detail="Healthcare worker account is pending verification by an administrator."
                )
        return user
    return role_checker
