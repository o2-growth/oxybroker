-- 1. Adicionar coluna can_withdraw na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN can_withdraw boolean NOT NULL DEFAULT false;

-- 2. Adicionar valor withdrawal ao enum wallet_transaction_type
ALTER TYPE public.wallet_transaction_type ADD VALUE 'withdrawal';

-- 3. Criar enum de status de saque
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending', 
  'approved', 
  'rejected', 
  'completed'
);

-- 4. Criar tabela withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 50),
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  bank_info jsonb NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid,
  notes text
);

-- 5. Habilitar RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 6. Politicas RLS para withdrawals
CREATE POLICY "withdrawals_select_own" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "withdrawals_select_admin" ON public.withdrawals
  FOR SELECT USING (is_admin());

CREATE POLICY "withdrawals_update_admin" ON public.withdrawals
  FOR UPDATE USING (is_admin());

CREATE POLICY "withdrawals_select_oxy_hacker" ON public.withdrawals
  FOR SELECT USING (is_oxy_hacker());