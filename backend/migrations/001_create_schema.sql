-- =============================================================================
-- FILE: 001_create_schema.sql
-- PURPOSE: Create all 13 application tables in Supabase PostgreSQL.
--
-- HOW TO USE:
--   1. Open your Supabase project dashboard.
--   2. Go to: SQL Editor (left sidebar) → New Query.
--   3. Paste the entire contents of this file and click RUN.
--   4. Verify in Table Editor that all 13 tables were created.
--
-- SAFE TO RE-RUN: Every statement uses CREATE TABLE IF NOT EXISTS,
--   so running it twice will not cause errors or overwrite existing data.
--
-- TRANSLATION NOTES (SQLite → PostgreSQL):
--   - INTEGER PRIMARY KEY AUTOINCREMENT  →  SERIAL PRIMARY KEY
--   - INTEGER (used as boolean 0/1)      →  BOOLEAN
--   - TEXT (used for dates/timestamps)   →  TEXT  (kept as TEXT so the
--     existing Python code that writes ISO strings needs no changes)
--   - REAL                               →  DOUBLE PRECISION
--   - No changes to CHECK constraints,
--     foreign keys, or column names.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Table 1: users
-- One row per account. Roles: PATIENT, HEALTHCARE_WORKER, ADMIN.
-- Status: ACTIVE (normal), PENDING (new HCW awaiting approval), DEACTIVATED.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL
                    CHECK (role IN ('PATIENT', 'HEALTHCARE_WORKER', 'ADMIN')),
    status        TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'PENDING', 'DEACTIVATED')),
    last_login    TEXT,
    created_at    TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 2: patient_profiles
-- Demographics for each patient. Linked 1-to-1 with users via user_id.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_profiles (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER UNIQUE NOT NULL
                          REFERENCES users (id) ON DELETE CASCADE,
    full_name           TEXT NOT NULL,
    date_of_birth       TEXT NOT NULL,
    gender              TEXT NOT NULL,
    height              DOUBLE PRECISION,
    weight              DOUBLE PRECISION,
    preferred_language  TEXT DEFAULT 'English',
    emergency_contact   TEXT,
    consent_accepted    BOOLEAN DEFAULT TRUE,
    consent_accepted_at TEXT
);


-- -----------------------------------------------------------------------------
-- Table 3: healthcare_workers
-- Clinician identity and verification. Linked 1-to-1 with users via user_id.
-- verification_status: PENDING → APPROVED (or REJECTED) by an admin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS healthcare_workers (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER UNIQUE NOT NULL
                            REFERENCES users (id) ON DELETE CASCADE,
    full_name             TEXT NOT NULL,
    professional_role     TEXT NOT NULL,
    professional_id       TEXT NOT NULL,
    hospital_name         TEXT NOT NULL,
    department            TEXT NOT NULL,
    verification_status   TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (verification_status IN
                                   ('PENDING', 'APPROVED', 'REJECTED')),
    verified_at           TEXT,
    verified_by_user_id   INTEGER
);


-- -----------------------------------------------------------------------------
-- Table 4: medical_history
-- One row per diagnosed condition per patient.
-- patient_id references patient_profiles.id (NOT users.id).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_history (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL
                      REFERENCES patient_profiles (id) ON DELETE CASCADE,
    condition       TEXT NOT NULL,
    status          TEXT DEFAULT 'ACTIVE',
    diagnosed_date  TEXT,
    notes           TEXT
);


-- -----------------------------------------------------------------------------
-- Table 5: medications
-- Current or past medications per patient.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
    id               SERIAL PRIMARY KEY,
    patient_id       INTEGER NOT NULL
                       REFERENCES patient_profiles (id) ON DELETE CASCADE,
    medication_name  TEXT NOT NULL,
    dosage           TEXT,
    frequency        TEXT,
    start_date       TEXT,
    end_date         TEXT
);


-- -----------------------------------------------------------------------------
-- Table 6: risk_factors
-- Lifestyle and family risk entries per patient.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_factors (
    id           SERIAL PRIMARY KEY,
    patient_id   INTEGER NOT NULL
                   REFERENCES patient_profiles (id) ON DELETE CASCADE,
    factor_type  TEXT NOT NULL,
    value        TEXT NOT NULL,
    notes        TEXT
);


-- -----------------------------------------------------------------------------
-- Table 7: assessments
-- Central clinical record. One row per submitted assessment.
-- AI fields (risk_score, risk_level, triage_level, recommendation,
-- model_version) are write-once — no application role may UPDATE them.
-- JSON snapshot columns store TEXT (serialised JSON arrays/objects)
-- so the Python code needs no changes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessments (
    id                              SERIAL PRIMARY KEY,
    patient_id                      INTEGER NOT NULL
                                      REFERENCES patient_profiles (id),
    assigned_healthcare_worker_id   INTEGER,
    symptom_text                    TEXT,
    symptoms_json                   TEXT NOT NULL,
    duration                        TEXT,
    severity                        TEXT,
    history_snapshot                TEXT,
    risk_factors_snapshot           TEXT,
    medications_snapshot            TEXT,
    vitals_snapshot                 TEXT,
    risk_score                      INTEGER NOT NULL,
    risk_level                      TEXT NOT NULL
                                      CHECK (risk_level IN
                                             ('LOW', 'MODERATE', 'HIGH')),
    triage_level                    TEXT NOT NULL
                                      CHECK (triage_level IN
                                             ('ROUTINE', 'PROMPT',
                                              'IMMEDIATE', 'EMERGENCY')),
    safety_rule_triggered           BOOLEAN DEFAULT FALSE,
    safety_rule_details             TEXT,
    ai_status                       TEXT DEFAULT 'COMPLETED',
    recommendation                  TEXT NOT NULL,
    model_version                   TEXT NOT NULL,
    created_at                      TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 8: patient_vitals
-- Vital signs recorded during each assessment.
-- Typically one row per assessment, but schema allows multiple.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_vitals (
    id               SERIAL PRIMARY KEY,
    patient_id       INTEGER NOT NULL
                       REFERENCES patient_profiles (id),
    assessment_id    INTEGER NOT NULL
                       REFERENCES assessments (id) ON DELETE CASCADE,
    systolic_bp      DOUBLE PRECISION,
    diastolic_bp     DOUBLE PRECISION,
    heart_rate       DOUBLE PRECISION,
    spo2             DOUBLE PRECISION,
    temperature      DOUBLE PRECISION,
    respiratory_rate DOUBLE PRECISION,
    blood_glucose    DOUBLE PRECISION,
    recorded_at      TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 9: ai_explanations
-- SHAP-style factor attribution records per assessment.
-- PRD requirement: every prediction stores >= 3 contributing factors.
-- importance values: 'high', 'medium', 'low'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_explanations (
    id               SERIAL PRIMARY KEY,
    assessment_id    INTEGER NOT NULL
                       REFERENCES assessments (id) ON DELETE CASCADE,
    feature          TEXT NOT NULL,
    contribution     DOUBLE PRECISION NOT NULL,
    importance       TEXT NOT NULL
                       CHECK (importance IN ('high', 'medium', 'low')),
    explanation_text TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 10: healthcare_reviews
-- Clinician review record per assessment. The original AI output in
-- the assessments table is never modified; the clinician's decision
-- lives here as a separate record (PRD DOC-6).
-- review_status: PENDING → REVIEWED / ESCALATED / CLOSED.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS healthcare_reviews (
    id                    SERIAL PRIMARY KEY,
    assessment_id         INTEGER NOT NULL
                            REFERENCES assessments (id),
    healthcare_worker_id  INTEGER NOT NULL
                            REFERENCES healthcare_workers (id),
    review_status         TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (review_status IN
                                   ('PENDING', 'REVIEWED',
                                    'ESCALATED', 'CLOSED')),
    clinical_notes        TEXT,
    final_triage_status   TEXT,
    reviewed_at           TEXT
);


-- -----------------------------------------------------------------------------
-- Table 11: notifications
-- In-app messages per user. Minimal content only (PRD 6.12).
-- is_read: false = unread, true = read.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL
                  REFERENCES users (id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    type        TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    link_url    TEXT,
    created_at  TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 12: audit_logs
-- Immutable security trail. No application role may UPDATE or DELETE rows.
-- Captures: login, logout, failed login, registration, approvals,
-- assessment creation, record views, review actions, config changes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER,
    action       TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    TEXT,
    metadata     TEXT,
    ip_address   TEXT,
    created_at   TEXT NOT NULL
);


-- -----------------------------------------------------------------------------
-- Table 13: system_settings
-- Configurable risk thresholds and model metadata (PRD ADM-6, ADM-7).
-- Changes to this table apply to future assessments only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id             SERIAL PRIMARY KEY,
    setting_key    TEXT UNIQUE NOT NULL,
    setting_value  TEXT NOT NULL,
    description    TEXT,
    updated_at     TEXT NOT NULL
);


-- =============================================================================
-- END OF 001_create_schema.sql
-- Next step: run 002_seed_data.sql to import existing records.
-- =============================================================================
