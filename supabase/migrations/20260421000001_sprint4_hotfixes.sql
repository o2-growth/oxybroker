-- Sprint 4 hotfixes — QA do fluxo completo comprador/admin
--
-- 1) buy_now_atomic: INSERT em purchases/lots referenciava colunas inexistentes
--    (user_id, is_buy_now, return_deadline, winner_id). Nomes corretos:
--    buyer_user_id, return_deadline_at, winner_user_id. Também corrige
--    v_promo_result jsonb -> RECORD (chamada a get_active_promotion).
--    E dispara mark_lead_sold_auction para lots single_lead ao final.
--
-- 2) promote_lead_to_auction: aceita lead em 'pending_review' diretamente
--    (fluxo de 1 clique escolhido pelo negócio — aprovar = abrir leilao).
--    Inclui admin-only check explicito.
--
-- 3) RLS leads_inbox_select_buyer: comprador pode ler o lead que comprou
--    (via purchases.buyer_user_id -> lots.lead_inbox_id).

CREATE OR REPLACE FUNCTION public.buy_now_atomic(p_lot_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_lot RECORD;
  v_wallet RECORD;
  v_settings RECORD;
  v_buy_now_price numeric;
  v_purchase_id uuid;
  v_return_deadline timestamptz;
  v_promo RECORD;
  v_cashback_amount numeric := 0;
  v_promo_name text := NULL;
BEGIN
  SELECT * INTO v_lot FROM public.lots WHERE id = p_lot_id FOR UPDATE;
  IF v_lot IS NULL THEN
    RETURN jsonb_build_object('error_code','LOT_NOT_FOUND','error_message','Lote nao encontrado');
  END IF;
  IF v_lot.status <> 'live' THEN
    RETURN jsonb_build_object('error_code','LOT_NOT_LIVE','error_message','Leilao nao esta ativo');
  END IF;
  IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at < now() THEN
    RETURN jsonb_build_object('error_code','LOT_ENDED','error_message','Leilao ja foi encerrado');
  END IF;

  v_buy_now_price := round(
    CASE WHEN v_lot.current_price > v_lot.starting_price
      THEN v_lot.current_price * 1.8
      ELSE v_lot.starting_price * 1.8
    END, 2);

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL OR v_wallet.balance < v_buy_now_price THEN
    RETURN jsonb_build_object(
      'error_code','INSUFFICIENT_FUNDS',
      'error_message','Saldo insuficiente',
      'required', v_buy_now_price,
      'available', COALESCE(v_wallet.balance, 0)
    );
  END IF;

  UPDATE public.wallets SET balance = balance - v_buy_now_price, updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (p_user_id, -v_buy_now_price, 'debit_purchase', format('Buy Now: %s', v_lot.title), 'lot', p_lot_id::text);

  SELECT return_window_hours INTO v_settings FROM public.app_settings LIMIT 1;
  v_return_deadline := now() + make_interval(hours => COALESCE(v_settings.return_window_hours, 72));

  INSERT INTO public.purchases (buyer_user_id, lot_id, amount, return_deadline_at)
  VALUES (p_user_id, p_lot_id, v_buy_now_price, v_return_deadline)
  RETURNING id INTO v_purchase_id;

  BEGIN
    SELECT * INTO v_promo FROM public.get_active_promotion(p_user_id, 'purchase', v_buy_now_price);
  EXCEPTION WHEN OTHERS THEN v_promo := NULL;
  END;

  IF v_promo.promotion_id IS NOT NULL THEN
    v_cashback_amount := public.calculate_promotion_benefit(v_promo.promotion_id, v_buy_now_price);
    v_promo_name := v_promo.name;
    IF v_cashback_amount > 0 THEN
      INSERT INTO public.promotion_usage (promotion_id, user_id, original_amount, benefit_amount, reference_type, reference_id)
      VALUES (v_promo.promotion_id, p_user_id, v_buy_now_price, v_cashback_amount, 'purchase', v_purchase_id::text);

      UPDATE public.wallets SET balance = balance + v_cashback_amount, updated_at = now()
       WHERE user_id = p_user_id;

      INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
      VALUES (p_user_id, v_cashback_amount, 'credit_refund',
              format('Cashback: %s - %s', v_promo.name, v_lot.title),
              'promotion', v_promo.promotion_id::text);
    END IF;
  END IF;

  UPDATE public.lots
     SET status = 'ended',
         current_price = v_buy_now_price,
         winner_user_id = p_user_id,
         updated_at = now()
   WHERE id = p_lot_id;

  IF v_lot.auction_type = 'single_lead' AND v_lot.lead_inbox_id IS NOT NULL THEN
    PERFORM public.mark_lead_sold_auction(p_lot_id, v_purchase_id);
  END IF;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'lot_title', v_lot.title,
    'buy_now_price', v_buy_now_price,
    'return_deadline', v_return_deadline,
    'cashback_amount', v_cashback_amount,
    'promotion_name', v_promo_name
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.buy_now_atomic(uuid, uuid) TO authenticated, anon, service_role;

-- promote_lead_to_auction: aceita pending_review diretamente + admin check
CREATE OR REPLACE FUNCTION public.promote_lead_to_auction(
  p_lead_id uuid,
  p_created_by uuid,
  p_custom_duration_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_lead RECORD;
  v_settings RECORD;
  v_price numeric;
  v_duration integer;
  v_lot_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admin pode promover lead para leilao' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads_inbox WHERE id = p_lead_id FOR UPDATE;
  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead nao encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_lead.status NOT IN ('pending_review','approved') THEN
    RAISE EXCEPTION 'Lead ja foi processado (status=%)', v_lead.status USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.app_settings LIMIT 1;
  v_duration := COALESCE(p_custom_duration_minutes, v_settings.sla_minutes, 10);
  v_price := public.calculate_lead_price(v_lead.faturamento_bracket, FALSE);

  INSERT INTO public.lots (
    title, description, status, starts_at, ends_at,
    starting_price, current_price, min_bid_increment,
    auction_type, lead_inbox_id, created_by
  ) VALUES (
    format('Lead %s - %s', v_lead.setor, v_lead.faturamento_bracket),
    COALESCE(v_lead.observacoes, ''),
    'live', now(), now() + make_interval(mins => v_duration),
    v_price, v_price, GREATEST(round(v_price * 0.05, 2), 1),
    'single_lead', p_lead_id, p_created_by
  ) RETURNING id INTO v_lot_id;

  UPDATE public.leads_inbox
     SET status = 'in_auction',
         lot_id = v_lot_id,
         price_cached = v_price,
         approved_at = COALESCE(approved_at, now()),
         approved_by = COALESCE(approved_by, p_created_by),
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'lot_id', v_lot_id,
    'price', v_price,
    'duration_minutes', v_duration
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.promote_lead_to_auction(uuid, uuid, integer)
  TO authenticated, service_role;

-- RLS: comprador ve o lead que comprou
DROP POLICY IF EXISTS leads_inbox_select_buyer ON public.leads_inbox;
CREATE POLICY leads_inbox_select_buyer ON public.leads_inbox
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchases p
    JOIN public.lots l ON l.id = p.lot_id
    WHERE p.buyer_user_id = auth.uid()
      AND l.lead_inbox_id = leads_inbox.id
  )
);

NOTIFY pgrst, 'reload schema';
