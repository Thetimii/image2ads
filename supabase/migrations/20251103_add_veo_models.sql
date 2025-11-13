-- Add Veo 3.1 model types to the models enum
-- This allows storing veo3_fast and veo3 in the jobs table

ALTER TYPE models ADD VALUE IF NOT EXISTS 'veo3_fast';
ALTER TYPE models ADD VALUE IF NOT EXISTS 'veo3';
