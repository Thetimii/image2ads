-- Add email_reminders_sent column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_reminders_sent JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.email_reminders_sent IS 'Tracks which email reminders have been sent to the user';
