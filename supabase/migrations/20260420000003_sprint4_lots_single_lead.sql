-- Sprint 4 — STORY-020 + STORY-021: Leilão por lead individual + anti-sniping

-- ============================================================
-- 1. Adicionar auction_type em lots
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.auction_type AS ENUM (
    'single_lead',   -- leilão de 1 lead individual (novo padrão Sprint 4)
    'bundle'         -- leilão de pacote com múltiplos ativos (modelo anterior)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS auction_type public.auction_type NOT NULL DEFAULT 'single_lead',
  ADD COLUMN IF NOT EXISTS lead_inbox_id UUID REFERENCES public.leads_inbox(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extension_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.lots.auction_type IS
  'Tipo do leilão: single_lead (1 lead do inbox, padrão Sprint 4) ou bundle (múltiplos ativos agrupados, modelo legado).';

COMMENT ON COLUMN public.lots.lead_inbox_id IS
  'Referência ao lead em leads_inbox que originou este leilão (apenas para auction_type=single_lead).';

COMMENT ON COLUMN public.lots.extension_count IS
  'Quantas vezes o leilão foi estendido pelo anti-sniping. Máximo = app_settings.max_sniping_extensions.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_lots_auction_type_status
  ON public.lots(auction_type, status);

CREATE INDEX IF NOT EXISTS idx_lots_lead_inbox
  ON public.lots(lead_inbox_id)
  WHERE lead_inbox_id IS NOT NULL;

-- ============================================================
-- 2. Atualizar place_bid_atomic para novo anti-sniping (10s × max 10 ext)
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_lot_id   UUID,
  p_user_id  UUID,
  p_amount   NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot              public.lots%ROWTYPE;
  v_wallet_balance   NUMERIC;
  v_min_next_bid     NUMERIC;
  v_sniping_window   INTERVAL;
  v_extension_sec    INT;
  v_max_extensions   INT;
  v_new_ends_at      TIMESTAMPTZ;
  v_was_extended     BOOLEAN := FALSE;
  v_bid_id           UUID;
BEGIN
  -- Lock do lot para serializar lances concorrentes
  SELECT * INTO v_lot
    FROM public.lots
   WHERE id = p_lot_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  IF v_lot.status <> 'live' THEN
    RAISE EXCEPTION 'Lote não está em leilão ativo (status: %)', v_lot.status;
  END IF;

  IF v_lot.ends_at <= now() THEN
    RAISE EXCEPTION 'Leilão já encerrou';
  END IF;

  -- Validação do valor mínimo
  v_min_next_bid := GREATEST(v_lot.current_price, v_lot.starting_price) + v_lot.min_bid_increment;
  IF p_amount < v_min_next_bid THEN
    RAISE EXCEPTION 'Lance mínimo: R$ %', to_char(v_min_next_bid, 'FM999999990.00');
  END IF;

  -- Verifica saldo
  SELECT balance INTO v_wallet_balance
    FROM public.wallets
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Anti-sniping: se o lance é no último minuto E ainda há extensões disponíveis, estende
  SELECT bidding_extension_seconds, max_sniping_extensions
    INTO v_extension_sec, v_max_extensions
    FROM public.app_settings
   WHERE id = '00000000-0000-0000-0000-000000000001';

  v_sniping_window := make_interval(mins => 1);  -- último minuto
  v_new_ends_at := v_lot.ends_at;

  IF (v_lot.ends_at - now()) <= v_sniping_window
     AND v_lot.extension_count < v_max_extensions THEN
    v_new_ends_at := v_lot.ends_at + make_interval(secs => v_extension_sec);
    v_was_extended := TRUE;
  END IF;

  -- Insere o lance
  INSERT INTO public.bids (lot_id, user_id, amount)
  VALUES (p_lot_id, p_user_id, p_amount)
  RETURNING id INTO v_bid_id;

  -- Atualiza o lot
  UPDATE public.lots
     SET current_price    = p_amount,
         ends_at          = v_new_ends_at,
         extension_count  = extension_count + CASE WHEN v_was_extended THEN 1 ELSE 0 END,
         updated_at       = now()
   WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'success',         TRUE,
    'bid_id',          v_bid_id,
    'new_current',     p_amount,
    'was_extended',    v_was_extended,
    'new_ends_at',     v_new_ends_at,
    'extension_count', v_lot.extension_count + CASE WHEN v_was_extended THEN 1 ELSE 0 END,
    'max_extensions',  v_max_extensions
  );
END;
$$;

COMMENT ON FUNCTION public.place_bid_atomic IS
  'Lance atômico com anti-sniping Sprint 4: lance no último minuto estende bidding_extension_seconds (default 10s). Máximo max_sniping_extensions (default 10).';

REVOKE EXECUTE ON FUNCTION public.place_bid_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid_atomic TO service_role;

-- ============================================================
-- 3. Função promove_lead_to_auction — cria lot single_lead a partir do inbox
-- ============================================================

CREATE OR REPLACE FUNCTION public.promote_lead_to_auction(
  p_lead_id      UUID,
  p_created_by   UUID,
  p_custom_duration_minutes INT DEFAULT NULL   -- override opcional; se NULL usa sla_minutes
)
RETURNS UUID      -- retorna o id do lot criado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead            public.leads_inbox%ROWTYPE;
  v_price           NUMERIC;
  v_sla             INT;
  v_lot_id          UUID;
  v_title           TEXT;
BEGIN
  SELECT * INTO v_lead
    FROM public.leads_inbox
   WHERE id = p_lead_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado: %', p_lead_id;
  END IF;

  IF v_lead.status <> 'approved' THEN
    RAISE EXCEPTION 'Apenas leads aprovados podem ir a leilão. Status atual: %', v_lead.status;
  END IF;

  v_price := public.calculate_lead_price(v_lead.faturamento_bracket, FALSE);

  SELECT COALESCE(p_custom_duration_minutes, sla_minutes) INTO v_sla
    FROM public.app_settings
   WHERE id = '00000000-0000-0000-0000-000000000001';

  v_title := format('Lead %s — %s', v_lead.setor, v_lead.faturamento_bracket::text);

  INSERT INTO public.lots (
    title,
    description,
    status,
    starts_at,
    ends_at,
    starting_price,
    current_price,
    min_bid_increment,
    created_by,
    auction_type,
    lead_inbox_id
  ) VALUES (
    v_title,
    format('Lead de %s, faixa %s', v_lead.setor, v_lead.faturamento_bracket::text),
    'live',
    now(),
    now() + make_interval(mins => v_sla),
    v_price,
    v_price,
    GREATEST(ROUND(v_price * 0.05, 2), 10.00),   -- incremento mínimo = 5% do preço ou R$10
    p_created_by,
    'single_lead',
    v_lead.id
  ) RETURNING id INTO v_lot_id;

  UPDATE public.leads_inbox
     SET status      = 'in_auction',
         lot_id      = v_lot_id,
         price_cached = v_price,
         updated_at  = now()
   WHERE id = p_lead_id;

  RETURN v_lot_id;
END;
$$;

COMMENT ON FUNCTION public.promote_lead_to_auction IS
  'Cria um lot single_lead a partir de um lead aprovado no inbox, calcula preço via multiplicador da faixa e define SLA.';

REVOKE EXECUTE ON FUNCTION public.promote_lead_to_auction FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_lead_to_auction FROM authenticated;
GRANT EXECUTE ON FUNCTION public.promote_lead_to_auction TO service_role;

-- ============================================================
-- 4. Função buy_now_lead — compra imediata pré-leilão com premium 1.8x
-- ============================================================

CREATE OR REPLACE FUNCTION public.buy_now_lead_pre_auction(
  p_lead_id    UUID,
  p_buyer_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead            public.leads_inbox%ROWTYPE;
  v_price           NUMERIC;
  v_wallet_balance  NUMERIC;
  v_lot_id          UUID;
  v_purchase_id     UUID;
BEGIN
  SELECT * INTO v_lead
    FROM public.leads_inbox
   WHERE id = p_lead_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;

  IF v_lead.status <> 'approved' THEN
    RAISE EXCEPTION 'Lead não está disponível para Buy Now pré-leilão (status: %)', v_lead.status;
  END IF;

  -- Preço com premium
  v_price := public.calculate_lead_price(v_lead.faturamento_bracket, TRUE);

  -- Verifica saldo
  SELECT balance INTO v_wallet_balance
    FROM public.wallets
   WHERE user_id = p_buyer_id
   FOR UPDATE;

  IF v_wallet_balance IS NULL OR v_wallet_balance < v_price THEN
    RAISE EXCEPTION 'Saldo insuficiente. Preço: %, Saldo: %', v_price, COALESCE(v_wallet_balance, 0);
  END IF;

  -- Cria lot "fantasma" (status ended, venda direta) para respeitar FK de purchases
  INSERT INTO public.lots (
    title, status, starts_at, ends_at, starting_price, current_price,
    winner_user_id, created_by, auction_type, lead_inbox_id
  ) VALUES (
    format('Buy Now pré-leilão — %s', v_lead.setor),
    'ended',
    now(), now(),
    v_price, v_price,
    p_buyer_id, p_buyer_id,   -- usa buyer como created_by já que é venda direta
    'single_lead',
    v_lead.id
  ) RETURNING id INTO v_lot_id;

  -- Debita saldo
  UPDATE public.wallets
     SET balance    = balance - v_price,
         updated_at = now()
   WHERE user_id = p_buyer_id;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_after, description, reference_type, reference_id
  ) VALUES (
    p_buyer_id,
    'debit',
    -v_price,
    v_wallet_balance - v_price,
    format('Buy Now pré-leilão lead #%s', p_lead_id),
    'purchase',
    v_lot_id
  );

  -- Cria purchase
  INSERT INTO public.purchases (lot_id, buyer_user_id, amount, status)
  VALUES (v_lot_id, p_buyer_id, v_price, 'paid')
  RETURNING id INTO v_purchase_id;

  -- Marca lead como vendido pré-leilão
  UPDATE public.leads_inbox
     SET status       = 'sold_pre_auction',
         lot_id       = v_lot_id,
         purchase_id  = v_purchase_id,
         price_cached = v_price,
         updated_at   = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'lead_id',     p_lead_id,
    'lot_id',      v_lot_id,
    'purchase_id', v_purchase_id,
    'price',       v_price
  );
END;
$$;

COMMENT ON FUNCTION public.buy_now_lead_pre_auction IS
  'Buy Now pré-leilão: compra direta de um lead aprovado no inbox ao preço com premium (mql_base × bracket_mult × buy_now_premium_multiplier). Pula o leilão completamente.';

REVOKE EXECUTE ON FUNCTION public.buy_now_lead_pre_auction FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_now_lead_pre_auction TO service_role;
