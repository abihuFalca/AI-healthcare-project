-- =============================================================================
-- FILE: 003_set_sequences.sql
-- PURPOSE: Reset PostgreSQL auto-increment (SERIAL) sequences after data import.
--
-- WHY THIS IS NEEDED:
--   When 002_seed_data.sql inserted rows with explicit id values (1, 2, 3...),
--   PostgreSQL's internal ID counter was not updated automatically — it still
--   thinks the next available ID is 1.
--
--   Without this fix, the very first new record created after migration
--   (e.g. a new user registering) would fail with:
--     ERROR: duplicate key value violates unique constraint "users_pkey"
--
--   setval(sequence_name, max_id, true) tells PostgreSQL:
--     "The highest ID already used is max_id. Start the next auto-generated
--      ID from max_id + 1."
--   The third argument (true) means "this value has already been used",
--   so the NEXT generated ID will be max_id + 1.
--
-- HOW TO USE:
--   1. Make sure 002_seed_data.sql has already been run successfully.
--   2. Open Supabase → SQL Editor → New Query.
--   3. Paste the entire contents of this file and click RUN.
--   4. You should see 13 rows returned, each showing the new sequence value.
--
-- SAFE TO RE-RUN:
--   Running this file again after new records have been inserted is safe.
--   setval with the MAX(id) subquery will always set the counter to the
--   actual highest existing ID, whatever that is at the time.
-- =============================================================================


-- Table: users (highest imported id = 5, next new id will be 6)
SELECT setval(
    pg_get_serial_sequence('users', 'id'),
    (SELECT MAX(id) FROM users),
    true
);

-- Table: patient_profiles (highest imported id = 2, next new id will be 3)
SELECT setval(
    pg_get_serial_sequence('patient_profiles', 'id'),
    (SELECT MAX(id) FROM patient_profiles),
    true
);

-- Table: healthcare_workers (highest imported id = 2, next new id will be 3)
SELECT setval(
    pg_get_serial_sequence('healthcare_workers', 'id'),
    (SELECT MAX(id) FROM healthcare_workers),
    true
);

-- Table: medical_history (highest imported id = 2, next new id will be 3)
SELECT setval(
    pg_get_serial_sequence('medical_history', 'id'),
    (SELECT MAX(id) FROM medical_history),
    true
);

-- Table: medications (highest imported id = 1, next new id will be 2)
SELECT setval(
    pg_get_serial_sequence('medications', 'id'),
    (SELECT MAX(id) FROM medications),
    true
);

-- Table: risk_factors (highest imported id = 2, next new id will be 3)
SELECT setval(
    pg_get_serial_sequence('risk_factors', 'id'),
    (SELECT MAX(id) FROM risk_factors),
    true
);

-- Table: assessments (highest imported id = 6, next new id will be 7)
SELECT setval(
    pg_get_serial_sequence('assessments', 'id'),
    (SELECT MAX(id) FROM assessments),
    true
);

-- Table: patient_vitals (highest imported id = 6, next new id will be 7)
SELECT setval(
    pg_get_serial_sequence('patient_vitals', 'id'),
    (SELECT MAX(id) FROM patient_vitals),
    true
);

-- Table: ai_explanations (highest imported id = 19, next new id will be 20)
SELECT setval(
    pg_get_serial_sequence('ai_explanations', 'id'),
    (SELECT MAX(id) FROM ai_explanations),
    true
);

-- Table: healthcare_reviews (highest imported id = 5, next new id will be 6)
SELECT setval(
    pg_get_serial_sequence('healthcare_reviews', 'id'),
    (SELECT MAX(id) FROM healthcare_reviews),
    true
);

-- Table: notifications (highest imported id = 11, next new id will be 12)
SELECT setval(
    pg_get_serial_sequence('notifications', 'id'),
    (SELECT MAX(id) FROM notifications),
    true
);

-- Table: audit_logs (highest imported id = 20, next new id will be 21)
SELECT setval(
    pg_get_serial_sequence('audit_logs', 'id'),
    (SELECT MAX(id) FROM audit_logs),
    true
);

-- Table: system_settings (highest imported id = 11, next new id will be 12)
SELECT setval(
    pg_get_serial_sequence('system_settings', 'id'),
    (SELECT MAX(id) FROM system_settings),
    true
);

-- =============================================================================
-- Expected output: 13 rows, each showing a single integer (the new sequence
-- value for that table). No errors means all sequences were reset correctly.
-- Example:
--   setval
--   ------
--       5       ← users: next insert will use id 6
--       2       ← patient_profiles: next insert will use id 3
--   ... and so on for all 13 tables.
-- =============================================================================
