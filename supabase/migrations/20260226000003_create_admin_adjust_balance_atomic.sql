-- STORY-003: Fix race condition em admin-adjust-balance
-- Cria função atômica que substitui o fluxo SELECT → UPDATE → INSERT
-- sem transação do edge function original.
--
-- A função usa FOR UPDATE para adquirir lock exclusivo na linha da wallet,
-- garantindo que duas chamadas concorrentes não leiam o mesmo balance
-- e gerem inconsistência no ledger.

CREATE OR REPLACE FUNCTION admin_adjust_balance_atomic(
  p_user_id     UUID,
  p_amount      NUMERIC,  -- positivo = crédito, negativo = débito
  p_reason      TEXT,
  p_admin_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance     NUMERIC;
  v_transaction_id  UUID;
BEGIN
  -- Lock exclusivo na linha da wallet para evitar race condition.
  -- Duas chamadas concorrentes ficam serializadas aqui: a segunda
  -- aguarda até a primeira fazer COMMIT/ROLLBACK antes de continuar.
  SELECT balance
  INTO   v_current_balance
  FROM   wallets
  WHERE  user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Proteção contra saldo negativo
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance: current=%, adjustment=%', v_current_balance, p_amount;
  END IF;

  -- Atualizar saldo atomicamente (mesma transação que o lock acima)
  UPDATE wallets
  SET    balance    = v_new_balance,
         updated_at = NOW()
  WHERE  user_id = p_user_id;

  -- Registrar no ledger de transações
  -- Colunas reais de wallet_transactions:
  --   id, user_id, amount, type (enum), description, reference_id, reference_type, created_at
  -- O admin_id é armazenado em reference_id com reference_type = 'admin_adjustment'
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    reference_type,
    reference_id,
    created_at
  ) VALUES (
    p_user_id,
    p_amount,
    'admin_adjust',
    p_reason,
    'admin_adjustment',
    p_admin_id::TEXT,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success',          true,
    'previous_balance', v_current_balance,
    'new_balance',      v_new_balance,
    'amount',           p_amount,
    'transaction_id',   v_transaction_id
  );
END;
$$;

-- Revogar acesso público — apenas service_role (edge functions) pode chamar
REVOKE ALL ON FUNCTION admin_adjust_balance_atomic(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_adjust_balance_atomic(UUID, NUMERIC, TEXT, UUID) TO service_role;
