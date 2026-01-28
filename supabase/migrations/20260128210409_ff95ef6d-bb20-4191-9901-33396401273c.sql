-- Add suspended status to profiles
ALTER TABLE public.profiles 
ADD COLUMN suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.suspended_at IS 'When set, user is suspended and cannot access the system';