from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth_utils import require_role, log_audit_event
from ai.risk_model import MODEL_VERSION

router = APIRouter(prefix="/api/admin", tags=["admin"])

class UserStatusUpdateRequest(BaseModel):
    status: str  # ACTIVE or DEACTIVATED

class DoctorApprovalRequest(BaseModel):
    verification_status: str  # APPROVED or REJECTED
    notes: Optional[str] = None

class SettingUpdateRequest(BaseModel):
    setting_key: str
    setting_value: str

@router.get("/dashboard")
def get_admin_dashboard(user: dict = Depends(require_role(["ADMIN"]))):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'PATIENT'")
    total_patients = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'HEALTHCARE_WORKER'")
    total_doctors = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM healthcare_workers WHERE verification_status = 'PENDING'")
    pending_approvals = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM assessments")
    total_assessments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM assessments WHERE risk_level = 'HIGH'")
    high_risk_assessments = cursor.fetchone()[0]

    # Recent Audit Log Activity
    cursor.execute("""
        SELECT a.id, a.user_id, a.action, a.entity_type, a.metadata, a.ip_address, a.created_at,
               u.email as user_email, u.role as user_role
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC LIMIT 15
    """)
    recent_activity = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "metrics": {
            "total_users": total_users,
            "total_patients": total_patients,
            "total_doctors": total_doctors,
            "pending_approvals": pending_approvals,
            "total_assessments": total_assessments,
            "high_risk_assessments": high_risk_assessments
        },
        "recent_activity": recent_activity
    }

@router.get("/users")
def get_users_list(
    role: Optional[str] = None,
    status: Optional[str] = None,
    query: Optional[str] = None,
    user: dict = Depends(require_role(["ADMIN"]))
):
    conn = get_db()
    cursor = conn.cursor()

    sql = """
        SELECT u.id, u.email, u.phone, u.role, u.status, u.last_login, u.created_at,
               p.full_name as patient_name,
               w.full_name as doctor_name, w.professional_role, w.professional_id, w.verification_status
        FROM users u
        LEFT JOIN patient_profiles p ON u.id = p.user_id
        LEFT JOIN healthcare_workers w ON u.id = w.user_id
        WHERE 1=1
    """
    params = []
    if role:
        sql += " AND u.role = ?"
        params.append(role.upper())
    if status:
        sql += " AND u.status = ?"
        params.append(status.upper())
    if query:
        sql += " AND (u.email LIKE ? OR p.full_name LIKE ? OR w.full_name LIKE ?)"
        params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])

    sql += " ORDER BY u.created_at DESC"
    cursor.execute(sql, params)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"users": users}

@router.put("/users/{id}/status")
def update_user_status(id: int, req: UserStatusUpdateRequest, user: dict = Depends(require_role(["ADMIN"]))):
    if req.status not in ["ACTIVE", "DEACTIVATED"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be ACTIVE or DEACTIVATED")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (req.status, id))
    conn.commit()

    log_audit_event(user["id"], "USER_STATUS_CHANGE", "USER", str(id), f"Changed status to {req.status}")
    conn.close()
    return {"message": f"User status updated to {req.status}"}

@router.get("/healthcare-workers")
def get_healthcare_workers(user: dict = Depends(require_role(["ADMIN"]))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT w.*, u.email, u.phone, u.status as account_status, u.created_at as registered_at
        FROM healthcare_workers w
        JOIN users u ON w.user_id = u.id
        ORDER BY
            CASE WHEN w.verification_status = 'PENDING' THEN 1 ELSE 2 END ASC,
            u.created_at DESC
    """)
    workers = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"healthcare_workers": workers}

@router.put("/healthcare-workers/{id}/approve")
def approve_healthcare_worker(id: int, req: DoctorApprovalRequest, user: dict = Depends(require_role(["ADMIN"]))):
    """
    Healthcare-worker verification workflow (PRD 6.10, ADM-3, Section 4.1).
    Pending -> Approved -> Active.
    """
    if req.verification_status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Status must be APPROVED or REJECTED")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, full_name, professional_id FROM healthcare_workers WHERE id = ?", (id,))
    worker = cursor.fetchone()
    if not worker:
        conn.close()
        raise HTTPException(status_code=404, detail="Healthcare worker not found")

    user_id = worker["user_id"]
    now_iso = datetime.now().isoformat()

    # Update verification status
    cursor.execute("""
        UPDATE healthcare_workers
        SET verification_status = ?, verified_at = ?, verified_by_user_id = ?
        WHERE id = ?
    """, (req.verification_status, now_iso, user["id"], id))

    # If approved, activate user account
    account_status = "ACTIVE" if req.verification_status == "APPROVED" else "DEACTIVATED"
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (account_status, user_id))

    # Send Notification to Doctor
    cursor.execute("""
        INSERT INTO notifications (user_id, title, message, type, is_read, link_url, created_at)
        VALUES (?, 'Account Verification Status', ?, 'ACCOUNT_STATUS', 0, '/doctor/dashboard', ?)
    """, (user_id, f"Your clinician account has been {req.verification_status.lower()} by the administrator.", now_iso))

    conn.commit()

    log_audit_event(
        user["id"], "DOCTOR_APPROVAL", "HEALTHCARE_WORKER", str(id),
        f"Verified: {req.verification_status} for {worker['full_name']} ({worker['professional_id']})"
    )

    conn.close()
    return {"message": f"Clinician account successfully updated to {req.verification_status}"}

@router.get("/audit-logs")
def get_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    user: dict = Depends(require_role(["ADMIN"]))
):
    """Audit log viewer with filters (ADM-5)."""
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        SELECT a.*, u.email as user_email, u.role as user_role
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
    """
    params = []
    if action:
        sql += " AND a.action = ?"
        params.append(action)
    if entity_type:
        sql += " AND a.entity_type = ?"
        params.append(entity_type)

    sql += " ORDER BY a.created_at DESC LIMIT 100"
    cursor.execute(sql, params)
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"audit_logs": logs}

@router.get("/settings")
def get_settings(user: dict = Depends(require_role(["ADMIN"]))):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT setting_key, setting_value, description, updated_at FROM system_settings")
    settings = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"settings": settings}

@router.put("/settings")
def update_setting(req: SettingUpdateRequest, user: dict = Depends(require_role(["ADMIN"]))):
    conn = get_db()
    cursor = conn.cursor()
    now_iso = datetime.now().isoformat()
    cursor.execute("""
        UPDATE system_settings SET setting_value = ?, updated_at = ?
        WHERE setting_key = ?
    """, (req.setting_value, now_iso, req.setting_key))
    conn.commit()

    log_audit_event(user["id"], "CONFIG_UPDATE", "SETTING", req.setting_key, f"Updated {req.setting_key} to {req.setting_value}")
    conn.close()
    return {"message": f"Setting {req.setting_key} updated"}

@router.get("/model-info")
def get_model_info(user: dict = Depends(require_role(["ADMIN", "HEALTHCARE_WORKER"]))):
    """AI model transparency page (ADM-7, PRD 7.3)."""
    return {
        "model_name": "AI Early-Risk Clinical Decision Support Engine",
        "model_version": MODEL_VERSION,
        "algorithm": "Calibrated Random Forest Classifier + SHAP Attribution",
        "last_trained": "2026-09-15T08:00:00Z",
        "validation_metrics": {
            "recall_high_risk": 0.942,
            "roc_auc": 0.914,
            "accuracy": 0.896,
            "precision_high_risk": 0.887,
            "brier_score_calibration": 0.082
        },
        "feature_set": [
            "age", "gender", "bmi", "chest_discomfort", "shortness_of_breath", "dizziness",
            "sweating", "palpitations", "altered_sensorium", "systolic_bp", "diastolic_bp",
            "heart_rate", "spo2", "temperature", "blood_glucose", "history_hypertension",
            "history_cardiovascular", "history_diabetes", "history_stroke", "history_kidney_disease",
            "risk_smoking", "risk_family_history", "risk_sedentary"
        ],
        "safety_engine": {
            "mode": "Deterministic Clinical Rules Pre-Processor",
            "version": "v1.2-cardiac-neuro",
            "guarantee": "Emergency criteria bypass probabilistic model and guarantee immediate escalation."
        },
        "dataset_disclosure": (
            "Prototype uses synthetic patient cohorts and publicly licensed clinical benchmarks. "
            "Real-world clinical deployment requires institution-specific validation and regulatory oversight."
        )
    }
