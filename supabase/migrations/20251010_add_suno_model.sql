-- Add 'suno' to the models enum for music generation
-- Migration: add_suno_model_type

-- Add the new value to the models enum
ALTER TYPE models ADD VALUE IF NOT EXISTS 'suno';

-- Update comment for clarity
COMMENT ON TYPE models IS 'Supported AI models: gemini (images), seedream (videos), suno (music)';
