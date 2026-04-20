-- Sprint 4 — STORY-020: Reset de leilões ativos para começar do zero com single_lead
-- Destrutivo por design (autorizado pelo negócio): cancela todos os lotes não encerrados.
-- Vendas históricas (purchases) e transações de wallet permanecem intactas para auditoria.

-- ============================================================
-- 1. Cancelar todos os lotes não encerrados
-- ============================================================

-- Libera ativos vinculados aos lotes cancelados (voltam para 'available')
UPDATE public.assets a
   SET status     = 'available',
       updated_at = now()
  FROM public.lot_items li
  JOIN public.lots l ON l.id = li.lot_id
 WHERE li.asset_id = a.id
   AND l.status IN ('draft', 'live')
   AND a.status = 'in_auction';

-- Cancela lotes não encerrados
UPDATE public.lots
   SET status      = 'cancelled',
       ends_at     = COALESCE(ends_at, now()),
       updated_at  = now()
 WHERE status IN ('draft', 'live');

-- ============================================================
-- 2. Comentário explicativo
-- ============================================================

COMMENT ON TYPE public.auction_type IS
  'Sprint 4: lotes criados a partir de 2026-04-20 devem ser single_lead (via promote_lead_to_auction). Bundle fica como feature secundária para agrupamentos manuais do admin.';
