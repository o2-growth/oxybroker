-- Sprint 4 — STORY-019: Pricing config + MQL base + multiplicadores por faixa de faturamento
-- Adiciona campos de precificação em app_settings e função calculate_lead_price

-- ============================================================
-- 1. Expandir app_settings com config de precificação e leilão
-- ============================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS mql_base_value NUMERIC(10,2) NOT NULL DEFAULT 718.00,
  ADD COLUMN IF NOT EXISTS bracket_multipliers JSONB NOT NULL DEFAULT '{
    "200k_350k": 0.7,
    "350k_500k": 1.0,
    "500k_1m":   1.3,
    "1m_5m":     1.5,
    "5m_plus":   1.8
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS buy_now_premium_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.8,
  ADD COLUMN IF NOT EXISTS sla_minutes INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_sniping_extensions INT NOT NULL DEFAULT 10;

-- Ajusta bidding_extension_seconds para 10s (era 30s) conforme nova regra de anti-sniping
UPDATE public.app_settings
   SET bidding_extension_seconds = 10
 WHERE id = '00000000-0000-0000-0000-000000000001'
   AND bidding_extension_seconds = 30;

COMMENT ON COLUMN public.app_settings.mql_base_value IS
  'Valor base do MQL em BRL. Preço do lead = mql_base_value × multiplicador da faixa de faturamento.';

COMMENT ON COLUMN public.app_settings.bracket_multipliers IS
  'Multiplicadores por faixa de faturamento do lead. Chaves: 200k_350k, 350k_500k, 500k_1m, 1m_5m, 5m_plus.';

COMMENT ON COLUMN public.app_settings.buy_now_premium_multiplier IS
  'Multiplicador adicional aplicado no Buy Now pré-leilão (lead aprovado mas ainda não em leilão live com bids).';

COMMENT ON COLUMN public.app_settings.sla_minutes IS
  'Duração do leilão de um lead em minutos. Após expirar sem venda, lead vai para Pipefy da Matriz.';

COMMENT ON COLUMN public.app_settings.max_sniping_extensions IS
  'Máximo de extensões anti-sniping por leilão. Cada lance no último minuto estende bidding_extension_seconds.';

-- ============================================================
-- 2. Enum de faixas de faturamento (para leads_inbox e assets)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.revenue_bracket AS ENUM (
    '200k_350k',
    '350k_500k',
    '500k_1m',
    '1m_5m',
    '5m_plus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.revenue_bracket IS
  'Faixa de faturamento anual da empresa do lead, usada para cálculo do preço.';

-- ============================================================
-- 3. Função calculate_lead_price — cálculo atômico do preço
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_lead_price(
  p_bracket         public.revenue_bracket,
  p_is_pre_auction  BOOLEAN DEFAULT FALSE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base       NUMERIC;
  v_mult       NUMERIC;
  v_premium    NUMERIC;
  v_mult_key   TEXT;
BEGIN
  SELECT mql_base_value, buy_now_premium_multiplier, bracket_multipliers
    INTO v_base, v_premium, v_mult_key
    FROM public.app_settings
   WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'app_settings singleton not found';
  END IF;

  SELECT (bracket_multipliers ->> p_bracket::text)::numeric
    INTO v_mult
    FROM public.app_settings
   WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_mult IS NULL THEN
    RAISE EXCEPTION 'Multiplicador não configurado para bracket %', p_bracket;
  END IF;

  IF p_is_pre_auction THEN
    RETURN ROUND(v_base * v_mult * v_premium, 2);
  ELSE
    RETURN ROUND(v_base * v_mult, 2);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_lead_price IS
  'Calcula o preço de um lead: mql_base × bracket_multiplier. Se p_is_pre_auction=true, multiplica também por buy_now_premium_multiplier (Buy Now antes do leilão com bids).';

GRANT EXECUTE ON FUNCTION public.calculate_lead_price TO authenticated, anon, service_role;
