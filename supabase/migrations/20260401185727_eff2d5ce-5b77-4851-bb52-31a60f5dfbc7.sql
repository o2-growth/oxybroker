CREATE OR REPLACE FUNCTION public.place_bid_atomic(p_lot_id uuid, p_user_id uuid, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lot RECORD;
  v_settings RECORD;
  v_previous_bid RECORD;
  v_wallet RECORD;
  v_new_bid_id uuid;
  v_was_extended boolean := false;
  v_new_ends_at timestamptz;
  v_bid_count integer;
  v_seconds_remaining integer;
  v_user_has_previous_bids boolean;
  v_user_previous_max_bid numeric;
  v_required_balance numeric;
  v_promo_result RECORD;
  v_discount_amount numeric := 0;
  v_final_required_balance numeric;
BEGIN
  SELECT * INTO v_lot
  FROM public.lots
  WHERE id = p_lot_id
  FOR UPDATE;

  IF v_lot IS NULL THEN
    RETURN jsonb_build_object('error_code', 'LOT_NOT_FOUND', 'error_message', 'Lote não encontrado');
  END IF;

  IF v_lot.status != 'live' THEN
    RETURN jsonb_build_object('error_code', 'LOT_NOT_LIVE', 'error_message', 'Este leilão não está ativo');
  END IF;

  IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at < now() THEN
    RETURN jsonb_build_object('error_code', 'LOT_ENDED', 'error_message', 'Este leilão já foi encerrado');
  END IF;

  SELECT MAX(amount) INTO v_user_previous_max_bid
  FROM public.bids
  WHERE lot_id = p_lot_id AND user_id = p_user_id;

  v_user_has_previous_bids := v_user_previous_max_bid IS NOT NULL;

  IF v_user_has_previous_bids THEN
    IF p_amount <= v_lot.current_price THEN
      RETURN jsonb_build_object('error_code', 'BID_TOO_LOW', 'error_message', format('Seu lance deve ser maior que %s', to_char(v_lot.current_price, 'FM999G999G999D00')));
    END IF;
  ELSE
    IF p_amount < (v_lot.current_price + v_lot.min_bid_increment) THEN
      RETURN jsonb_build_object('error_code', 'BID_TOO_LOW', 'error_message', format('Lance mínimo é %s', to_char(v_lot.current_price + v_lot.min_bid_increment, 'FM999G999G999D00')));
    END IF;
  END IF;

  IF v_user_has_previous_bids THEN
    v_required_balance := p_amount - v_user_previous_max_bid;
    IF v_required_balance < 0 THEN v_required_balance := 0; END IF;
  ELSE
    v_required_balance := p_amount;
  END IF;

  SELECT * INTO v_promo_result
  FROM public.get_active_promotion(p_user_id, 'bid', v_required_balance);
  
  IF v_promo_result IS NOT NULL AND v_promo_result.promotion_id IS NOT NULL THEN
    v_discount_amount := public.calculate_promotion_benefit(v_promo_result.promotion_id, v_required_balance);
  END IF;
  
  v_final_required_balance := GREATEST(0, v_required_balance - v_discount_amount);

  SELECT balance INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet.balance IS NULL OR v_wallet.balance < v_final_required_balance THEN
    RETURN jsonb_build_object('error_code', 'INSUFFICIENT_BALANCE', 'error_message', format('Saldo insuficiente. Necessário: R$ %s. Seu saldo: R$ %s', to_char(v_final_required_balance, 'FM999G999D00'), COALESCE(to_char(v_wallet.balance, 'FM999G999D00'), '0,00')));
  END IF;

  IF v_promo_result IS NOT NULL AND v_promo_result.promotion_id IS NOT NULL AND v_discount_amount > 0 THEN
    INSERT INTO public.promotion_usage (promotion_id, user_id, original_amount, benefit_amount, reference_type, reference_id)
    VALUES (v_promo_result.promotion_id, p_user_id, v_required_balance, v_discount_amount, 'bid', p_lot_id::text);
  END IF;

  SELECT b.*, p.full_name as bidder_name INTO v_previous_bid
  FROM public.bids b
  LEFT JOIN public.profiles p ON b.user_id = p.id
  WHERE b.lot_id = p_lot_id
  ORDER BY b.amount DESC
  LIMIT 1;

  SELECT * INTO v_settings FROM public.app_settings LIMIT 1;

  IF v_lot.ends_at IS NOT NULL THEN
    v_seconds_remaining := EXTRACT(EPOCH FROM (v_lot.ends_at - now()))::integer;
  ELSE
    v_seconds_remaining := 9999;
  END IF;

  v_new_ends_at := v_lot.ends_at;
  IF v_settings IS NOT NULL 
     AND v_settings.bidding_extension_seconds > 0 
     AND v_seconds_remaining <= v_settings.bidding_extension_seconds 
     AND v_seconds_remaining > 0 THEN
    v_new_ends_at := v_lot.ends_at + (v_settings.bidding_extension_seconds || ' seconds')::interval;
    v_was_extended := true;
  END IF;

  INSERT INTO public.bids (lot_id, user_id, amount, created_at)
  VALUES (p_lot_id, p_user_id, p_amount, now())
  RETURNING id INTO v_new_bid_id;

  UPDATE public.lots
  SET current_price = p_amount, ends_at = v_new_ends_at, updated_at = now()
  WHERE id = p_lot_id;

  SELECT count(*) INTO v_bid_count FROM public.bids WHERE lot_id = p_lot_id;

  RETURN jsonb_build_object(
    'success', true,
    'bid_id', v_new_bid_id,
    'lot_title', v_lot.title,
    'ends_at', v_new_ends_at,
    'was_extended', v_was_extended,
    'bid_count', v_bid_count,
    'previous_bidder_id', v_previous_bid.user_id,
    'previous_amount', v_previous_bid.amount,
    'required_balance', v_final_required_balance,
    'original_required', v_required_balance,
    'discount_amount', v_discount_amount,
    'promotion_name', v_promo_result.name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.buy_now_atomic(p_lot_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lot RECORD;
  v_wallet RECORD;
  v_settings RECORD;
  v_buy_now_price numeric;
  v_purchase_id uuid;
  v_return_deadline timestamptz;
  v_promo_result RECORD;
  v_cashback_amount numeric := 0;
BEGIN
  SELECT * INTO v_lot FROM public.lots WHERE id = p_lot_id FOR UPDATE;

  IF v_lot IS NULL THEN
    RETURN jsonb_build_object('error_code', 'LOT_NOT_FOUND', 'error_message', 'Lote não encontrado');
  END IF;

  IF v_lot.status != 'live' THEN
    RETURN jsonb_build_object('error_code', 'LOT_NOT_LIVE', 'error_message', 'Este leilão não está ativo ou já foi encerrado');
  END IF;

  IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at < now() THEN
    RETURN jsonb_build_object('error_code', 'LOT_ENDED', 'error_message', 'Este leilão já foi encerrado');
  END IF;

  v_buy_now_price := round(
    CASE 
      WHEN v_lot.current_price > v_lot.starting_price THEN v_lot.current_price * 1.8
      ELSE v_lot.starting_price * 1.8
    END, 2
  );

  SELECT balance INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet.balance IS NULL OR v_wallet.balance < v_buy_now_price THEN
    RETURN jsonb_build_object('error_code', 'INSUFFICIENT_BALANCE', 'error_message', format('Saldo insuficiente. Preço de compra imediata: R$ %s. Seu saldo: R$ %s', to_char(v_buy_now_price, 'FM999G999D00'), COALESCE(to_char(v_wallet.balance, 'FM999G999D00'), '0,00')));
  END IF;

  SELECT * INTO v_settings FROM public.app_settings LIMIT 1;
  v_return_deadline := now() + (COALESCE(v_settings.return_window_hours, 72) || ' hours')::interval;

  UPDATE public.wallets SET balance = balance - v_buy_now_price, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (p_user_id, -v_buy_now_price, 'debit_purchase', format('Compra imediata: %s', v_lot.title), 'purchase', p_lot_id::text);

  INSERT INTO public.purchases (lot_id, buyer_user_id, amount, status, return_deadline_at)
  VALUES (p_lot_id, p_user_id, v_buy_now_price, 'paid', v_return_deadline)
  RETURNING id INTO v_purchase_id;

  SELECT * INTO v_promo_result FROM public.get_active_promotion(p_user_id, 'purchase', v_buy_now_price);
  
  IF v_promo_result IS NOT NULL AND v_promo_result.promotion_id IS NOT NULL THEN
    v_cashback_amount := public.calculate_promotion_benefit(v_promo_result.promotion_id, v_buy_now_price);
    
    IF v_cashback_amount > 0 THEN
      INSERT INTO public.promotion_usage (promotion_id, user_id, original_amount, benefit_amount, reference_type, reference_id)
      VALUES (v_promo_result.promotion_id, p_user_id, v_buy_now_price, v_cashback_amount, 'purchase', v_purchase_id::text);
      
      UPDATE public.wallets SET balance = balance + v_cashback_amount, updated_at = now() WHERE user_id = p_user_id;
      
      INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
      VALUES (p_user_id, v_cashback_amount, 'credit_refund', format('Cashback: %s - %s', v_promo_result.name, v_lot.title), 'promotion', v_promo_result.promotion_id::text);
    END IF;
  END IF;

  UPDATE public.lots SET status = 'ended', winner_user_id = p_user_id, current_price = v_buy_now_price, ends_at = now(), updated_at = now() WHERE id = p_lot_id;

  UPDATE public.assets SET status = 'sold', updated_at = now() WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'lot_title', v_lot.title,
    'buy_now_price', v_buy_now_price,
    'return_deadline', v_return_deadline,
    'cashback_amount', v_cashback_amount,
    'promotion_name', v_promo_result.name
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_auction_atomic(p_lot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lot RECORD;
  v_current_bid RECORD;
  v_wallet RECORD;
  v_settings RECORD;
  v_purchase_id uuid;
  v_return_deadline timestamptz;
  v_fallback_offset integer := 0;
  v_user_previous_max_bid numeric;
  v_required_balance numeric;
  v_winner_found boolean := false;
  v_skipped_bidders uuid[] := ARRAY[]::uuid[];
  v_promo_result RECORD;
  v_cashback_amount numeric := 0;
BEGIN
  SELECT * INTO v_lot FROM public.lots WHERE id = p_lot_id FOR UPDATE;

  IF v_lot IS NULL THEN
    RETURN jsonb_build_object('error_code', 'LOT_NOT_FOUND', 'error_message', 'Lote não encontrado');
  END IF;

  IF v_lot.status = 'ended' THEN
    RETURN jsonb_build_object('error_code', 'ALREADY_ENDED', 'error_message', 'Leilão já foi encerrado');
  END IF;

  SELECT * INTO v_settings FROM public.app_settings LIMIT 1;
  v_return_deadline := now() + (COALESCE(v_settings.return_window_hours, 72) || ' hours')::interval;

  LOOP
    SELECT * INTO v_current_bid
    FROM public.bids
    WHERE lot_id = p_lot_id
    ORDER BY amount DESC, created_at ASC
    LIMIT 1 OFFSET v_fallback_offset;

    IF v_current_bid IS NULL THEN EXIT; END IF;

    SELECT MAX(amount) INTO v_user_previous_max_bid
    FROM public.bids
    WHERE lot_id = p_lot_id AND user_id = v_current_bid.user_id AND id != v_current_bid.id;

    IF v_user_previous_max_bid IS NOT NULL THEN
      v_required_balance := v_current_bid.amount - v_user_previous_max_bid;
      IF v_required_balance < 0 THEN v_required_balance := 0; END IF;
    ELSE
      v_required_balance := v_current_bid.amount;
    END IF;

    SELECT balance INTO v_wallet FROM public.wallets WHERE user_id = v_current_bid.user_id FOR UPDATE;

    IF v_wallet.balance IS NOT NULL AND v_wallet.balance >= v_required_balance THEN
      v_winner_found := true;
      
      UPDATE public.wallets SET balance = balance - v_required_balance, updated_at = now() WHERE user_id = v_current_bid.user_id;

      INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
      VALUES (v_current_bid.user_id, -v_required_balance, 'debit_purchase', format('Leilão vencido: %s', v_lot.title), 'purchase', p_lot_id::text);

      INSERT INTO public.purchases (lot_id, buyer_user_id, amount, status, return_deadline_at)
      VALUES (p_lot_id, v_current_bid.user_id, v_current_bid.amount, 'paid', v_return_deadline)
      RETURNING id INTO v_purchase_id;

      SELECT * INTO v_promo_result FROM public.get_active_promotion(v_current_bid.user_id, 'purchase', v_current_bid.amount);
      
      IF v_promo_result IS NOT NULL AND v_promo_result.promotion_id IS NOT NULL THEN
        v_cashback_amount := public.calculate_promotion_benefit(v_promo_result.promotion_id, v_current_bid.amount);
        
        IF v_cashback_amount > 0 THEN
          INSERT INTO public.promotion_usage (promotion_id, user_id, original_amount, benefit_amount, reference_type, reference_id)
          VALUES (v_promo_result.promotion_id, v_current_bid.user_id, v_current_bid.amount, v_cashback_amount, 'purchase', v_purchase_id::text);
          
          UPDATE public.wallets SET balance = balance + v_cashback_amount, updated_at = now() WHERE user_id = v_current_bid.user_id;
          
          INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
          VALUES (v_current_bid.user_id, v_cashback_amount, 'credit_refund', format('Cashback: %s - %s', v_promo_result.name, v_lot.title), 'promotion', v_promo_result.promotion_id::text);
        END IF;
      END IF;

      UPDATE public.lots SET status = 'ended', winner_user_id = v_current_bid.user_id, current_price = v_current_bid.amount, updated_at = now() WHERE id = p_lot_id;

      UPDATE public.assets SET status = 'sold', updated_at = now() WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

      INSERT INTO public.notifications (user_id, type, title, channel, payload)
      VALUES (v_current_bid.user_id, 'auction_won', 'Você venceu o leilão!', 'in_app', jsonb_build_object('lot_id', p_lot_id, 'lot_title', v_lot.title, 'amount', v_current_bid.amount, 'cashback_amount', v_cashback_amount, 'promotion_name', v_promo_result.name));

      EXIT;
    ELSE
      v_skipped_bidders := array_append(v_skipped_bidders, v_current_bid.user_id);
      
      INSERT INTO public.notifications (user_id, type, title, channel, payload)
      VALUES (v_current_bid.user_id, 'auction_payment_failed', 'Saldo insuficiente no encerramento', 'in_app', jsonb_build_object('lot_id', p_lot_id, 'lot_title', v_lot.title, 'bid_amount', v_current_bid.amount, 'required_balance', v_required_balance, 'available_balance', COALESCE(v_wallet.balance, 0)));
      
      v_fallback_offset := v_fallback_offset + 1;
    END IF;
  END LOOP;

  IF NOT v_winner_found THEN
    UPDATE public.lots SET status = 'ended', updated_at = now() WHERE id = p_lot_id;
    UPDATE public.assets SET status = 'available', updated_at = now() WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

    RETURN jsonb_build_object('success', true, 'has_winner', false, 'skipped_bidders', v_skipped_bidders, 'message', 'Leilão encerrado sem vencedor (nenhum licitante com saldo suficiente)');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'has_winner', true,
    'purchase_id', v_purchase_id,
    'winner_id', v_current_bid.user_id,
    'amount', v_current_bid.amount,
    'required_balance', v_required_balance,
    'return_deadline', v_return_deadline,
    'fallback_used', v_fallback_offset > 0,
    'skipped_bidders', v_skipped_bidders,
    'cashback_amount', v_cashback_amount,
    'promotion_name', v_promo_result.name
  );
END;
$function$;