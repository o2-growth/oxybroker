-- Create atomic withdrawal function to prevent race conditions
CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_bank_info JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet RECORD;
  v_profile RECORD;
  v_withdrawal_id UUID;
  v_new_balance NUMERIC;
BEGIN
  -- Validate amount
  IF p_amount < 50 THEN
    RETURN jsonb_build_object(
      'error_code', 'AMOUNT_TOO_LOW',
      'error_message', 'Valor mínimo para saque é R$ 50,00'
    );
  END IF;

  -- Check profile and can_withdraw permission
  SELECT can_withdraw, full_name INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'PROFILE_NOT_FOUND',
      'error_message', 'Perfil não encontrado'
    );
  END IF;

  IF NOT v_profile.can_withdraw THEN
    RETURN jsonb_build_object(
      'error_code', 'WITHDRAWAL_NOT_ALLOWED',
      'error_message', 'Saque não habilitado para sua conta. Entre em contato com o administrador.'
    );
  END IF;

  -- Lock wallet for update (prevents race conditions)
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

  -- Check balance
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object(
      'error_code', 'INSUFFICIENT_BALANCE',
      'error_message', format('Saldo insuficiente. Seu saldo: R$ %s', 
        to_char(v_wallet.balance, 'FM999G999D00'))
    );
  END IF;

  v_new_balance := v_wallet.balance - p_amount;

  -- Atomic: Debit wallet
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Atomic: Create withdrawal record
  INSERT INTO public.withdrawals (user_id, amount, status, bank_info)
  VALUES (p_user_id, p_amount, 'pending', p_bank_info)
  RETURNING id INTO v_withdrawal_id;

  -- Atomic: Create wallet transaction
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (
    p_user_id, 
    -p_amount, 
    'withdrawal', 
    'Solicitação de saque',
    'withdrawal',
    v_withdrawal_id::text
  );

  -- Create admin alert
  INSERT INTO public.admin_alerts (type, title, message, metadata)
  VALUES (
    'withdrawal_request',
    'Nova solicitação de saque',
    format('%s solicitou saque de R$ %s', COALESCE(v_profile.full_name, 'Usuário'), to_char(p_amount, 'FM999G999D00')),
    jsonb_build_object(
      'withdrawal_id', v_withdrawal_id,
      'user_id', p_user_id,
      'amount', p_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'new_balance', v_new_balance,
    'message', 'Solicitação de saque enviada com sucesso'
  );
END;
$$;