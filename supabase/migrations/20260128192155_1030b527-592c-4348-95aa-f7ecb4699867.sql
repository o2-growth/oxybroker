-- Remove the permissive policy (it will be handled by service role which bypasses RLS)
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;