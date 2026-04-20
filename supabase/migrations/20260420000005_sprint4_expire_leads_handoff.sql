-- Sprint 4 — STORY-021: Função para marcar leads expirados sem venda
-- Chamada pelo job close-auctions quando lote single_lead encerra sem vencedor.
-- Marca lead em leads_inbox como 'expired' e sinaliza pronto para handoff Pipefy.

-- ============================================================
-- 1. Função expire_unsold_lead
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_unsold_lead(
  p_lot_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot       RECORD;
  v_lead_id   UUID;
BEGIN
  SELECT id, auction_type, lead_inbox_id, status
    INTO v_lot
    FROM public.lots
   WHERE id = p_lot_id;

  IF v_lot IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_FOUND',
      'error_message', 'Lote não encontrado'
    );
  END IF;

  IF v_lot.auction_type <> 'single_lead' OR v_lot.lead_inbox_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'skipped', true,
      'reason', 'Lote não é single_lead ou não referencia lead do inbox'
    );
  END IF;

  v_lead_id := v_lot.lead_inbox_id;

  UPDATE public.leads_inbox
     SET status      = 'expired',
         expired_at  = COALESCE(expired_at, now()),
         updated_at  = now()
   WHERE id = v_lead_id
     AND status = 'in_auction';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'skipped', true,
      'reason', 'Lead não está em status in_auction'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_inbox_id', v_lead_id,
    'ready_for_pipefy_handoff', true
  );
END;
$$;

COMMENT ON FUNCTION public.expire_unsold_lead IS
  'Marca lead em leads_inbox como expired quando single_lead lot encerra sem vencedor. Idempotente. Chamada pelo Edge Function close-auctions após close_auction_atomic sem winner.';

GRANT EXECUTE ON FUNCTION public.expire_unsold_lead TO service_role;

-- ============================================================
-- 2. Marca lead como sold_auction quando leilão encerra com vencedor
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_lead_sold_auction(
  p_lot_id       UUID,
  p_purchase_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot     RECORD;
BEGIN
  SELECT id, auction_type, lead_inbox_id
    INTO v_lot
    FROM public.lots
   WHERE id = p_lot_id;

  IF v_lot IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_FOUND',
      'error_message', 'Lote não encontrado'
    );
  END IF;

  IF v_lot.auction_type <> 'single_lead' OR v_lot.lead_inbox_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  UPDATE public.leads_inbox
     SET status       = 'sold_auction',
         purchase_id  = p_purchase_id,
         updated_at   = now()
   WHERE id = v_lot.lead_inbox_id
     AND status = 'in_auction';

  RETURN jsonb_build_object(
    'success', true,
    'lead_inbox_id', v_lot.lead_inbox_id,
    'purchase_id', p_purchase_id
  );
END;
$$;

COMMENT ON FUNCTION public.mark_lead_sold_auction IS
  'Marca lead em leads_inbox como sold_auction quando single_lead lot encerra com vencedor. Idempotente.';

GRANT EXECUTE ON FUNCTION public.mark_lead_sold_auction TO service_role;

-- ============================================================
-- 3. View de leads prontos para handoff Pipefy Matriz
-- ============================================================

CREATE OR REPLACE VIEW public.leads_pending_pipefy_handoff AS
SELECT
  id,
  razao_social,
  cnpj,
  setor,
  faturamento_bracket,
  contato_nome,
  contato_telefone,
  contato_email,
  contato_cargo,
  origem,
  observacoes,
  payload_raw,
  received_at,
  expired_at
FROM public.leads_inbox
WHERE status = 'expired'
  AND pipefy_sent_at IS NULL;

COMMENT ON VIEW public.leads_pending_pipefy_handoff IS
  'Leads que expiraram no leilão sem venda e ainda não foram enviados ao Pipefy Matriz. Consumida pela Edge Function pipefy-handoff.';

ALTER VIEW public.leads_pending_pipefy_handoff OWNER TO postgres;

-- RLS: admin pode consultar
GRANT SELECT ON public.leads_pending_pipefy_handoff TO authenticated;

-- ============================================================
-- 4. Índice de suporte para a view
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_inbox_expired_pending_pipefy
  ON public.leads_inbox(expired_at DESC)
  WHERE status = 'expired' AND pipefy_sent_at IS NULL;
