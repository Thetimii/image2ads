-- Add total_generations column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS total_generations INTEGER DEFAULT 0 NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_total_generations ON profiles(total_generations);

-- Backfill existing data: count all jobs for each user
UPDATE profiles
SET total_generations = (
  SELECT COUNT(*)
  FROM jobs
  WHERE jobs.user_id = profiles.id
);

-- Create a function to increment total_generations
CREATE OR REPLACE FUNCTION increment_total_generations()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment total_generations when a new job is created
  UPDATE profiles
  SET total_generations = total_generations + 1
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically increment on job creation
DROP TRIGGER IF EXISTS trigger_increment_total_generations ON jobs;
CREATE TRIGGER trigger_increment_total_generations
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION increment_total_generations();
