-- =============================================================================
-- STORY-001: Fix RLS privilege escalation em profiles
-- Prioridade: P0 | Risco: CRITICO
--
-- Problema: a policy "profiles_update_own" existente tem apenas
--   USING (auth.uid() = id) e WITH CHECK (auth.uid() = id)
-- Isso permite que qualquer usuario autenticado execute:
--   UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()
-- Os campos role, can_withdraw e suspended_at sao editaveis livremente.
--
-- Solucao: substituir por policy com WITH CHECK que trava campos privilegiados,
-- garantindo que role, can_withdraw e suspended_at nao possam ser alterados
-- diretamente pelo proprio usuario via Supabase JS client.
-- =============================================================================

-- 1. Remover a policy vulneravel atual
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2. Criar policy de UPDATE restrita
--    USING  : o usuario so pode tentar atualizar o proprio registro
--    WITH CHECK: pos-UPDATE, os campos privilegiados devem ser identicos
--               ao valor que estava no banco antes da operacao.
--    O Postgres avalia WITH CHECK sobre a linha resultante — a subquery
--    le o valor atual (snapshot antes do UPDATE via READ COMMITTED) e
--    compara com o valor que o cliente tentou gravar.
--    Se o cliente tentar mudar role = 'admin', o WITH CHECK falha e o
--    UPDATE inteiro e rejeitado com "new row violates row-level security".
CREATE POLICY "profiles_update_own_restricted"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- role nao pode ser alterado pelo proprio usuario
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    -- can_withdraw nao pode ser alterado pelo proprio usuario
    AND can_withdraw = (SELECT p.can_withdraw FROM public.profiles p WHERE p.id = auth.uid())
    -- suspended_at nao pode ser alterado pelo proprio usuario
    AND suspended_at IS NOT DISTINCT FROM (SELECT p.suspended_at FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 3. Garantir que a policy de SELECT proprio existe
--    (ja criada em migracao anterior, mas incluida com IF NOT EXISTS para idempotencia)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "profiles_select_own"
        ON public.profiles
        FOR SELECT
        USING (auth.uid() = id)
    $policy$;
  END IF;
END;
$$;

-- 4. Documentacao inline
COMMENT ON POLICY "profiles_update_own_restricted" ON public.profiles IS
  'Permite usuario atualizar apenas campos de perfil publico (full_name, avatar_url, email, etc). '
  'Campos privilegiados (role, can_withdraw, suspended_at) sao imutaveis via cliente — '
  'requerem Edge Function com service_role para serem alterados.';
