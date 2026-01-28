-- =============================================
-- STRIPE EVENTS TABLE FOR IDEMPOTENCY
-- Prevents double-processing of webhooks
-- =============================================

CREATE TABLE public.stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed', -- processed, failed, retry_pending
  payload jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 1,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Only admin can view/manage stripe events
CREATE POLICY "stripe_events_select_admin"
  ON public.stripe_events FOR SELECT
  USING (is_admin());

CREATE POLICY "stripe_events_all_admin"
  ON public.stripe_events FOR ALL
  USING (is_admin());

-- Index for fast lookups
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_status ON public.stripe_events(status);

-- =============================================
-- ADMIN ALERTS TABLE
-- For failed webhook notifications
-- =============================================

CREATE TABLE public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'stripe_webhook_failed', 'payment_issue', etc.
  title text NOT NULL,
  message text,
  metadata jsonb,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Only admin can view/manage alerts
CREATE POLICY "admin_alerts_select_admin"
  ON public.admin_alerts FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_alerts_all_admin"
  ON public.admin_alerts FOR ALL
  USING (is_admin());

-- Index for unacknowledged alerts
CREATE INDEX idx_admin_alerts_unacknowledged 
  ON public.admin_alerts(created_at) 
  WHERE acknowledged_at IS NULL;