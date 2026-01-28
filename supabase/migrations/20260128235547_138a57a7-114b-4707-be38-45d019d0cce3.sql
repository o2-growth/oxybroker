-- =============================================
-- 1. Create credit_wallet atomic function
-- =============================================
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Lock wallet for update
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'WALLET_NOT_FOUND',
      'error_message', 'Carteira não encontrada'
    );
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'error_code', 'INVALID_AMOUNT',
      'error_message', 'Valor deve ser maior que zero'
    );
  END IF;

  v_new_balance := v_wallet.balance + p_amount;

  -- Update wallet
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (p_user_id, p_amount, 'topup', p_description, p_reference_type, p_reference_id)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );
END;
$$;

-- =============================================
-- 2. Create transfer_balance_atomic function
-- =============================================
CREATE OR REPLACE FUNCTION public.transfer_balance_atomic(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_wallet RECORD;
  v_to_wallet RECORD;
  v_transfer_id UUID;
  v_new_from_balance NUMERIC;
  v_new_to_balance NUMERIC;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'error_code', 'INVALID_AMOUNT',
      'error_message', 'Valor deve ser maior que zero'
    );
  END IF;

  -- Prevent self-transfer
  IF p_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object(
      'error_code', 'SELF_TRANSFER',
      'error_message', 'Não é possível transferir para si mesmo'
    );
  END IF;

  -- Lock sender wallet
  SELECT * INTO v_from_wallet
  FROM public.wallets
  WHERE user_id = p_from_user_id
  FOR UPDATE;

  IF v_from_wallet IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'SENDER_WALLET_NOT_FOUND',
      'error_message', 'Carteira do remetente não encontrada'
    );
  END IF;

  -- Check balance
  IF v_from_wallet.balance < p_amount THEN
    RETURN jsonb_build_object(
      'error_code', 'INSUFFICIENT_BALANCE',
      'error_message', format('Saldo insuficiente. Seu saldo: R$ %s', 
        to_char(v_from_wallet.balance, 'FM999G999D00'))
    );
  END IF;

  -- Lock recipient wallet
  SELECT * INTO v_to_wallet
  FROM public.wallets
  WHERE user_id = p_to_user_id
  FOR UPDATE;

  IF v_to_wallet IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'RECIPIENT_WALLET_NOT_FOUND',
      'error_message', 'Carteira do destinatário não encontrada'
    );
  END IF;

  v_new_from_balance := v_from_wallet.balance - p_amount;
  v_new_to_balance := v_to_wallet.balance + p_amount;

  -- Debit sender
  UPDATE public.wallets
  SET balance = v_new_from_balance, updated_at = now()
  WHERE user_id = p_from_user_id;

  -- Credit recipient
  UPDATE public.wallets
  SET balance = v_new_to_balance, updated_at = now()
  WHERE user_id = p_to_user_id;

  -- Record transfer
  INSERT INTO public.transfers (from_user_id, to_user_id, amount, type, status)
  VALUES (p_from_user_id, p_to_user_id, p_amount, 'balance', 'completed')
  RETURNING id INTO v_transfer_id;

  -- Record wallet transactions
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES 
    (p_from_user_id, -p_amount, 'transfer_out', 'Transferência enviada', 'transfer', v_transfer_id::text),
    (p_to_user_id, p_amount, 'transfer_in', 'Transferência recebida', 'transfer', v_transfer_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'amount', p_amount,
    'new_balance', v_new_from_balance
  );
END;
$$;

-- =============================================
-- 3. Create process_return_atomic function
-- =============================================
CREATE OR REPLACE FUNCTION public.process_return_atomic(p_return_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_return RECORD;
  v_purchase RECORD;
  v_wallet RECORD;
  v_new_balance NUMERIC;
BEGIN
  -- Get return with purchase info
  SELECT r.*, p.buyer_user_id, p.amount, p.lot_id, l.title as lot_title
  INTO v_return
  FROM public.returns r
  JOIN public.purchases p ON r.purchase_id = p.id
  JOIN public.lots l ON p.lot_id = l.id
  WHERE r.id = p_return_id
  FOR UPDATE;

  IF v_return IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'RETURN_NOT_FOUND',
      'error_message', 'Devolução não encontrada'
    );
  END IF;

  IF v_return.status != 'approved' THEN
    RETURN jsonb_build_object(
      'error_code', 'INVALID_STATUS',
      'error_message', 'Devolução deve estar aprovada para ser processada'
    );
  END IF;

  -- Lock buyer wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_return.buyer_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'WALLET_NOT_FOUND',
      'error_message', 'Carteira do comprador não encontrada'
    );
  END IF;

  v_new_balance := v_wallet.balance + v_return.amount;

  -- Credit buyer wallet
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = v_return.buyer_user_id;

  -- Record refund transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (
    v_return.buyer_user_id, 
    v_return.amount, 
    'credit_refund', 
    format('Reembolso: %s', v_return.lot_title),
    'return',
    p_return_id::text
  );

  -- Update purchase status
  UPDATE public.purchases
  SET status = 'refunded'
  WHERE id = v_return.purchase_id;

  -- Update return status
  UPDATE public.returns
  SET status = 'processed', processed_at = now()
  WHERE id = p_return_id;

  -- Update assets back to available
  UPDATE public.assets
  SET status = 'available', updated_at = now()
  WHERE id IN (SELECT asset_id FROM public.lot_items WHERE lot_id = v_return.lot_id);

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, channel, payload)
  VALUES (
    v_return.buyer_user_id,
    'return_processed',
    'Devolução processada',
    'in_app',
    jsonb_build_object(
      'return_id', p_return_id,
      'refunded_amount', v_return.amount,
      'lot_title', v_return.lot_title
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'refunded_amount', v_return.amount,
    'new_balance', v_new_balance
  );
END;
$$;

-- =============================================
-- 4. Fix bids RLS policy - restrict to own bids + lot participants + admins
-- =============================================
DROP POLICY IF EXISTS "bids_select_authenticated" ON public.bids;

CREATE POLICY "bids_select_lot_participants"
ON public.bids
FOR SELECT
USING (
  -- Users can see bids on lots they have bid on (to track competition)
  lot_id IN (SELECT b.lot_id FROM public.bids b WHERE b.user_id = auth.uid())
  OR is_admin()
  OR is_oxy_hacker()
);

-- =============================================
-- 5. Fix profiles RLS policy - restrict email access
-- =============================================

-- Drop existing profile select policies to recreate with proper restrictions
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_oxy_hacker" ON public.profiles;

-- Own profile: full access
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admin: full access to all profiles
CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
USING (is_admin());

-- Oxy hacker: view profiles for audit (limited fields handled at app level)
CREATE POLICY "profiles_select_oxy_hacker"
ON public.profiles
FOR SELECT
USING (is_oxy_hacker());