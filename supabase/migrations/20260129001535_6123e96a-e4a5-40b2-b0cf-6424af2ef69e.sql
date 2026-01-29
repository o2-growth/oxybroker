-- =============================================
-- ANALYTICS EVENTS TABLE
-- =============================================

CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  event_name text NOT NULL,
  user_id uuid NULL,
  role text NULL,
  route text NULL,
  referrer text NULL,
  session_id text NOT NULL,
  request_id text NULL,
  entity_type text NULL,
  entity_id text NULL,
  status text NULL,
  duration_ms integer NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- =============================================
-- INDEXES FOR QUERY PERFORMANCE
-- =============================================

CREATE INDEX idx_analytics_events_occurred_at ON public.analytics_events (occurred_at DESC);
CREATE INDEX idx_analytics_events_name_occurred ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX idx_analytics_events_user_occurred ON public.analytics_events (user_id, occurred_at DESC);
CREATE INDEX idx_analytics_events_route_occurred ON public.analytics_events (route, occurred_at DESC);
CREATE INDEX idx_analytics_events_type ON public.analytics_events (event_type);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Admin can SELECT all analytics data
CREATE POLICY "analytics_events_select_admin"
ON public.analytics_events
FOR SELECT
USING (public.is_admin());

-- No direct INSERT/UPDATE/DELETE from clients
-- All inserts happen via service role in edge function
CREATE POLICY "analytics_events_insert_deny"
ON public.analytics_events
FOR INSERT
WITH CHECK (false);

CREATE POLICY "analytics_events_update_deny"
ON public.analytics_events
FOR UPDATE
USING (false);

CREATE POLICY "analytics_events_delete_deny"
ON public.analytics_events
FOR DELETE
USING (false);

-- =============================================
-- DAILY ROLLUPS TABLE (for performance)
-- =============================================

CREATE TABLE public.analytics_daily_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollup_date date NOT NULL,
  event_type text NOT NULL,
  event_name text NOT NULL,
  route text NULL,
  total_count integer NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  unique_sessions integer NOT NULL DEFAULT 0,
  total_duration_ms bigint NULL,
  avg_duration_ms numeric NULL,
  error_count integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rollup_date, event_type, event_name, route)
);

CREATE INDEX idx_rollups_date ON public.analytics_daily_rollups (rollup_date DESC);
CREATE INDEX idx_rollups_event ON public.analytics_daily_rollups (event_name, rollup_date DESC);

ALTER TABLE public.analytics_daily_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollups_select_admin"
ON public.analytics_daily_rollups
FOR SELECT
USING (public.is_admin());

CREATE POLICY "rollups_insert_deny"
ON public.analytics_daily_rollups
FOR INSERT
WITH CHECK (false);

CREATE POLICY "rollups_update_deny"
ON public.analytics_daily_rollups
FOR UPDATE
USING (false);

CREATE POLICY "rollups_delete_deny"
ON public.analytics_daily_rollups
FOR DELETE
USING (false);