-- =============================================================================
-- STORY-002: Fix RLS withdrawals bypass do fluxo atomico
-- Prioridade: P0 | Risco: CRITICO
--
-- Problema: a policy "withdrawals_insert_own" (auth.uid() = user_id) permite
-- que qualquer usuario autenticado insira diretamente na tabela withdrawals
-- via Supabase JS client, bypassando o Edge Function "request-withdrawal"
-- que executa request_withdrawal_atomic.
--
-- O fluxo correto e:
--   Cliente → Edge Function request-withdrawal (service_role)
--             → funcao request_withdrawal_atomic
--               → verifica can_withdraw
--               → debita saldo atomicamente
--               → cria wallet_transaction
--               → insere em withdrawals
--
-- O INSERT direto bypassa tudo: o usuario registra um saque sem que o saldo
-- seja debitado, sem verificacao de can_withdraw, sem wallet_transaction.
--
-- Solucao: dropar a policy de INSERT. O service_role bypassa RLS por padrao
-- no Supabase — nenhuma alteracao na Edge Function e necessaria.
-- As policies de SELECT permanecem intactas.
-- =============================================================================

-- 1. Remover a policy de INSERT que permite acesso direto pelo cliente
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;

-- 2. RESULTADO apos o DROP:
--    - INSERT em withdrawals: BLOQUEADO para usuarios autenticados via JS client
--    - INSERT via service_role (Edge Function): PERMITIDO (bypassa RLS por padrao)
--    - SELECT proprio: INTACTO via "withdrawals_select_own"
--    - SELECT admin: INTACTO via "withdrawals_select_admin"
--    - UPDATE admin: INTACTO via "withdrawals_update_admin"

-- 3. Documentacao na tabela
COMMENT ON TABLE public.withdrawals IS
  'Saques de saldo. Insercao EXCLUSIVA via Edge Function "request-withdrawal" '
  '(service_role key — bypassa RLS automaticamente). '
  'INSERT direto pelo cliente e bloqueado por RLS para garantir que '
  'request_withdrawal_atomic seja sempre executado: verifica can_withdraw, '
  'debita saldo e registra wallet_transaction de forma atomica.';
