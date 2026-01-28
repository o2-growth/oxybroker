-- Correção: notifications já está no realtime, apenas adicionar policy faltante

-- Add policy for notifications INSERT by system (edge functions use service role)
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system"
  ON public.notifications FOR INSERT
  WITH CHECK (true);