-- 005: Record declined consent separately from accepted consent (PRD §9.2).
-- Previously a decline inserted a row identical to an acceptance, so the
-- assessment consent check treated declined users as consented.
-- The latest row per user now decides; accepted = FALSE blocks AI processing.

ALTER TABLE consent_records
    ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN consent_records.accepted IS 'TRUE if the user accepted this consent version, FALSE if declined or withdrawn.';
