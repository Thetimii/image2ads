-- Add model field to jobs table to support multiple AI models
ALTER TABLE jobs ADD COLUMN model VARCHAR(50) DEFAULT 'gemini';

-- Add check constraint for valid model values
ALTER TABLE jobs ADD CONSTRAINT check_valid_model 
  CHECK (model IN ('gemini', 'seedream'));