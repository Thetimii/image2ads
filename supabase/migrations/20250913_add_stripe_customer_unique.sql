-- Add unique constraint for stripe_customer_id
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_stripe_customer_id_unique 
UNIQUE (stripe_customer_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON public.profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;