-- Add Pro Plan discount popup tracking columns to profiles table
-- These columns track the 15-minute limited-time discount offer

-- Drop old columns if they exist (we're switching to a simpler approach)
ALTER TABLE profiles DROP COLUMN IF EXISTS pro_discount_popup_shown_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS pro_discount_popup_expired;
DROP INDEX IF EXISTS idx_profiles_pro_discount_popup;

-- Store the expiry timestamp (current_time + 15 minutes when discount is activated)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pro_discount_expires_at timestamptz DEFAULT NULL;

-- Add index for efficient queries on expiry
CREATE INDEX IF NOT EXISTS idx_profiles_pro_discount_expires 
ON profiles(pro_discount_expires_at);

-- Drop old function if it exists (return type changed)
DROP FUNCTION IF EXISTS check_pro_discount_validity(uuid);

-- Function to check if Pro discount is still valid
CREATE OR REPLACE FUNCTION check_pro_discount_validity(user_id uuid)
RETURNS TABLE(is_valid boolean, seconds_left integer) AS $$
DECLARE
  expiry_time timestamptz;
  secs_remaining integer;
BEGIN
  -- Get the expiry timestamp
  SELECT pro_discount_expires_at
  INTO expiry_time
  FROM profiles
  WHERE id = user_id;

  -- If never activated, return invalid
  IF expiry_time IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Calculate remaining seconds
  secs_remaining := EXTRACT(EPOCH FROM (expiry_time - NOW()))::integer;
  
  -- If expired, return invalid
  IF secs_remaining <= 0 THEN
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, secs_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment on column
COMMENT ON COLUMN profiles.pro_discount_expires_at IS 'Timestamp when the Pro Plan 20% discount expires (set to NOW() + 15 minutes when first activated)';
