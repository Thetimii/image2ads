-- Add Pro Plan discount popup tracking columns to profiles table
-- These columns track the 15-minute limited-time discount offer

-- Add timestamp for when the Pro discount popup was first shown
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pro_discount_popup_shown_at timestamptz DEFAULT NULL;

-- Add boolean flag to track if the discount window has expired
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pro_discount_popup_expired boolean DEFAULT false;

-- Add index for efficient queries on popup status
CREATE INDEX IF NOT EXISTS idx_profiles_pro_discount_popup 
ON profiles(pro_discount_popup_shown_at, pro_discount_popup_expired);

-- Function to check if Pro discount is still valid (within 15 minutes)
CREATE OR REPLACE FUNCTION check_pro_discount_validity(user_id uuid)
RETURNS TABLE(is_valid boolean, minutes_left integer) AS $$
DECLARE
  popup_time timestamptz;
  is_expired boolean;
  time_diff interval;
  mins_remaining integer;
BEGIN
  -- Get the popup timestamp and expired flag
  SELECT pro_discount_popup_shown_at, pro_discount_popup_expired
  INTO popup_time, is_expired
  FROM profiles
  WHERE id = user_id;

  -- If popup never shown, return invalid
  IF popup_time IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Calculate time difference
  time_diff := NOW() - popup_time;
  
  -- Check if more than 15 minutes have passed
  IF time_diff > INTERVAL '15 minutes' THEN
    -- Mark as expired if not already
    IF NOT is_expired THEN
      UPDATE profiles 
      SET pro_discount_popup_expired = true
      WHERE id = user_id;
    END IF;
    
    RETURN QUERY SELECT false, 0;
  ELSE
    -- Calculate remaining minutes
    mins_remaining := 15 - EXTRACT(MINUTE FROM time_diff)::integer;
    IF mins_remaining < 0 THEN
      mins_remaining := 0;
    END IF;
    
    RETURN QUERY SELECT true, mins_remaining;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comment on columns
COMMENT ON COLUMN profiles.pro_discount_popup_shown_at IS 'Timestamp when the Pro Plan 20% discount modal was first displayed to the user';
COMMENT ON COLUMN profiles.pro_discount_popup_expired IS 'True if the 15-minute discount window has expired';
