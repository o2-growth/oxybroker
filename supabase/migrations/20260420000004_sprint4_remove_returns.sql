-- Sprint 4 — STORY-022: Remover feature de devolução
-- Tabela returns é mantida para auditoria histórica, mas INSERT é bloqueado.
-- Franqueados não podem mais abrir devoluções. Admin ainda pode consultar/fechar
-- casos pendentes, mas o fluxo está congelado.

-- ============================================================
-- 1. Bloquear INSERT de devoluções (policy drop)
-- ============================================================

DROP POLICY IF EXISTS "returns_insert_own" ON public.returns;

-- Nenhuma policy de INSERT → apenas service_role (que também não será mais usado)

COMMENT ON TABLE public.returns IS
  'DEPRECATED (Sprint 4): feature de devolução removida. Tabela mantida apenas para auditoria de devoluções históricas. INSERT bloqueado via ausência de policy.';

-- ============================================================
-- 2. Marcar funções de devolução como deprecated
-- ============================================================

DO $$
DECLARE
  fn_oid oid;
BEGIN
  FOR fn_oid IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('process_return_atomic', 'request_return_atomic')
  LOOP
    EXECUTE format(
      'COMMENT ON FUNCTION %s IS %L',
      fn_oid::regprocedure,
      'DEPRECATED (Sprint 4): feature de devolução removida. Mantida apenas para compatibilidade; não deve ser chamada por código novo.'
    );
  END LOOP;
END $$;

-- ============================================================
-- 3. Revogar EXECUTE de roles não-admin
-- ============================================================

DO $$
DECLARE
  fn_oid oid;
  fn_sig text;
BEGIN
  FOR fn_oid IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('process_return_atomic', 'request_return_atomic')
  LOOP
    fn_sig := fn_oid::regprocedure::text;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon', fn_sig);
  END LOOP;
END $$;
