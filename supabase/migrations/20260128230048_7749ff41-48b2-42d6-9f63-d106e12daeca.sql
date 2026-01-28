-- Primeiro: adicionar novos valores ao enum e criar as funções

-- 1. Adicionar 'mql' e 'client' ao enum asset_type
ALTER TYPE public.asset_type ADD VALUE IF NOT EXISTS 'mql';
ALTER TYPE public.asset_type ADD VALUE IF NOT EXISTS 'client';

-- 2. Criar função atômica para buy-now
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
BEGIN
  -- Lock the lot row for update (prevents race conditions)
  SELECT * INTO v_lot
  FROM public.lots
  WHERE id = p_lot_id
  FOR UPDATE;

  -- Validate lot exists
  IF v_lot IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_FOUND',
      'error_message', 'Lote não encontrado'
    );
  END IF;

  -- Validate lot is live
  IF v_lot.status != 'live' THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_LIVE',
      'error_message', 'Este leilão não está ativo ou já foi encerrado'
    );
  END IF;

  -- Validate lot hasn't ended
  IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at < now() THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_ENDED',
      'error_message', 'Este leilão já foi encerrado'
    );
  END IF;

  -- Calculate buy now price (1.8x of current_price, or starting_price if no bids)
  v_buy_now_price := round(
    CASE 
      WHEN v_lot.current_price > v_lot.starting_price THEN v_lot.current_price * 1.8
      ELSE v_lot.starting_price * 1.8
    END, 
    2
  );

  -- Validate user has sufficient balance (lock wallet to prevent race condition)
  SELECT balance INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet.balance IS NULL OR v_wallet.balance < v_buy_now_price THEN
    RETURN jsonb_build_object(
      'error_code', 'INSUFFICIENT_BALANCE',
      'error_message', format('Saldo insuficiente. Preço de compra imediata: R$ %s. Seu saldo: R$ %s', 
        to_char(v_buy_now_price, 'FM999G999D00'),
        COALESCE(to_char(v_wallet.balance, 'FM999G999D00'), '0,00'))
    );
  END IF;

  -- Get app settings for return window
  SELECT * INTO v_settings
  FROM public.app_settings
  LIMIT 1;
  
  v_return_deadline := now() + (COALESCE(v_settings.return_window_hours, 72) || ' hours')::interval;

  -- Debit wallet
  UPDATE public.wallets
  SET balance = balance - v_buy_now_price,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Create wallet transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (
    p_user_id, 
    -v_buy_now_price, 
    'debit_purchase', 
    format('Compra imediata: %s', v_lot.title),
    'purchase',
    p_lot_id::text
  );

  -- Create purchase record
  INSERT INTO public.purchases (lot_id, buyer_user_id, amount, status, return_deadline_at)
  VALUES (p_lot_id, p_user_id, v_buy_now_price, 'paid', v_return_deadline)
  RETURNING id INTO v_purchase_id;

  -- Update lot status to ended with winner
  UPDATE public.lots
  SET 
    status = 'ended',
    winner_user_id = p_user_id,
    current_price = v_buy_now_price,
    ends_at = now(),
    updated_at = now()
  WHERE id = p_lot_id;

  -- Update related assets status to 'sold'
  UPDATE public.assets
  SET status = 'sold', updated_at = now()
  WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

  -- Return success with purchase details
  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'lot_title', v_lot.title,
    'buy_now_price', v_buy_now_price,
    'return_deadline', v_return_deadline
  );
END;
$function$;

-- 3. Criar função para encerrar leilões automaticamente (close_auction_atomic)
CREATE OR REPLACE FUNCTION public.close_auction_atomic(p_lot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lot RECORD;
  v_highest_bid RECORD;
  v_wallet RECORD;
  v_settings RECORD;
  v_purchase_id uuid;
  v_return_deadline timestamptz;
BEGIN
  -- Lock the lot row for update
  SELECT * INTO v_lot
  FROM public.lots
  WHERE id = p_lot_id
  FOR UPDATE;

  -- Validate lot exists
  IF v_lot IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_FOUND',
      'error_message', 'Lote não encontrado'
    );
  END IF;

  -- Check if already ended
  IF v_lot.status = 'ended' THEN
    RETURN jsonb_build_object(
      'error_code', 'ALREADY_ENDED',
      'error_message', 'Leilão já foi encerrado'
    );
  END IF;

  -- Get highest bid
  SELECT * INTO v_highest_bid
  FROM public.bids
  WHERE lot_id = p_lot_id
  ORDER BY amount DESC
  LIMIT 1;

  -- If no bids, just end the lot without winner
  IF v_highest_bid IS NULL THEN
    UPDATE public.lots
    SET 
      status = 'ended',
      updated_at = now()
    WHERE id = p_lot_id;

    -- Release assets back to available
    UPDATE public.assets
    SET status = 'available', updated_at = now()
    WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

    RETURN jsonb_build_object(
      'success', true,
      'has_winner', false,
      'message', 'Leilão encerrado sem vencedor'
    );
  END IF;

  -- Lock winner's wallet
  SELECT balance INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_highest_bid.user_id
  FOR UPDATE;

  -- Check if winner has sufficient balance
  IF v_wallet.balance IS NULL OR v_wallet.balance < v_highest_bid.amount THEN
    UPDATE public.lots
    SET 
      status = 'ended',
      winner_user_id = v_highest_bid.user_id,
      updated_at = now()
    WHERE id = p_lot_id;

    RETURN jsonb_build_object(
      'success', true,
      'has_winner', true,
      'payment_failed', true,
      'winner_id', v_highest_bid.user_id,
      'message', 'Vencedor sem saldo suficiente'
    );
  END IF;

  -- Get app settings for return window
  SELECT * INTO v_settings
  FROM public.app_settings
  LIMIT 1;
  
  v_return_deadline := now() + (COALESCE(v_settings.return_window_hours, 72) || ' hours')::interval;

  -- Debit wallet
  UPDATE public.wallets
  SET balance = balance - v_highest_bid.amount,
      updated_at = now()
  WHERE user_id = v_highest_bid.user_id;

  -- Create wallet transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (
    v_highest_bid.user_id, 
    -v_highest_bid.amount, 
    'debit_purchase', 
    format('Leilão vencido: %s', v_lot.title),
    'purchase',
    p_lot_id::text
  );

  -- Create purchase record
  INSERT INTO public.purchases (lot_id, buyer_user_id, amount, status, return_deadline_at)
  VALUES (p_lot_id, v_highest_bid.user_id, v_highest_bid.amount, 'paid', v_return_deadline)
  RETURNING id INTO v_purchase_id;

  -- Update lot status
  UPDATE public.lots
  SET 
    status = 'ended',
    winner_user_id = v_highest_bid.user_id,
    updated_at = now()
  WHERE id = p_lot_id;

  -- Update related assets status to 'sold'
  UPDATE public.assets
  SET status = 'sold', updated_at = now()
  WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = p_lot_id);

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'has_winner', true,
    'purchase_id', v_purchase_id,
    'winner_id', v_highest_bid.user_id,
    'amount', v_highest_bid.amount,
    'return_deadline', v_return_deadline
  );
END;
$function$;