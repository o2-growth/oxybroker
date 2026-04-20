# Sprint 4 — Enhancements do Negócio

**Data:** 2026-04-20
**Branch:** `feat/sprint4-lead-individual-auctions`
**Status:** implementação concluída, QA pendente

Sprint de melhorias funcionais trazidas pelo time de negócio, migrando a plataforma do
modelo de "lotes/bundle" para leilões de leads individuais alimentados por webhook.

## Objetivos estratégicos

1. **Leilão por lead individual** como novo padrão (bundle vira feature secundária)
2. **Webhook intake** (n8n → Meta/Google Ads → leads_inbox)
3. **Triagem admin** antes do leilão (aprovar / rejeitar)
4. **Precificação dinâmica** por faixa de faturamento (multiplicadores editáveis)
5. **Anti-sniping refinado**: SLA de 10 min, extensões de 10s (máx 10)
6. **Buy Now pré-leilão** com premium de 1.8x
7. **Handoff Pipefy** para leads que expiram sem venda
8. **Remover feature de devolução** por completo

## Backlog implementado

| ID | Story | Status | Arquivos-chave |
| --- | --- | --- | --- |
| S4-018 | leads_inbox + webhook intake | done | `20260420000002_sprint4_leads_inbox.sql`, `functions/lead-webhook-intake/` |
| S4-019 | Multiplicadores + MQL base | done | `20260420000001_sprint4_pricing_config.sql` |
| S4-020 | Leilão por lead individual | done | `20260420000003_sprint4_lots_single_lead.sql`, `20260420000006_sprint4_reset_auctions.sql` |
| S4-021 | SLA 10min + anti-sniping + Pipefy expiração | done | `20260420000003` (place_bid_atomic), `20260420000005_sprint4_expire_leads_handoff.sql` |
| S4-022 | Remover devolução | done | `20260420000004_sprint4_remove_returns.sql`, `Purchases.tsx`, `usePurchases.ts` |
| S4-023 | Limpeza mensal de leilões | done | `useMyAuctions.ts` (filtro por mês) |
| S4-024 | Blur pré-compra | done | `components/marketplace/BlurredText.tsx` |
| S4-025 | Buy Now pré-leilão 1.8x | done | `useBuyNow.ts`, `buy_now_lead_pre_auction` RPC |
| S4-026 | Copiar dados do lead | done | `components/marketplace/CopyLeadDataButton.tsx` |
| S4-027 | Admin inbox UI + multiplicadores | done | `pages/admin/AdminLeadsInbox.tsx`, `AdminSettings.tsx` |
| S4-028 | Pipefy handoff (stub) | stubbed | `functions/pipefy-handoff/index.ts` — credenciais pendentes |
| S4-029 | Docs Sprint 4 | done | este documento |

## Schema — migrações Sprint 4

1. **`20260420000001_sprint4_pricing_config.sql`**
   - `app_settings` ganha `mql_base_value`, `bracket_multipliers`, `buy_now_premium_multiplier`, `sla_minutes`, `max_sniping_extensions`
   - `bidding_extension_seconds` atualizado de 30s → 10s
   - Novo enum `revenue_bracket` (`200k_350k`, `350k_500k`, `500k_1m`, `1m_5m`, `5m_plus`)
   - Função `calculate_lead_price(bracket, is_pre_auction)` — usa premium 1.8x quando `is_pre_auction=true`

2. **`20260420000002_sprint4_leads_inbox.sql`**
   - Nova tabela `leads_inbox` com enum `lead_inbox_status` (pending_review → approved → in_auction → sold/expired)
   - RLS: admin full access, INSERT bloqueado (apenas service_role via Edge Function)
   - Nova tabela `webhook_api_keys` (hash SHA-256) para autenticar webhook

3. **`20260420000003_sprint4_lots_single_lead.sql`**
   - Enum `auction_type` (`single_lead` | `bundle`)
   - `lots` ganha `auction_type`, `lead_inbox_id`, `extension_count`
   - `place_bid_atomic` atualizado: janela anti-sniping de 1 min, extensão de `bidding_extension_seconds`, máx `max_sniping_extensions`
   - Nova função `promote_lead_to_auction(lead_id, created_by, custom_duration_minutes)` — cria lot single_lead a partir de lead approved
   - Nova função `buy_now_lead_pre_auction(lead_id, buyer_id)` — premium 1.8x, cria lot "fantasma" + purchase

4. **`20260420000004_sprint4_remove_returns.sql`**
   - Droppa policy `returns_insert_own` → bloqueia devolução nova
   - Marca funções `request_return_atomic` e `process_return_atomic` como deprecated, revoga EXECUTE de `authenticated`/`anon`

5. **`20260420000005_sprint4_expire_leads_handoff.sql`**
   - Função `expire_unsold_lead(lot_id)` — marca lead como `expired` quando single_lead lot encerra sem vencedor
   - Função `mark_lead_sold_auction(lot_id, purchase_id)` — marca lead como `sold_auction`
   - View `leads_pending_pipefy_handoff` — leads expirados ainda não enviados ao Pipefy

6. **`20260420000006_sprint4_reset_auctions.sql`**
   - Cancela todos os lotes em `draft` ou `live` (destrutivo por design — autorizado pelo negócio)
   - Libera assets vinculados (volta para `available`)
   - Preserva purchases e wallet_transactions históricas

## Fluxos novos

### 1. Intake de leads

```
n8n (Meta/Google Ads)
  → POST /functions/v1/lead-webhook-intake (header: x-api-key)
  → validação + hash SHA-256 check em webhook_api_keys
  → INSERT em leads_inbox (status='pending_review')
```

### 2. Triagem → leilão

```
Admin abre /admin/leads-inbox
  → aprova lead via useApproveLead
  → RPC promote_lead_to_auction
    - calcula preço via calculate_lead_price(bracket, FALSE)
    - cria lot com auction_type='single_lead', duration=sla_minutes
    - atualiza lead.status='in_auction'
```

### 3. Anti-sniping

```
Lance chega com amount >= current + min_increment
  → SE now() + 1min > ends_at E extension_count < max_sniping_extensions:
      - ends_at += bidding_extension_seconds (10s)
      - extension_count += 1
      - was_extended=true
```

### 4. Fim do leilão

```
close-auctions (cron) identifica lots com ends_at <= now()
  → close_auction_atomic
  → SE single_lead:
      - com vencedor  → mark_lead_sold_auction(lot, purchase)
      - sem vencedor  → expire_unsold_lead(lot) → marca leads_inbox.status='expired'
```

### 5. Handoff Pipefy

```
pipefy-handoff (cron / manual)
  → SELECT * FROM leads_pending_pipefy_handoff
  → POST GraphQL para Pipefy (TODO: aguardando credenciais)
  → UPDATE leads_inbox SET pipefy_sent_at=now(), pipefy_card_id=...
```

## Edge Functions novas

- **`lead-webhook-intake`** — receber leads do n8n (auth via `x-api-key` SHA-256)
- **`pipefy-handoff`** — stub aguardando `PIPEFY_API_TOKEN` + `PIPEFY_MATRIZ_PIPE_ID`

## Configuração pendente

1. **Credenciais Pipefy** — quando o time fornecer:
   - Configurar `PIPEFY_API_TOKEN` e `PIPEFY_MATRIZ_PIPE_ID` em Supabase secrets
   - Descomentar bloco GraphQL em `functions/pipefy-handoff/index.ts`
   - Mapear field_ids reais do pipe
2. **API keys do n8n** — admin precisa gerar chave inicial:
   ```sql
   INSERT INTO webhook_api_keys (name, key_hash, scope)
   VALUES ('n8n-meta-ads', encode(digest('CHAVE_GERADA', 'sha256'), 'hex'), '{leads_inbox}');
   ```
3. **Agendamento de cron** — Supabase Scheduled Functions (ou pg_cron):
   - `close-auctions` a cada 30s (já existia)
   - `pipefy-handoff` a cada 5min

## QA regression checklist

- [ ] Lance nos últimos 60s estende `ends_at` em 10s e incrementa `extension_count`
- [ ] Após `max_sniping_extensions`, extensão para; próximo lance apenas registra
- [ ] Aprovação de lead cria lot com preço correto (MQL × multiplicador)
- [ ] Buy Now pré-leilão cobra `preço × 1.8`
- [ ] Lead expirado (sem venda) vai para `leads_pending_pipefy_handoff`
- [ ] Botão "Copiar dados" gera Markdown e JSON válidos
- [ ] Blur aparece no marketplace e some após compra
- [ ] Tabela returns rejeita INSERT de usuário comum
- [ ] Marketplace não exibe leilões encerrados de meses anteriores
- [ ] RLS: franqueado não consegue SELECT em `leads_inbox`
