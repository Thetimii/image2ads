-- Extend the existing enum type "models" to support sora-2 variants
-- This fixes: ERROR 22P02: invalid input value for enum models: "sora-2"
-- Safe to run multiple times (IF NOT EXISTS guards)

DO $$ BEGIN
  -- If the enum value does not exist, add it. (Postgres 14+ supports IF NOT EXISTS on ADD VALUE)
  ALTER TYPE models ADD VALUE IF NOT EXISTS 'sora-2';
  ALTER TYPE models ADD VALUE IF NOT EXISTS 'sora-2-landscape';
  ALTER TYPE models ADD VALUE IF NOT EXISTS 'sora-2-portrait';
EXCEPTION
  WHEN duplicate_object THEN
    -- Ignore race conditions if two deployments try to add simultaneously
    NULL;
END $$;

-- Optionally: if jobs.model had an old CHECK constraint referencing only gemini/seedream, drop it.
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS check_valid_model;

-- (Optional) Re‑add a broader check constraint if you want to restrict values beyond enum definition
-- ALTER TABLE jobs ADD CONSTRAINT check_valid_model CHECK (model IN (
--   'gemini','seedream','sora-2','sora-2-landscape','sora-2-portrait'
-- ));

COMMENT ON TYPE models IS 'Enum of allowed model identifiers including sora-2 variants.';