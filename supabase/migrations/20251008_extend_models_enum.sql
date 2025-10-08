-- Extend allowed model values to support sora-2 video generation and aspect ratio suffixed variants
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS check_valid_model;

ALTER TABLE jobs ADD CONSTRAINT check_valid_model
  CHECK (model IN (
    'gemini',
    'seedream', -- keep legacy
    'sora-2',
    'sora-2-landscape',
    'sora-2-portrait'
  ));

COMMENT ON CONSTRAINT check_valid_model ON jobs IS 'Restricts jobs.model to supported AI model identifiers (including sora-2 video variants).';
