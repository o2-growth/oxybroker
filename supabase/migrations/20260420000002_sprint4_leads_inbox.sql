-- Sprint 4 — STORY-018: leads_inbox + webhook intake
-- Tabela que recebe leads via webhook (n8n orquestrando Meta/Google) antes de irem para leilão

-- ============================================================
-- 1. Enum de status do lead no inbox
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.lead_inbox_status AS ENUM (
    'pending_review',    -- acabou de chegar via webhook, precisa triagem
    'approved',          -- aprovado, pronto para ir a leilão ou buy_now pre-auction
    'rejected',          -- dados insuficientes, descartado
    'in_auction',        -- lot live criado a partir desse lead
    'sold_pre_auction',  -- comprado via Buy Now antes de ir a leilão
    'sold_auction',      -- vendido no leilão
    'expired'            -- leilão encerrou sem venda → Pipefy Matriz
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE public.lead_inbox_status IS
  'Status do lead no inbox. Fluxo: pending_review → approved → (in_auction | sold_pre_auction) → (sold_auction | expired).';

-- ============================================================
-- 2. Tabela leads_inbox
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads_inbox (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados da empresa
  razao_social        TEXT        NOT NULL,
  cnpj                TEXT,
  setor               TEXT        NOT NULL,
  faturamento_bracket public.revenue_bracket NOT NULL,

  -- Dados de contato (sensíveis — blur pré-compra)
  contato_nome        TEXT        NOT NULL,
  contato_telefone    TEXT,
  contato_email       TEXT,
  contato_cargo       TEXT,

  -- Metadados
  origem              TEXT        NOT NULL,          -- 'meta_ads', 'google_ads', 'manual', etc.
  observacoes         TEXT,
  payload_raw         JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Estado
  status              public.lead_inbox_status NOT NULL DEFAULT 'pending_review',
  price_cached        NUMERIC(10,2),                 -- cache do preço calculado na aprovação
  lot_id              UUID        REFERENCES public.lots(id) ON DELETE SET NULL,
  purchase_id         UUID        REFERENCES public.purchases(id) ON DELETE SET NULL,

  -- Auditoria
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at         TIMESTAMPTZ,
  approved_by         UUID        REFERENCES auth.users(id),
  rejected_at         TIMESTAMPTZ,
  rejected_by         UUID        REFERENCES auth.users(id),
  rejection_reason    TEXT,
  expired_at          TIMESTAMPTZ,
  pipefy_sent_at      TIMESTAMPTZ,
  pipefy_card_id      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leads_inbox IS
  'Recebe leads via webhook (n8n→Meta/Google) para triagem antes de ir a leilão. INSERT apenas via service_role (webhook Edge Function).';

-- ============================================================
-- 3. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_inbox_status
  ON public.leads_inbox(status);

CREATE INDEX IF NOT EXISTS idx_leads_inbox_status_received
  ON public.leads_inbox(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_inbox_bracket
  ON public.leads_inbox(faturamento_bracket);

CREATE INDEX IF NOT EXISTS idx_leads_inbox_origem
  ON public.leads_inbox(origem);

CREATE INDEX IF NOT EXISTS idx_leads_inbox_cnpj
  ON public.leads_inbox(cnpj)
  WHERE cnpj IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_inbox_pending
  ON public.leads_inbox(received_at DESC)
  WHERE status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_leads_inbox_lot
  ON public.leads_inbox(lot_id)
  WHERE lot_id IS NOT NULL;

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.leads_inbox_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_inbox_updated_at ON public.leads_inbox;
CREATE TRIGGER trg_leads_inbox_updated_at
  BEFORE UPDATE ON public.leads_inbox
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_inbox_set_updated_at();

-- ============================================================
-- 5. RLS — apenas admin lê/edita; INSERT exclusivo via service_role (webhook)
-- ============================================================

ALTER TABLE public.leads_inbox ENABLE ROW LEVEL SECURITY;

-- SELECT: admin vê tudo
CREATE POLICY "leads_inbox_select_admin"
  ON public.leads_inbox
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- UPDATE: admin aprova/rejeita/edita
CREATE POLICY "leads_inbox_update_admin"
  ON public.leads_inbox
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE: apenas admin (raro — normalmente marca como rejected)
CREATE POLICY "leads_inbox_delete_admin"
  ON public.leads_inbox
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT: nenhuma policy → apenas service_role (Edge Function lead-webhook-intake)

COMMENT ON POLICY "leads_inbox_select_admin" ON public.leads_inbox IS
  'Apenas admins visualizam o inbox. Franquias só veem leads via lots (leilão) ou purchases (pós-compra).';

-- ============================================================
-- 6. API keys para webhook (autenticação do n8n)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,                    -- 'n8n-meta-ads', 'n8n-google-ads', 'manual'
  key_hash      TEXT        NOT NULL UNIQUE,             -- SHA-256 da chave
  scope         TEXT[]      NOT NULL DEFAULT '{leads_inbox}'::text[],
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID        REFERENCES auth.users(id),
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID        REFERENCES auth.users(id)
);

COMMENT ON TABLE public.webhook_api_keys IS
  'Chaves de API para autenticar webhooks externos. Apenas hash SHA-256 é armazenado. Admin gerencia via AdminSettings.';

ALTER TABLE public.webhook_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_api_keys_admin_all"
  ON public.webhook_api_keys
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_webhook_api_keys_active
  ON public.webhook_api_keys(key_hash)
  WHERE is_active = TRUE AND revoked_at IS NULL;
