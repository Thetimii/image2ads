-- Add email retargeting tracking field to profiles
-- This field tracks whether a retargeting email has been sent to users who:
-- - Completed the tutorial
-- - Used all free credits (credits = 0)
-- - Haven't subscribed (subscription_id IS NULL)

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_retarget_sent BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying of eligible users
CREATE INDEX IF NOT EXISTS idx_profiles_retarget 
ON profiles(tutorial_completed, credits, subscription_id, email_retarget_sent)
WHERE tutorial_completed = TRUE 
  AND credits = 0 
  AND subscription_id IS NULL 
  AND (email_retarget_sent IS FALSE OR email_retarget_sent IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN profiles.email_retarget_sent IS 'Tracks if 50% off Pro retargeting email has been sent to this user';
