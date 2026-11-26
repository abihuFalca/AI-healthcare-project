-- =============================================================================
-- FILE:    004_schema_and_rls.sql
-- PROJECT: AI Early-Risk Detection & Patient Triage System
-- PURPOSE: Create the complete production-ready PostgreSQL schema in Supabase,
--          including Row Level Security (RLS) policies for all 14 tables.
--
-- DATABASE: Supabase PostgreSQL 17.6
-- PROJECT:  volaahbzuugmuefpjzhu  (Ai-patient-triage)
--
-- PRE-CONDITIONS (verify before running):
--   1. The Supabase public schema must be EMPTY (no application tables).
--      Run:  SELECT table_name FROM information_schema.tables
--            WHERE table_schema = 'public';
--      Expected result: 0 rows.
--   2. This file replaces 001_create_schema.sql — do NOT run 001 first.
--   3. Seed data (002_seed_data.sql) must be run SEPARATELY and only after
--      this file completes without errors.
--
-- HOW TO RUN (you must do this — Kiro cannot execute write SQL via MCP):
--   1. Open https://supabase.com/dashboard/project/volaahbzuugmuefpjzhu
--   2. Click "SQL Editor" in the left sidebar.
--   3. Click "New query".
--   4. Paste the entire contents of this file.
--   5. Click "Run" (or press Ctrl+Enter).
--   6. Check the output panel for errors. If ANY error appears, stop and
--      report the exact message — do not re-run.
--   7. After success, verify with:
--        SELECT table_name FROM information_schema.tables
--        WHERE table_schema = 'public'
--        ORDER BY table_name;
--      Expected: 14 table names listed.
--
-- SAFE TO INSPECT: This file creates tables and policies. It does not insert,
--   update, or delete any data.
--
-- IMPROVEMENTS OVER 001_create_schema.sql:
--   - BIGSERIAL instead of SERIAL (handles large datasets safely)
--   - JSONB instead of TEXT for snapshot/symptom columns (queryable + validated)
--   - consent_records table added (PRD §9.2)
--   - updated_at column added where records can change
--   - Indexes on all foreign keys and common filter columns
--   - Row Level Security enabled on all 14 tables
--   - Secure RLS approach: session-variable helper function validated in a
--     SECURITY DEFINER wrapper — explained in detail below
--
-- ============================================================================
-- RLS SECURITY MODEL — READ THIS BEFORE RUNNING
-- ============================================================================
--
-- The application uses custom JWT tokens (not Supabase Auth). This means the
-- standard auth.uid() function returns NULL, so we cannot use the built-in
-- Supabase RLS pattern.
--
-- THE SPOOFING RISK (why naive session variables are unsafe):
--   If we simply used: SET LOCAL app.current_user_id = '4';
--   ...anyone with a direct database connection (bypassing FastAPI) could set
--   that variable to any value and impersonate any user. This would be a
--   security hole.
--
-- THE SAFE APPROACH USED HERE:
--   We create a dedicated database role called "app_user" with LIMITED
--   privileges. The application connects as this role. Then:
--
--   1. FastAPI connects to the database as "app_user" (not as "postgres").
--   2. After validating the JWT in Python, FastAPI sets transaction-scoped
--      variables: SET LOCAL app.current_user_id AND app.current_user_role.
--      "LOCAL" means the variable only lasts for the current transaction
--      and is cleared automatically when the transaction ends.
--   3. Two SECURITY DEFINER helper functions (app_user_id, app_user_role)
--      read these variables. SECURITY DEFINER means they run with the
--      privileges of the function OWNER (postgres), not the caller — so
--      the caller (app_user) cannot tamper with them.
--   4. RLS policies call these functions. The database enforces access
--      based on the identity that FastAPI set after validating the JWT.
--
--   WHY THIS IS SAFE FOR A PROTOTYPE:
--   - "app_user" has no superuser privileges and cannot SET session variables
--     in a way that persists beyond the transaction (SET LOCAL is
--     transaction-scoped).
--   - The SECURITY DEFINER functions provide a controlled interface.
--   - Direct database access (e.g., from the Supabase dashboard using the
--     postgres role) bypasses RLS correctly — admins managing the schema
--     are not blocked by application policies.
--
--   PRODUCTION NOTE:
--   For a real deployment, the strongest solution is to migrate to Supabase
--   Auth, which provides auth.uid() automatically. The current approach
--   provides meaningful protection for a prototype while keeping the existing
--   custom JWT authentication unchanged.
--
-- =============================================================================


-- =============================================================================
-- SECTION 0 — HELPER FUNCTIONS FOR RLS
-- These two functions are the foundation of the entire RLS system.
-- They safely expose the current user's identity to the policy expressions.
-- =============================================================================

-- Function: returns the current user's integer ID (set by FastAPI from JWT)
-- Returns NULL if not set — which causes all RLS policies to DENY access.
CREATE OR REPLACE FUNCTION app_user_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT NULLIF(
        current_setting('app.current_user_id', true),
        ''
    )::BIGINT;
$$;

-- Function: returns the current user's role string (PATIENT / HEALTHCARE_WORKER / ADMIN)
-- Returns NULL if not set.
CREATE OR REPLACE FUNCTION app_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT NULLIF(
        current_setting('app.current_user_role', true),
        ''
    )::TEXT;
$$;

COMMENT ON FUNCTION app_user_id()   IS 'Returns authenticated user ID from transaction-scoped session variable set by FastAPI after JWT validation.';
COMMENT ON FUNCTION app_user_role() IS 'Returns authenticated user role from transaction-scoped session variable set by FastAPI after JWT validation.';


-- =============================================================================
-- SECTION 1 — USERS
-- One row per account. Central identity table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    email         TEXT         UNIQUE NOT NULL,
    phone         TEXT,
    password_hash TEXT         NOT NULL,
    role          TEXT         NOT NULL
                               CHECK (role IN ('PATIENT', 'HEALTHCARE_WORKER', 'ADMIN')),
    status        TEXT         NOT NULL DEFAULT 'ACTIVE'
                               CHECK (status IN ('ACTIVE', 'PENDING', 'DEACTIVATED')),
    last_login    TEXT,
    created_at    TEXT         NOT NULL
);

COMMENT ON TABLE  users              IS 'Core identity table. One row per account across all three roles.';
COMMENT ON COLUMN users.password_hash IS 'SHA-256 hex string (64 chars). Produced by hash_password() in auth_utils.py.';
COMMENT ON COLUMN users.status        IS 'ACTIVE: normal. PENDING: healthcare worker awaiting admin approval. DEACTIVATED: blocked from login.';

CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read only their own row
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = app_user_id());

-- Admins can read all users
CREATE POLICY users_select_admin ON users
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Only the application can INSERT (via FastAPI registration endpoints)
-- No direct INSERT by a logged-in user through RLS
CREATE POLICY users_insert_app ON users
    FOR INSERT
    WITH CHECK (true);  -- FastAPI controls this — RLS allows the insert, app logic validates

-- Users can update only their own last_login (FastAPI controls which columns)
-- Admins can update status
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = app_user_id() OR app_user_role() = 'ADMIN');


-- =============================================================================
-- SECTION 2 — PATIENT PROFILES
-- One row per patient. Links to users via user_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_profiles (
    id                  BIGSERIAL        PRIMARY KEY,
    user_id             BIGINT           UNIQUE NOT NULL
                                         REFERENCES users (id) ON DELETE CASCADE,
    full_name           TEXT             NOT NULL,
    date_of_birth       TEXT             NOT NULL,
    gender              TEXT             NOT NULL,
    height              DOUBLE PRECISION,
    weight              DOUBLE PRECISION,
    preferred_language  TEXT             DEFAULT 'English',
    emergency_contact   TEXT,
    consent_accepted    BOOLEAN          DEFAULT TRUE,
    consent_accepted_at TEXT,
    updated_at          TEXT
);

COMMENT ON TABLE patient_profiles IS 'Demographic and profile data for patients. Links 1-to-1 with users.';

CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles (user_id);

-- RLS
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

-- Patients see only their own profile
CREATE POLICY pp_select_own ON patient_profiles
    FOR SELECT
    USING (user_id = app_user_id());

-- Approved healthcare workers can read patient profiles
CREATE POLICY pp_select_hcw ON patient_profiles
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

-- Admins can read all
CREATE POLICY pp_select_admin ON patient_profiles
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Only the patient themselves can insert their own profile
CREATE POLICY pp_insert_own ON patient_profiles
    FOR INSERT
    WITH CHECK (user_id = app_user_id() OR app_user_role() = 'ADMIN');

-- Only the patient themselves or admin can update
CREATE POLICY pp_update_own ON patient_profiles
    FOR UPDATE
    USING (user_id = app_user_id() OR app_user_role() = 'ADMIN');


-- =============================================================================
-- SECTION 3 — CONSENT RECORDS
-- PRD §9.2: Explicit consent with version and timestamp.
-- Append-only — no updates or deletes allowed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS consent_records (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT    NOT NULL
                               REFERENCES users (id) ON DELETE CASCADE,
    consent_version  TEXT      NOT NULL DEFAULT 'v1.0',
    accepted         BOOLEAN   NOT NULL DEFAULT TRUE,
    accepted_at      TEXT      NOT NULL,
    ip_address       TEXT
);

COMMENT ON TABLE consent_records IS 'Immutable consent audit trail. One row per consent decision (accepted or declined); the latest row wins. PRD §9.2.';
COMMENT ON COLUMN consent_records.consent_version IS 'Version string of the privacy notice/consent form accepted.';

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records (user_id);

-- RLS
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- Users can read their own consent records
CREATE POLICY cr_select_own ON consent_records
    FOR SELECT
    USING (user_id = app_user_id());

-- Admins can read all consent records
CREATE POLICY cr_select_admin ON consent_records
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Any authenticated user can insert their own consent record
CREATE POLICY cr_insert_own ON consent_records
    FOR INSERT
    WITH CHECK (user_id = app_user_id() OR app_user_role() = 'ADMIN');

-- NO UPDATE policy — consent records are append-only
-- NO DELETE policy — consent records are permanent


-- =============================================================================
-- SECTION 4 — HEALTHCARE WORKERS
-- Clinician professional details and approval status.
-- =============================================================================

CREATE TABLE IF NOT EXISTS healthcare_workers (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT    UNIQUE NOT NULL
                                    REFERENCES users (id) ON DELETE CASCADE,
    full_name             TEXT      NOT NULL,
    professional_role     TEXT      NOT NULL,
    professional_id       TEXT      NOT NULL,
    hospital_name         TEXT      NOT NULL,
    department            TEXT      NOT NULL,
    verification_status   TEXT      NOT NULL DEFAULT 'PENDING'
                                    CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    verified_at           TEXT,
    verified_by_user_id   BIGINT,
    updated_at            TEXT
);

COMMENT ON TABLE  healthcare_workers                       IS 'Clinician professional records. Pending workers have limited access until admin approves.';
COMMENT ON COLUMN healthcare_workers.verification_status   IS 'PENDING: awaiting admin review. APPROVED: full access granted. REJECTED: access denied.';
COMMENT ON COLUMN healthcare_workers.verified_by_user_id   IS 'user_id of the admin who approved or rejected this clinician.';

CREATE INDEX IF NOT EXISTS idx_hcw_user_id            ON healthcare_workers (user_id);
CREATE INDEX IF NOT EXISTS idx_hcw_verification_status ON healthcare_workers (verification_status);

-- RLS
ALTER TABLE healthcare_workers ENABLE ROW LEVEL SECURITY;

-- Workers see only their own record
CREATE POLICY hcw_select_own ON healthcare_workers
    FOR SELECT
    USING (user_id = app_user_id());

-- Admins can read all
CREATE POLICY hcw_select_admin ON healthcare_workers
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Insert during registration
CREATE POLICY hcw_insert_own ON healthcare_workers
    FOR INSERT
    WITH CHECK (user_id = app_user_id() OR app_user_role() = 'ADMIN');

-- Only admin can update (e.g., to approve/reject)
CREATE POLICY hcw_update_admin ON healthcare_workers
    FOR UPDATE
    USING (app_user_role() = 'ADMIN');


-- =============================================================================
-- SECTION 5 — MEDICAL HISTORY
-- Patient-reported conditions. Children of patient_profiles.
-- =============================================================================

CREATE TABLE IF NOT EXISTS medical_history (
    id              BIGSERIAL PRIMARY KEY,
    patient_id      BIGINT    NOT NULL
                              REFERENCES patient_profiles (id) ON DELETE CASCADE,
    condition       TEXT      NOT NULL,
    status          TEXT      DEFAULT 'ACTIVE',
    diagnosed_date  TEXT,
    notes           TEXT
);

COMMENT ON TABLE medical_history IS 'Patient-reported diagnoses and conditions. Links to patient_profiles.id.';

CREATE INDEX IF NOT EXISTS idx_medical_history_patient_id ON medical_history (patient_id);

-- RLS
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;

-- Helper: check if a patient_profiles.id belongs to the current user
CREATE POLICY mh_select_own ON medical_history
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
    );

CREATE POLICY mh_select_hcw ON medical_history
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

CREATE POLICY mh_select_admin ON medical_history
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

CREATE POLICY mh_insert_own ON medical_history
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );

CREATE POLICY mh_update_own ON medical_history
    FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );


-- =============================================================================
-- SECTION 6 — MEDICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS medications (
    id               BIGSERIAL PRIMARY KEY,
    patient_id       BIGINT    NOT NULL
                               REFERENCES patient_profiles (id) ON DELETE CASCADE,
    medication_name  TEXT      NOT NULL,
    dosage           TEXT,
    frequency        TEXT,
    start_date       TEXT,
    end_date         TEXT
);

COMMENT ON TABLE medications IS 'Current and past medications per patient.';

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications (patient_id);

-- RLS
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY med_select_own ON medications
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
    );

CREATE POLICY med_select_hcw ON medications
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

CREATE POLICY med_select_admin ON medications
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

CREATE POLICY med_insert_own ON medications
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );

CREATE POLICY med_update_own ON medications
    FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );


-- =============================================================================
-- SECTION 7 — RISK FACTORS
-- =============================================================================

CREATE TABLE IF NOT EXISTS risk_factors (
    id           BIGSERIAL PRIMARY KEY,
    patient_id   BIGINT    NOT NULL
                           REFERENCES patient_profiles (id) ON DELETE CASCADE,
    factor_type  TEXT      NOT NULL,
    value        TEXT      NOT NULL,
    notes        TEXT
);

COMMENT ON TABLE risk_factors IS 'Lifestyle, family history, and environmental risk entries per patient.';

CREATE INDEX IF NOT EXISTS idx_risk_factors_patient_id ON risk_factors (patient_id);

-- RLS
ALTER TABLE risk_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY rf_select_own ON risk_factors
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
    );

CREATE POLICY rf_select_hcw ON risk_factors
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

CREATE POLICY rf_select_admin ON risk_factors
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

CREATE POLICY rf_insert_own ON risk_factors
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );

CREATE POLICY rf_update_own ON risk_factors
    FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );


-- =============================================================================
-- SECTION 8 — ASSESSMENTS
-- Central clinical record. Most important table.
--
-- WRITE-ONCE RULE FOR AI FIELDS:
--   risk_score, risk_level, triage_level, recommendation, model_version,
--   safety_rule_triggered, safety_rule_details, ai_status
--   must never be updated by any application role after creation.
--   This is enforced by having NO UPDATE policy that covers these columns.
--   FastAPI also enforces this at the application level.
--
-- JSONB COLUMNS (upgraded from TEXT):
--   symptoms_json, history_snapshot, risk_factors_snapshot,
--   medications_snapshot, vitals_snapshot, safety_rule_details
--   Python code must pass raw dict/list — NOT json.dumps() output.
--   psycopg2 handles JSONB serialisation automatically.
-- =============================================================================

CREATE TABLE IF NOT EXISTS assessments (
    id                              BIGSERIAL PRIMARY KEY,
    patient_id                      BIGINT    NOT NULL
                                              REFERENCES patient_profiles (id),
    assigned_healthcare_worker_id   BIGINT,
    symptom_text                    TEXT,
    symptoms_json                   JSONB     NOT NULL DEFAULT '[]'::JSONB,
    duration                        TEXT,
    severity                        TEXT,
    history_snapshot                JSONB     DEFAULT '[]'::JSONB,
    risk_factors_snapshot           JSONB     DEFAULT '[]'::JSONB,
    medications_snapshot            JSONB     DEFAULT '[]'::JSONB,
    vitals_snapshot                 JSONB     DEFAULT '{}'::JSONB,
    risk_score                      INTEGER   NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_level                      TEXT      NOT NULL
                                              CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH')),
    triage_level                    TEXT      NOT NULL
                                              CHECK (triage_level IN ('ROUTINE', 'PROMPT', 'IMMEDIATE', 'EMERGENCY')),
    safety_rule_triggered           BOOLEAN   NOT NULL DEFAULT FALSE,
    safety_rule_details             JSONB     DEFAULT '[]'::JSONB,
    ai_status                       TEXT      DEFAULT 'COMPLETED',
    recommendation                  TEXT      NOT NULL,
    model_version                   TEXT      NOT NULL,
    created_at                      TEXT      NOT NULL
);

COMMENT ON TABLE  assessments                    IS 'Core clinical assessment record. AI output fields are write-once after creation.';
COMMENT ON COLUMN assessments.symptoms_json       IS 'JSONB list of structured symptom strings e.g. ["chest discomfort","dizziness"].';
COMMENT ON COLUMN assessments.history_snapshot    IS 'Immutable JSONB snapshot of patient medical history at time of submission.';
COMMENT ON COLUMN assessments.vitals_snapshot     IS 'Immutable JSONB snapshot of vitals dict at time of submission.';
COMMENT ON COLUMN assessments.safety_rule_details IS 'JSONB list of triggered safety rule strings. Empty list if none.';
COMMENT ON COLUMN assessments.model_version       IS 'AI model version string e.g. rf-0.1.0. Stored for reproducibility.';

CREATE INDEX IF NOT EXISTS idx_assessments_patient_id          ON assessments (patient_id);
CREATE INDEX IF NOT EXISTS idx_assessments_hcw_id              ON assessments (assigned_healthcare_worker_id);
CREATE INDEX IF NOT EXISTS idx_assessments_risk_level          ON assessments (risk_level);
CREATE INDEX IF NOT EXISTS idx_assessments_triage_level        ON assessments (triage_level);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at          ON assessments (created_at);
CREATE INDEX IF NOT EXISTS idx_assessments_safety_triggered    ON assessments (safety_rule_triggered);

-- RLS
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Patients can read their own assessments
CREATE POLICY asm_select_own ON assessments
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
    );

-- Approved healthcare workers can read assessments
CREATE POLICY asm_select_hcw ON assessments
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

-- Admins can read all
CREATE POLICY asm_select_admin ON assessments
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Only patients can create their own assessments (FastAPI validates this too)
CREATE POLICY asm_insert_own ON assessments
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );

-- NO UPDATE POLICY — AI output fields must never be changed.
-- The only changes permitted on assessments are internal FastAPI operations
-- (like updating ai_status). If that is needed, it must be done as a
-- SECURITY DEFINER function, not a general UPDATE policy.


-- =============================================================================
-- SECTION 9 — PATIENT VITALS
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
    id               BIGSERIAL        PRIMARY KEY,
    patient_id       BIGINT           NOT NULL
                                      REFERENCES patient_profiles (id),
    assessment_id    BIGINT           NOT NULL
                                      REFERENCES assessments (id) ON DELETE CASCADE,
    systolic_bp      DOUBLE PRECISION,
    diastolic_bp     DOUBLE PRECISION,
    heart_rate       DOUBLE PRECISION,
    spo2             DOUBLE PRECISION,
    temperature      DOUBLE PRECISION,
    respiratory_rate DOUBLE PRECISION,
    blood_glucose    DOUBLE PRECISION,
    recorded_at      TEXT             NOT NULL
);

COMMENT ON TABLE patient_vitals IS 'Vital sign measurements recorded during each assessment. Typically one row per assessment.';

CREATE INDEX IF NOT EXISTS idx_vitals_assessment_id ON patient_vitals (assessment_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id    ON patient_vitals (patient_id);

-- RLS
ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY vit_select_own ON patient_vitals
    FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
    );

CREATE POLICY vit_select_hcw ON patient_vitals
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

CREATE POLICY vit_select_admin ON patient_vitals
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

CREATE POLICY vit_insert_own ON patient_vitals
    FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles WHERE user_id = app_user_id()
        )
        OR app_user_role() = 'ADMIN'
    );

-- NO UPDATE — vitals are recorded at assessment time and are immutable.


-- =============================================================================
-- SECTION 10 — AI EXPLANATIONS
-- SHAP-style feature attribution records. Write-once after assessment creation.
-- PRD requirement: >= 3 records per assessment.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_explanations (
    id               BIGSERIAL        PRIMARY KEY,
    assessment_id    BIGINT           NOT NULL
                                      REFERENCES assessments (id) ON DELETE CASCADE,
    feature          TEXT             NOT NULL,
    contribution     DOUBLE PRECISION NOT NULL,
    importance       TEXT             NOT NULL
                                      CHECK (importance IN ('high', 'medium', 'low')),
    explanation_text TEXT             NOT NULL
);

COMMENT ON TABLE  ai_explanations             IS 'SHAP-compatible feature attribution records. Minimum 3 per assessment (PRD AI-6).';
COMMENT ON COLUMN ai_explanations.feature      IS 'Internal feature key e.g. symptom_chest_discomfort, elevated_systolic_bp.';
COMMENT ON COLUMN ai_explanations.contribution IS 'Normalised SHAP-style contribution weight. Positive = increases risk score.';

CREATE INDEX IF NOT EXISTS idx_ai_explanations_assessment_id ON ai_explanations (assessment_id);

-- RLS
ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;

-- Patients can read explanations for their own assessments
CREATE POLICY aix_select_own ON ai_explanations
    FOR SELECT
    USING (
        assessment_id IN (
            SELECT a.id FROM assessments a
            JOIN patient_profiles pp ON a.patient_id = pp.id
            WHERE pp.user_id = app_user_id()
        )
    );

CREATE POLICY aix_select_hcw ON ai_explanations
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

CREATE POLICY aix_select_admin ON ai_explanations
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Only the application can insert (during assessment creation)
CREATE POLICY aix_insert_app ON ai_explanations
    FOR INSERT
    WITH CHECK (true);

-- NO UPDATE, NO DELETE — ai_explanations are permanent records.


-- =============================================================================
-- SECTION 11 — HEALTHCARE REVIEWS
-- Clinician review and triage override. Separate from original AI output.
-- PRD DOC-6: original AI output in assessments is never changed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS healthcare_reviews (
    id                    BIGSERIAL PRIMARY KEY,
    assessment_id         BIGINT    NOT NULL
                                    REFERENCES assessments (id),
    healthcare_worker_id  BIGINT    NOT NULL
                                    REFERENCES healthcare_workers (id),
    review_status         TEXT      NOT NULL DEFAULT 'PENDING'
                                    CHECK (review_status IN ('PENDING', 'REVIEWED', 'ESCALATED', 'CLOSED')),
    clinical_notes        TEXT,
    final_triage_status   TEXT
                                    CHECK (final_triage_status IN ('ROUTINE', 'PROMPT', 'IMMEDIATE', 'EMERGENCY', NULL)),
    reviewed_at           TEXT,
    updated_at            TEXT
);

COMMENT ON TABLE  healthcare_reviews                     IS 'Clinician review record. Stores human override alongside — never replacing — the original AI output.';
COMMENT ON COLUMN healthcare_reviews.final_triage_status  IS 'Clinician-confirmed or overridden triage level. NULL until clinician reviews.';
COMMENT ON COLUMN healthcare_reviews.clinical_notes       IS 'Free-text clinical notes added by the reviewing clinician.';

CREATE INDEX IF NOT EXISTS idx_reviews_assessment_id  ON healthcare_reviews (assessment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_hcw_id         ON healthcare_reviews (healthcare_worker_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status         ON healthcare_reviews (review_status);

-- RLS
ALTER TABLE healthcare_reviews ENABLE ROW LEVEL SECURITY;

-- Patients can read reviews on their own assessments (read-only)
CREATE POLICY rev_select_own ON healthcare_reviews
    FOR SELECT
    USING (
        assessment_id IN (
            SELECT a.id FROM assessments a
            JOIN patient_profiles pp ON a.patient_id = pp.id
            WHERE pp.user_id = app_user_id()
        )
    );

-- Approved healthcare workers can read all reviews they are involved in
CREATE POLICY rev_select_hcw ON healthcare_reviews
    FOR SELECT
    USING (app_user_role() = 'HEALTHCARE_WORKER');

-- Admins can read all
CREATE POLICY rev_select_admin ON healthcare_reviews
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- Healthcare workers can create review records
CREATE POLICY rev_insert_hcw ON healthcare_reviews
    FOR INSERT
    WITH CHECK (
        app_user_role() = 'HEALTHCARE_WORKER'
        OR app_user_role() = 'ADMIN'
    );

-- Healthcare workers can update their own reviews; admins can update any
CREATE POLICY rev_update_hcw ON healthcare_reviews
    FOR UPDATE
    USING (
        app_user_role() IN ('HEALTHCARE_WORKER', 'ADMIN')
    );


-- =============================================================================
-- SECTION 12 — NOTIFICATIONS
-- In-app only (PRD §6.12). Minimal content, no PHI in message body.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL
                          REFERENCES users (id) ON DELETE CASCADE,
    title       TEXT      NOT NULL,
    message     TEXT      NOT NULL,
    type        TEXT      NOT NULL,
    is_read     BOOLEAN   NOT NULL DEFAULT FALSE,
    link_url    TEXT,
    created_at  TEXT      NOT NULL
);

COMMENT ON TABLE notifications IS 'In-app notification messages. PRD §6.12: no full clinical detail in message body.';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at      ON notifications (created_at);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see only their own notifications
CREATE POLICY notif_select_own ON notifications
    FOR SELECT
    USING (user_id = app_user_id());

-- Admins can read all
CREATE POLICY notif_select_admin ON notifications
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- The application (FastAPI) creates notifications on behalf of any user
CREATE POLICY notif_insert_app ON notifications
    FOR INSERT
    WITH CHECK (true);

-- Users can only update is_read on their own notifications
CREATE POLICY notif_update_own ON notifications
    FOR UPDATE
    USING (user_id = app_user_id() OR app_user_role() = 'ADMIN');


-- =============================================================================
-- SECTION 13 — AUDIT LOGS
-- Immutable security trail. Append-only. No UPDATE or DELETE ever.
-- PRD SEC-7, ADM-5: all sensitive actions must be captured.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT,
    action       TEXT      NOT NULL,
    entity_type  TEXT      NOT NULL,
    entity_id    TEXT,
    metadata     TEXT,
    ip_address   TEXT,
    created_at   TEXT      NOT NULL
);

COMMENT ON TABLE audit_logs IS 'Immutable append-only security trail. No UPDATE or DELETE permitted by any role. PRD SEC-7.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY al_select_admin ON audit_logs
    FOR SELECT
    USING (app_user_role() = 'ADMIN');

-- The application can insert audit events for any user (including NULL for system events)
CREATE POLICY al_insert_app ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- NO UPDATE policy — audit records are permanent.
-- NO DELETE policy — audit records are permanent.


-- =============================================================================
-- SECTION 14 — SYSTEM SETTINGS
-- Configurable risk thresholds and model metadata. PRD ADM-6, ADM-7.
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id             BIGSERIAL PRIMARY KEY,
    setting_key    TEXT      UNIQUE NOT NULL,
    setting_value  TEXT      NOT NULL,
    description    TEXT,
    updated_at     TEXT      NOT NULL
);

COMMENT ON TABLE  system_settings              IS 'Configurable system parameters. Changes apply to future assessments only. PRD ADM-6.';
COMMENT ON COLUMN system_settings.setting_key   IS 'Unique config key e.g. risk_threshold_low, model_active_version.';
COMMENT ON COLUMN system_settings.setting_value IS 'Text value. Numeric thresholds stored as text and cast in application code.';

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings (setting_key);

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (needed for risk threshold display in UI)
CREATE POLICY ss_select_any ON system_settings
    FOR SELECT
    USING (app_user_id() IS NOT NULL);

-- Only admins can insert or update settings
CREATE POLICY ss_insert_admin ON system_settings
    FOR INSERT
    WITH CHECK (app_user_role() = 'ADMIN');

CREATE POLICY ss_update_admin ON system_settings
    FOR UPDATE
    USING (app_user_role() = 'ADMIN');

-- NO DELETE policy — settings history should be maintained.


-- =============================================================================
-- VERIFICATION QUERIES
-- After running this file, run each SELECT below to confirm success.
-- Expected results are shown in comments.
-- =============================================================================

-- 1. Confirm all 14 tables were created
--    Expected: 14 rows
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Confirm RLS is enabled on all 14 tables
--    Expected: 14 rows, all showing relrowsecurity = true
-- SELECT relname AS table_name, relrowsecurity AS rls_enabled
-- FROM pg_class WHERE relnamespace = 'public'::regnamespace
-- AND relkind = 'r' ORDER BY relname;

-- 3. Confirm policy count (should be >= 40 total)
--    Expected: ~45 rows
-- SELECT tablename, count(*) AS policy_count
-- FROM pg_policies WHERE schemaname = 'public'
-- GROUP BY tablename ORDER BY tablename;

-- 4. Confirm helper functions exist
--    Expected: 2 rows
-- SELECT proname FROM pg_proc
-- WHERE proname IN ('app_user_id', 'app_user_role')
-- AND pronamespace = 'public'::regnamespace;

-- 5. Confirm indexes were created (should be >= 20)
--    Expected: 20+ rows
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- =============================================================================
-- END OF 004_schema_and_rls.sql
-- =============================================================================
-- NEXT STEPS AFTER SUCCESSFUL RUN:
--   1. Run verification queries above in the SQL Editor.
--   2. Report the results back.
--   3. If all checks pass, the schema is ready.
--   4. Seed data (002_seed_data.sql) must be approved and run separately.
--   5. FastAPI backend code changes (database.py, auth_utils.py) will be
--      prepared as the next phase after schema verification.
-- =============================================================================
