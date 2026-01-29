-- =============================================
-- ENUMS FOR PROMOTIONS SYSTEM
-- =============================================
CREATE TYPE public.promotion_type AS ENUM ('discount', 'cashback');
CREATE TYPE public.promotion_applies_to AS ENUM ('topup', 'bid', 'purchase');
CREATE TYPE public.benefit_type AS ENUM ('percentage', 'fixed');
CREATE TYPE public.eligibility_type AS ENUM ('global', 'category', 'individual');
CREATE TYPE public.schedule_type AS ENUM ('one_time', 'recurring');

-- =============================================
-- PROMOTIONS TABLE
-- =============================================
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type promotion_type NOT NULL,
  applies_to promotion_applies_to NOT NULL,
  benefit_type benefit_type NOT NULL,
  benefit_value numeric NOT NULL CHECK (benefit_value > 0),
  min_amount numeric DEFAULT 0,
  max_benefit numeric,
  eligibility eligibility_type NOT NULL DEFAULT 'global',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "promotions_all_admin" ON public.promotions
  FOR ALL USING (is_admin());

CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT USING (is_active = true);

-- Updated at trigger
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- PROMOTION SCHEDULES TABLE
-- =============================================
CREATE TABLE public.promotion_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  schedule_type schedule_type NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  days_of_week integer[] DEFAULT '{}',
  start_time time,
  end_time time,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotion_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "schedules_all_admin" ON public.promotion_schedules
  FOR ALL USING (is_admin());

CREATE POLICY "schedules_select_via_promotion" ON public.promotion_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.promotions p 
      WHERE p.id = promotion_id AND p.is_active = true
    )
  );

-- =============================================
-- PROMOTION ELIGIBILITY TABLE
-- =============================================
CREATE TABLE public.promotion_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.franchise_categories(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eligibility_requires_one CHECK (
    (category_id IS NOT NULL AND user_id IS NULL) OR
    (category_id IS NULL AND user_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.promotion_eligibility ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "eligibility_all_admin" ON public.promotion_eligibility
  FOR ALL USING (is_admin());

CREATE POLICY "eligibility_select_own" ON public.promotion_eligibility
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- PROMOTION USAGE TABLE
-- =============================================
CREATE TABLE public.promotion_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  original_amount numeric NOT NULL,
  benefit_amount numeric NOT NULL,
  reference_type text NOT NULL,
  reference_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "usage_select_admin" ON public.promotion_usage
  FOR SELECT USING (is_admin());

CREATE POLICY "usage_select_own" ON public.promotion_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usage_insert_admin" ON public.promotion_usage
  FOR INSERT WITH CHECK (is_admin());

-- Index for faster queries
CREATE INDEX idx_promotion_usage_promotion_id ON public.promotion_usage(promotion_id);
CREATE INDEX idx_promotion_usage_user_id ON public.promotion_usage(user_id);
CREATE INDEX idx_promotion_usage_created_at ON public.promotion_usage(created_at);

-- =============================================
-- FUNCTION: Check if promotion schedule is active NOW
-- =============================================
CREATE OR REPLACE FUNCTION public.is_promotion_schedule_active(p_promotion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_current_time time;
  v_current_dow integer;
BEGIN
  -- Get schedule for the promotion
  SELECT * INTO v_schedule
  FROM public.promotion_schedules
  WHERE promotion_id = p_promotion_id
  LIMIT 1;
  
  -- No schedule means always active
  IF v_schedule IS NULL THEN
    RETURN true;
  END IF;
  
  v_current_time := LOCALTIME;
  v_current_dow := EXTRACT(DOW FROM NOW());
  
  IF v_schedule.schedule_type = 'one_time' THEN
    -- Check if within date range
    RETURN (
      (v_schedule.starts_at IS NULL OR NOW() >= v_schedule.starts_at) AND
      (v_schedule.ends_at IS NULL OR NOW() <= v_schedule.ends_at)
    );
  ELSE -- recurring
    -- Check day of week and time
    RETURN (
      (v_schedule.days_of_week IS NULL OR array_length(v_schedule.days_of_week, 1) IS NULL OR v_current_dow = ANY(v_schedule.days_of_week)) AND
      (v_schedule.start_time IS NULL OR v_current_time >= v_schedule.start_time) AND
      (v_schedule.end_time IS NULL OR v_current_time <= v_schedule.end_time)
    );
  END IF;
END;
$$;

-- =============================================
-- FUNCTION: Check user eligibility for a promotion
-- =============================================
CREATE OR REPLACE FUNCTION public.is_user_eligible_for_promotion(p_user_id uuid, p_promotion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion RECORD;
  v_user_category_id uuid;
BEGIN
  -- Get promotion
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE id = p_promotion_id AND is_active = true;
  
  IF v_promotion IS NULL THEN
    RETURN false;
  END IF;
  
  -- Global eligibility
  IF v_promotion.eligibility = 'global' THEN
    RETURN true;
  END IF;
  
  -- Get user's category
  SELECT franchise_category_id INTO v_user_category_id
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Category eligibility
  IF v_promotion.eligibility = 'category' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.promotion_eligibility
      WHERE promotion_id = p_promotion_id
        AND category_id = v_user_category_id
    );
  END IF;
  
  -- Individual eligibility
  IF v_promotion.eligibility = 'individual' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.promotion_eligibility
      WHERE promotion_id = p_promotion_id
        AND user_id = p_user_id
    );
  END IF;
  
  RETURN false;
END;
$$;

-- =============================================
-- FUNCTION: Get active promotion for user and action
-- =============================================
CREATE OR REPLACE FUNCTION public.get_active_promotion(
  p_user_id uuid,
  p_applies_to text,
  p_amount numeric
)
RETURNS TABLE (
  promotion_id uuid,
  name text,
  type text,
  benefit_type text,
  benefit_value numeric,
  max_benefit numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as promotion_id,
    p.name,
    p.type::text,
    p.benefit_type::text,
    p.benefit_value,
    p.max_benefit
  FROM public.promotions p
  WHERE p.is_active = true
    AND p.applies_to::text = p_applies_to
    AND (p.min_amount IS NULL OR p.min_amount <= p_amount)
    AND is_promotion_schedule_active(p.id)
    AND is_user_eligible_for_promotion(p_user_id, p.id)
  ORDER BY 
    -- Prioritize: higher percentage/fixed value
    CASE WHEN p.benefit_type = 'percentage' THEN p.benefit_value ELSE 0 END DESC,
    CASE WHEN p.benefit_type = 'fixed' THEN p.benefit_value ELSE 0 END DESC
  LIMIT 1;
END;
$$;

-- =============================================
-- FUNCTION: Calculate benefit amount
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_promotion_benefit(
  p_promotion_id uuid,
  p_original_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion RECORD;
  v_benefit numeric;
BEGIN
  SELECT * INTO v_promotion
  FROM public.promotions
  WHERE id = p_promotion_id;
  
  IF v_promotion IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate benefit
  IF v_promotion.benefit_type = 'percentage' THEN
    v_benefit := ROUND(p_original_amount * v_promotion.benefit_value / 100, 2);
  ELSE
    v_benefit := v_promotion.benefit_value;
  END IF;
  
  -- Apply max benefit cap
  IF v_promotion.max_benefit IS NOT NULL AND v_benefit > v_promotion.max_benefit THEN
    v_benefit := v_promotion.max_benefit;
  END IF;
  
  RETURN v_benefit;
END;
$$;

-- =============================================
-- FUNCTION: Apply promotion and record usage (for edge functions)
-- =============================================
CREATE OR REPLACE FUNCTION public.apply_promotion(
  p_user_id uuid,
  p_applies_to text,
  p_original_amount numeric,
  p_reference_type text,
  p_reference_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_benefit numeric;
BEGIN
  -- Get active promotion
  SELECT * INTO v_promo
  FROM public.get_active_promotion(p_user_id, p_applies_to, p_original_amount);
  
  IF v_promo.promotion_id IS NULL THEN
    RETURN jsonb_build_object(
      'has_promotion', false,
      'benefit_amount', 0,
      'final_amount', p_original_amount
    );
  END IF;
  
  -- Calculate benefit
  v_benefit := public.calculate_promotion_benefit(v_promo.promotion_id, p_original_amount);
  
  -- Record usage
  INSERT INTO public.promotion_usage (promotion_id, user_id, original_amount, benefit_amount, reference_type, reference_id)
  VALUES (v_promo.promotion_id, p_user_id, p_original_amount, v_benefit, p_reference_type, p_reference_id);
  
  RETURN jsonb_build_object(
    'has_promotion', true,
    'promotion_id', v_promo.promotion_id,
    'promotion_name', v_promo.name,
    'promotion_type', v_promo.type,
    'benefit_type', v_promo.benefit_type,
    'benefit_value', v_promo.benefit_value,
    'benefit_amount', v_benefit,
    'final_amount', CASE 
      WHEN v_promo.type = 'discount' THEN p_original_amount - v_benefit
      ELSE p_original_amount -- cashback doesn't reduce the amount
    END
  );
END;
$$;