# OxyBroker — Database Audit
*Gerado por Dara (Database Architect) em 2026-02-26*

---

## 1. Schema Overview

O banco de dados do OxyBroker é um sistema de leilão de ativos de negócio (leads, MQL, meetings, clients) com carteiras digitais, transferências, devoluções e sistema de promoções. Foram identificadas **22 migrations** aplicadas em ordem cronológica entre 28/01/2026 e 29/01/2026.

### Tabelas do Schema Public

| Tabela | Descrição | Linhas estimadas |
|--------|-----------|-----------------|
| `profiles` | Perfil do usuário vinculado a `auth.users`. Contém role, categoria de franquia, flags de acesso e suspensão. | Baixa |
| `user_roles` | RBAC separado para funções de autorização via RLS. Duplica o campo `role` do profiles. | Baixa |
| `franchise_categories` | Categorias de franquia (Premium, Standard, Basic) com limites em JSONB. | Muito baixa (seed) |
| `app_settings` | Singleton de configuração global (janela de devolução, anti-sniping, pesos de scoring). | 1 linha |
| `category_asset_availability` | Controla quais tipos de ativo cada categoria pode ver/adquirir. | Baixa |
| `assets` | Ativos negociáveis (lead, mql, meeting, client). Contém setor, receita, funcionários, localização, scoring. | Média |
| `lots` | Lotes de leilão. Contém preço inicial, preço atual, datas de início/fim, vencedor. | Média |
| `lot_items` | Tabela de junção N:N entre `lots` e `assets`. | Média |
| `bids` | Histórico de lances por lote e usuário. Imutável (apenas INSERT permitido a usuários). | Alta |
| `purchases` | Compras finalizadas após encerramento de leilão ou buy-now. | Média |
| `wallets` | Carteira digital com saldo. Um registro por usuário (PK = user_id). | Baixa |
| `wallet_transactions` | Ledger de todas as movimentações financeiras (topup, debit, refund, transfer, withdrawal). | Alta |
| `transfers` | Transferências de saldo ou ativo entre usuários. | Média |
| `returns` | Solicitações de devolução de compra. | Baixa |
| `notifications` | Notificações in-app e por e-mail. | Alta |
| `withdrawals` | Solicitações de saque com dados bancários (PIX/conta). | Baixa |
| `stripe_events` | Registro idempotente de webhooks do Stripe. | Média |
| `admin_alerts` | Alertas para administradores (falhas de webhook, saques pendentes, etc.). | Baixa |
| `analytics_events` | Eventos brutos de analytics (page_view, api_call, domain_event, ui_action). | Muito alta |
| `analytics_daily_rollups` | Rollups diários pré-agregados para performance de queries de analytics. | Média |
| `promotions` | Definição de promoções (desconto ou cashback) com elegibilidade e tipo de benefício. | Baixa |
| `promotion_schedules` | Agendamento de promoções (one_time ou recorrente por dia-da-semana/horário). | Baixa |
| `promotion_eligibility` | Regras de elegibilidade por categoria ou usuário individual. | Baixa |
| `promotion_usage` | Registro de uso de promoções por transação. | Média |

### Views

| View | Descrição |
|------|-----------|
| `profiles_public` | View sanitizada de `profiles` sem a coluna `email`. `security_invoker = on` correto. |
| `withdrawals_user` | View de saques sem `bank_info`, filtrada pelo `auth.uid()` atual. |

### ENUMs

| ENUM | Valores |
|------|---------|
| `app_role` | admin, master_franquia, franquia, oxy_hacker |
| `asset_status` | draft, available, in_auction, sold, returned, disabled |
| `asset_type` | lead, **mlq** (legado), meeting, mql, client |
| `lot_status` | draft, live, ended, cancelled |
| `purchase_status` | paid, refunded, disputed |
| `wallet_transaction_type` | topup, debit_purchase, credit_refund, transfer_in, transfer_out, admin_adjust, withdrawal |
| `transfer_type` | balance, asset |
| `transfer_status` | completed, reversed |
| `return_status` | requested, approved, rejected, processed |
| `notification_channel` | in_app, email |
| `withdrawal_status` | pending, approved, rejected, completed |
| `promotion_type` | discount, cashback |
| `promotion_applies_to` | topup, bid, purchase |
| `benefit_type` | percentage, fixed |
| `eligibility_type` | global, category, individual |
| `schedule_type` | one_time, recurring |

---

## 2. Mapa de Relacionamentos (ERD textual)

```
auth.users (Supabase managed)
  |
  |-- 1:1 --> profiles (id FK auth.users)
  |               |-- N:1 --> franchise_categories
  |
  |-- 1:N --> user_roles (user_id FK auth.users)
  |
  |-- 1:1 --> wallets (user_id PK=FK auth.users)
  |               |
  |               |-- 1:N --> wallet_transactions (user_id)
  |
  |-- 1:N --> bids (user_id)
  |
  |-- 1:N --> purchases (buyer_user_id)
  |               |-- 1:N --> returns (purchase_id)
  |
  |-- 1:N --> transfers (from_user_id, to_user_id)
  |
  |-- 1:N --> notifications (user_id)
  |
  |-- 1:N --> withdrawals (user_id)
  |
  |-- 1:N --> analytics_events (user_id nullable)

lots
  |-- 1:N --> lot_items (lot_id)
  |               |-- N:1 --> assets (asset_id)
  |-- 1:N --> bids (lot_id)
  |-- 1:N --> purchases (lot_id)
  |-- N:1 --> auth.users (winner_user_id, created_by)

promotions
  |-- 1:N --> promotion_schedules (promotion_id)
  |-- 1:N --> promotion_eligibility (promotion_id)
  |               |-- N:1 --> franchise_categories (category_id)
  |               |-- N:1 --> auth.users (user_id)
  |-- 1:N --> promotion_usage (promotion_id)

franchise_categories
  |-- 1:N --> profiles (franchise_category_id)
  |-- 1:N --> category_asset_availability (franchise_category_id)
  |-- 1:N --> promotion_eligibility (category_id)
```

### Observações de design

- `wallets` usa `user_id` como PK (correto para one-to-one com auth.users).
- `lot_items` usa PK composta `(lot_id, asset_id)` — correto, previne duplicatas.
- `user_roles` e `profiles.role` são **redundantes** (ver Seção 8).
- `transfers.amount` é NULLABLE sem justificativa clara para transferências de tipo 'balance'.
- `withdrawals` não tem FK para `auth.users` (apenas texto no campo `user_id`), embora na prática seja um UUID válido.

---

## 3. Análise de RLS Policies

### Status Geral

RLS está habilitada em **todas as 22 tabelas/views** do schema public. O design passou por uma hardening progressiva ao longo das migrations (v1 → v3), com políticas mais granulares substituindo as originais.

### 3.1 Funções de autorização (SECURITY DEFINER)

| Função | Comportamento | Risco |
|--------|---------------|-------|
| `is_admin()` | Consulta `user_roles` via `has_role(auth.uid(), 'admin')` | Baixo |
| `is_oxy_hacker()` | Consulta `user_roles` via `has_role(auth.uid(), 'oxy_hacker')` | Baixo |
| `has_role(_user_id, _role)` | Lookup direto em `user_roles` | Baixo |
| `get_user_role(_user_id)` | Lê `profiles.role` (não `user_roles`) | **INCONSISTENCIA** |
| `user_has_bid_on_lot(_lot_id)` | Verifica se `auth.uid()` tem bid no lote | Baixo |

**Problema identificado**: `get_user_role()` lê de `profiles.role`, enquanto `is_admin()` e `is_oxy_hacker()` leem de `user_roles`. Se as duas tabelas ficarem dessincronizadas (o que é possível — ver Seção 8), um usuário pode ter `admin` em `user_roles` mas `franquia` em `profiles.role`, ou vice-versa. Isso cria inconsistência de autorização dependendo de qual função é chamada.

### 3.2 Políticas por tabela (estado final após todas as migrations)

#### `profiles`
| Política | Operação | Condição |
|----------|----------|----------|
| `profiles_select_own` | SELECT | `auth.uid() = id` |
| `profiles_select_admin` | SELECT | `is_admin()` |
| `profiles_select_oxy_hacker` | SELECT | `is_oxy_hacker()` — **REMOVIDA** na última migration |
| `profiles_insert_own` | INSERT | `auth.uid() = id` |
| `profiles_update_own` | UPDATE | `auth.uid() = id` (USING + WITH CHECK) |
| `profiles_update_admin` | UPDATE | `is_admin()` |

**PROBLEMA CRITICO**: `profiles_update_own` permite que um usuário atualize **qualquer campo** do seu próprio perfil via API direta, incluindo `role`, `can_withdraw` e `suspended_at`. Um usuário poderia se auto-promover para `admin` ou habilitar seu próprio saque. Não existe `WITH CHECK` restringindo quais colunas podem ser alteradas.

**PROBLEMA**: `profiles_update_admin` não tem `WITH CHECK`, apenas `USING`. Em PostgreSQL, para UPDATE, `USING` filtra quais linhas existentes podem ser alvejadas, mas `WITH CHECK` valida o novo estado. Sem `WITH CHECK`, um admin poderia usar o UPDATE para definir valores inválidos.

#### `wallets`
| Política | Operação | Condição |
|----------|----------|----------|
| `wallets_select_own` | SELECT | `auth.uid() = user_id` |
| `wallets_select_admin` | SELECT | `is_admin()` |
| `wallets_insert_own` | INSERT | `auth.uid() = user_id` |
| `wallets_update_admin` | UPDATE | `is_admin()` |
| `wallets_delete_admin` | DELETE | `is_admin()` |

Usuários comuns não podem UPDATE diretamente na carteira — apenas via funções SECURITY DEFINER. **Correto.**

#### `wallet_transactions`
| Política | Operação | Condição |
|----------|----------|----------|
| `wallet_tx_select_own` | SELECT | `auth.uid() = user_id` |
| `wallet_tx_select_admin` | SELECT | `is_admin()` |
| `wallet_tx_insert_admin` | INSERT | `is_admin()` |
| `wallet_tx_update_admin` | UPDATE | `is_admin()` |
| `wallet_tx_delete_admin` | DELETE | `is_admin()` |

Usuários não podem inserir transações diretamente. Correto — edge functions e funções atômicas usam `service_role`.

**ATENÇÃO**: `wallet_transactions` não tem política de DELETE para `service_role` (mas service_role bypass RLS por padrão — isso é aceitável).

#### `bids`
| Política | Operação | Condição |
|----------|----------|----------|
| `bids_select_lot_participants` | SELECT | `user_has_bid_on_lot(lot_id) OR is_admin()` |
| `bids_insert_own` | INSERT | `auth.uid() = user_id` |
| `bids_update_admin` | UPDATE | `is_admin()` |
| `bids_delete_admin` | DELETE | `is_admin()` |

**PROBLEMA DE PRIVACIDADE**: Um usuário pode ver os lances de **todos os usuários** em qualquer lote onde ele tenha feito ao menos um lance. Isso expõe os IDs e valores de lance de outros participantes, o que pode facilitar estratégias de sniping coordenado. O campo `user_id` nos bids expõe quem está competindo.

**POSITIVO**: A política `user_has_bid_on_lot` foi corretamente refatorada de uma subquery recursiva para uma função `SECURITY DEFINER` separada, evitando infinite recursion em RLS.

#### `purchases`
| Política | Operação | Condição |
|----------|----------|----------|
| `purchases_select_own` | SELECT | `auth.uid() = buyer_user_id` |
| `purchases_select_admin` | SELECT | `is_admin()` |
| `purchases_select_oxy_hacker` | SELECT | `is_oxy_hacker()` |
| `purchases_insert_admin` | INSERT | `is_admin()` |
| `purchases_update_admin` | UPDATE | `is_admin()` |
| `purchases_delete_admin` | DELETE | `is_admin()` |

Oxy_hacker tem READ ALL em purchases (auditoria). **Correto por design de negócio.**

#### `returns`
Estrutura idêntica às purchases: own + admin + oxy_hacker (read-only). **Correto.**

#### `transfers`
Usuário vê transferências onde é remetente OU destinatário. **Correto.**

#### `notifications`
Isolamento total por `user_id`. Service_role (edge functions) insere sem restrição. **Correto.**

**NOTA**: A política `notifications_insert_system` (WITH CHECK (true)) foi criada e depois removida em favor do service_role bypass. **Correto.**

#### `withdrawals`
| Política | Operação | Condição |
|----------|----------|----------|
| `withdrawals_select_own` | SELECT | `auth.uid() = user_id` |
| `withdrawals_insert_own` | INSERT | `auth.uid() = user_id` |
| `withdrawals_select_admin` | SELECT | `is_admin()` |
| `withdrawals_update_admin` | UPDATE | `is_admin()` |
| `withdrawals_select_oxy_hacker` | SELECT | `is_oxy_hacker()` — **REMOVIDA** na última migration |

**PROBLEMA CRITICO**: A política `withdrawals_insert_own` permite que um usuário comum insira diretamente na tabela `withdrawals` **sem passar pelo edge function `request-withdrawal`**. Isso bypassaria a validação atômica de saldo e a criação da wallet_transaction correspondente. Um usuário poderia criar um registro de saque sem que o saldo seja debitado.

**MITIGAÇÃO PARCIAL**: O edge function `request-withdrawal` usa a função atômica que verifica `can_withdraw`, mas a política RLS não impede inserção direta pelo cliente.

#### `analytics_events` e `analytics_daily_rollups`
Políticas de INSERT/UPDATE/DELETE com `WITH CHECK (false)` e `USING (false)` — nega qualquer escrita de clientes. **Correto e bem implementado.**

#### `stripe_events` e `admin_alerts`
Somente admin pode visualizar e gerenciar. **Correto.**

#### `promotions`
| Política | Operação | Condição |
|----------|----------|----------|
| `promotions_all_admin` | ALL | `is_admin()` |
| `promotions_select_active` | SELECT | `is_active = true` |

**PROBLEMA**: `promotions_select_active` permite que qualquer pessoa (incluindo **não autenticada**) veja promoções ativas, pois não especifica `TO authenticated`. Isso é uma pequena vazamento de informação, não crítico, mas indesejado.

#### `app_settings`
Política `"Authenticated users can view settings"` usa `TO authenticated USING (true)` — qualquer autenticado vê as configurações globais (return window, bidding extension). **Aceitável por design.**

---

## 4. Análise de Indexes

### 4.1 Indexes Existentes (explicitamente criados nas migrations)

| Index | Tabela | Coluna(s) | Tipo |
|-------|--------|-----------|------|
| `idx_stripe_events_event_id` | `stripe_events` | `stripe_event_id` | btree |
| `idx_stripe_events_status` | `stripe_events` | `status` | btree |
| `idx_admin_alerts_unacknowledged` | `admin_alerts` | `created_at` WHERE `acknowledged_at IS NULL` | btree parcial |
| `idx_analytics_events_occurred_at` | `analytics_events` | `occurred_at DESC` | btree |
| `idx_analytics_events_name_occurred` | `analytics_events` | `(event_name, occurred_at DESC)` | btree composto |
| `idx_analytics_events_user_occurred` | `analytics_events` | `(user_id, occurred_at DESC)` | btree composto |
| `idx_analytics_events_route_occurred` | `analytics_events` | `(route, occurred_at DESC)` | btree composto |
| `idx_analytics_events_type` | `analytics_events` | `event_type` | btree |
| `idx_rollups_date` | `analytics_daily_rollups` | `rollup_date DESC` | btree |
| `idx_rollups_event` | `analytics_daily_rollups` | `(event_name, rollup_date DESC)` | btree composto |
| `idx_promotion_usage_promotion_id` | `promotion_usage` | `promotion_id` | btree |
| `idx_promotion_usage_user_id` | `promotion_usage` | `user_id` | btree |
| `idx_promotion_usage_created_at` | `promotion_usage` | `created_at` | btree |

**Indexes implícitos** (criados automaticamente por PRIMARY KEY e UNIQUE constraints):
- Todas as PKs (`id UUID PRIMARY KEY`)
- `profiles(id)` — PK e FK de auth.users
- `wallets(user_id)` — PK
- `lot_items(lot_id, asset_id)` — PK composta
- `user_roles(user_id, role)` — UNIQUE
- `stripe_events(stripe_event_id)` — UNIQUE
- `franchise_categories(name)` — UNIQUE
- `category_asset_availability(franchise_category_id, asset_type)` — UNIQUE
- `analytics_daily_rollups(rollup_date, event_type, event_name, route)` — UNIQUE
- `promotion_eligibility` — UNIQUE implícita via constraint CHECK

### 4.2 Indexes Ausentes (críticos)

Os indexes abaixo são **ausentes e críticos** para performance:

#### CRITICO — `bids` table
```sql
-- Queries mais frequentes no sistema:
-- 1. Buscar lances de um lote (usada em place_bid_atomic, close_auction_atomic, useLotDetail)
CREATE INDEX idx_bids_lot_id ON public.bids(lot_id);

-- 2. Buscar lances de um usuário em um lote (place_bid_atomic, user_has_bid_on_lot)
CREATE INDEX idx_bids_lot_user ON public.bids(lot_id, user_id);

-- 3. Buscar maior lance de um lote (ORDER BY amount DESC LIMIT 1)
CREATE INDEX idx_bids_lot_amount ON public.bids(lot_id, amount DESC);

-- 4. Buscar lances de um usuário (RLS select policy)
CREATE INDEX idx_bids_user_id ON public.bids(user_id);
```

A tabela `bids` é a mais crítica do sistema — ela é lida em toda operação de lance e encerramento. **Sem indexes, o sistema fará full table scans em todas as operações de leilão.**

#### CRITICO — `wallet_transactions` table
```sql
-- Buscar transações por usuário (useWallet, RLS policy)
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);

-- Buscar transações por usuário ordenadas por data (useWallet hook)
CREATE INDEX idx_wallet_transactions_user_created ON public.wallet_transactions(user_id, created_at DESC);

-- Buscar transações por referência (auditorias)
CREATE INDEX idx_wallet_transactions_reference ON public.wallet_transactions(reference_type, reference_id);
```

#### ALTO — `lots` table
```sql
-- Buscar lotes por status e data (close-auctions, useLots)
CREATE INDEX idx_lots_status_ends_at ON public.lots(status, ends_at);

-- Buscar lotes com status 'live' expirados (close-auctions)
CREATE INDEX idx_lots_live_ends_at ON public.lots(ends_at) WHERE status = 'live';

-- Buscar lotes por criador (admin)
CREATE INDEX idx_lots_created_by ON public.lots(created_by);
```

#### ALTO — `notifications` table
```sql
-- Buscar notificações por usuário (RLS + hooks)
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- Buscar notificações não lidas por usuário
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
```

#### MÉDIO — `assets` table
```sql
-- Buscar ativos por status (useLots, close_auction_atomic)
CREATE INDEX idx_assets_status ON public.assets(status);

-- Buscar ativos por tipo e status
CREATE INDEX idx_assets_type_status ON public.assets(asset_type, status);
```

#### MÉDIO — `lot_items` table
```sql
-- Buscar itens por lote (já existe PK composta, mas útil para queries com apenas lot_id)
CREATE INDEX idx_lot_items_lot_id ON public.lot_items(lot_id);
-- (o PostgreSQL pode usar a PK (lot_id, asset_id) para queries com lot_id, mas um index dedicado é mais eficiente)

-- Buscar itens por asset (para verificar se um ativo está em algum lote)
CREATE INDEX idx_lot_items_asset_id ON public.lot_items(asset_id);
```

#### MÉDIO — `transfers` table
```sql
-- Buscar transferências por usuário (RLS policy e useTransfers)
CREATE INDEX idx_transfers_from_user ON public.transfers(from_user_id);
CREATE INDEX idx_transfers_to_user ON public.transfers(to_user_id);
```

#### MÉDIO — `withdrawals` table
```sql
-- Buscar saques por usuário (RLS policy)
CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);

-- Buscar saques pendentes (admin dashboard)
CREATE INDEX idx_withdrawals_pending ON public.withdrawals(requested_at DESC)
  WHERE status = 'pending';
```

#### BAIXO — `profiles` table
```sql
-- Busca por email (create-transfer usa profiles.email para encontrar destinatário)
CREATE INDEX idx_profiles_email ON public.profiles(email);
```

### 4.3 Queries lentas potenciais

1. **`close_auction_atomic` com muitos lances**: O loop `OFFSET v_fallback_offset` sobre a tabela `bids` sem index em `(lot_id, amount DESC)` causará leituras sequenciais crescentes para cada fallback de bidder. Em um leilão com 100+ lances e muitos bidders com saldo insuficiente, isso pode levar dezenas de segundos.

2. **`useAnalyticsData` — múltiplas queries sem agregação no banco**: O hook `useAnalyticsOverview` faz 3 queries separadas que retornam TODAS as linhas do período filtradas, e faz a agregação no JavaScript client-side. Para períodos longos com alta volumetria de eventos, isso pode transferir megabytes de dados desnecessariamente.

3. **`useAnalyticsTimeseries` — full scan por período**: Busca todos os eventos do período ordenados por data sem filtro de event_type, fazendo a categorização no client. Deve usar os rollups existentes em `analytics_daily_rollups` em vez disso.

4. **`useTransfers` — 2-step lookup com profiles**: Busca transferências e depois profiles em 2 queries separadas. Poderia ser um JOIN.

---

## 5. Edge Functions Audit

### 5.1 Visão geral

| Edge Function | Autenticação | Autorização | Usa RPC atômico |
|---------------|-------------|-------------|-----------------|
| `place-bid` | JWT via `auth.getUser()` | Qualquer autenticado | `place_bid_atomic` |
| `close-auctions` | CRON_SECRET ou JWT+admin | Admin ou cron | `close_auction_atomic` |
| `stripe-webhook` | Stripe signature | Nenhuma (webhook) | `credit_wallet`, `apply_promotion` |
| `create-user` | JWT via `getClaims` | Admin (`user_roles`) | Direto (admin API) |
| `admin-adjust-balance` | JWT via `getClaims` | Admin (`has_role`) | Não (UPDATE direto) |
| `create-transfer` | JWT via `auth.getUser()` | Qualquer autenticado | `transfer_balance_atomic` |
| `request-withdrawal` | JWT via `getClaims` | Qualquer autenticado | `request_withdrawal_atomic` |
| `process-return` | (não lido) | — | — |
| `request-return` | (não lido) | — | — |
| `retry-stripe-events` | (não lido) | — | — |
| `log-event` | (não lido) | — | — |
| `create-checkout` | (não lido) | — | — |

### 5.2 `place-bid`
- **Correto**: Verifica JWT, usa `place_bid_atomic` via service_role.
- **PROBLEMA**: O CORS header `"Access-Control-Allow-Origin": "*"` permite chamadas de qualquer origem. Em produção, deve ser restrito ao domínio da aplicação.
- **POSITIVO**: Emite broadcast realtime para atualização imediata dos viewers.
- **POSITIVO**: Notifica o bidder anterior (outbid) via in-app notification.
- **POSITIVO**: Loga evento de analytics com `amount_bucket` (sem valor exato).

### 5.3 `close-auctions`
- **POSITIVO**: Suporta autenticação dupla (CRON_SECRET para pg_cron ou JWT admin).
- **POSITIVO**: Trata múltiplos lotes em loop com tratamento de erro individual.
- **PROBLEMA**: Não há pg_cron configurado nas migrations (apenas a extensão foi habilitada em `20260128192516`). O schedule de encerramento deve ser configurado manualmente no Supabase dashboard.
- **PROBLEMA**: O loop de fechamento de lotes é sequencial. Com muitos lotes expirando ao mesmo tempo (ex: múltiplos leilões de 24h expiram juntos), o edge function pode atingir o timeout do Deno.
- **PROBLEMA**: A notificação de "losers" dentro do loop usa `for (const recipientUserId of uniqueUserIds)` com um `await` por iteração — isso é N queries sequenciais onde poderia ser um bulk INSERT.

### 5.4 `stripe-webhook`
- **POSITIVO**: Verifica assinatura Stripe com `stripe.webhooks.constructEvent` — sem bypass.
- **POSITIVO**: Idempotência implementada corretamente com `stripe_events`.
- **POSITIVO**: Admin alert após 3 tentativas falhas.
- **POSITIVO**: Status `retry_pending` para tentativas intermediárias.
- **PROBLEMA**: CORS com `"*"` — desnecessário para webhooks do Stripe (ele não é chamado pelo browser).
- **PROBLEMA**: A versão do Deno std usada é `0.190.0` enquanto o `place-bid` usa `0.168.0` — inconsistência de versões entre edge functions.
- **PROBLEMA**: O `charge.refunded` handler retorna `success: true` sem fazer nada — refunds externos via Stripe não são refletidos no saldo da wallet.

### 5.5 `create-user`
- **POSITIVO**: Verifica role admin antes de criar usuário.
- **PROBLEMA**: Senha mínima de apenas 6 caracteres — muito fraca para um sistema financeiro. Recomendado mínimo de 12.
- **PROBLEMA**: Não verifica se o email já existe antes de chamar `auth.admin.createUser`, resultando em erro genérico do Supabase sem mensagem amigável.
- **PROBLEMA**: `email_confirm: true` auto-confirma o email sem verificação real. Adequado para criação admin, mas deve ser documentado.

### 5.6 `admin-adjust-balance`
- **PROBLEMA CRITICO — NÃO É ATÔMICO**: Esta é a única operação financeira que **não usa uma função SECURITY DEFINER atômica**. O código faz:
  1. `SELECT balance` da wallet
  2. `UPDATE balance = balance + amount` (não usa FOR UPDATE lock)
  3. `INSERT wallet_transaction`

  Entre os passos 1 e 2, outra operação concorrente (compra, lance, outro ajuste) pode alterar o saldo. O UPDATE não usa `balance = balance + amount` baseado no valor do banco — usa o valor lido no passo 1. **RACE CONDITION CONFIRMADA.**

  Adicionalmente, a "rollback" em caso de falha no INSERT da transação (linha 164) é incorreta: ela tenta restaurar o valor antigo, mas isso é uma segunda UPDATE que também pode falhar e não está em uma transação real.

- **PROBLEMA**: Apenas aceita ajustes positivos (`amount > 0`). Não há suporte a ajustes negativos (débito admin), o que pode ser necessário para correções.

### 5.7 `create-transfer`
- **POSITIVO**: Usa `transfer_balance_atomic` corretamente.
- **PROBLEMA**: Busca o destinatário por email (`profiles.email`). A coluna `email` em `profiles` não tem index. Em um sistema com muitos usuários, isso será um full table scan.
- **PROBLEMA**: O campo `email` em `profiles` é replicado de `auth.users` e pode ficar desatualizado se o usuário alterar o email via auth.

### 5.8 `request-withdrawal`
- **POSITIVO**: Usa `request_withdrawal_atomic` corretamente.
- **PROBLEMA**: `bank_info` é armazenado em JSONB sem criptografia. Dados sensíveis (chave PIX, dados bancários) ficam em texto claro no banco. Recomendado usar criptografia em nível de aplicação ou solução de vault.

---

## 6. N+1 Query Problems

### 6.1 `useLotDetail.ts` — N+1 em assets

```typescript
// PROBLEMA: 3 queries sequenciais para carregar um único lote
const { data: lotData } = await supabase.from("lots").select("*").eq("id", lotId).maybeSingle();
const { data: bidsData } = await supabase.from("bids").select("*").eq("lot_id", lotId);
const { data: lotItems } = await supabase.from("lot_items").select("asset_id").eq("lot_id", lotId);
// Depois, SE há itens:
const { data: assetsData } = await supabase.from("assets").select("*").in("id", assetIds);
```

**Impacto**: 3-4 round trips para carregar uma página de detalhe de lote. Deve ser uma única query com joins via PostgREST:

```typescript
// SOLUÇÃO: Single query com embedded relations
const { data } = await supabase
  .from("lots")
  .select(`
    *,
    bids(*),
    lot_items(
      assets(*)
    )
  `)
  .eq("id", lotId)
  .maybeSingle();
```

### 6.2 `useUsers.ts` — 2-step com wallets (não é N+1 puro, mas evitável)

```typescript
// Step 1: Busca profiles paginados
const { data } = await supabase.from("profiles").select(`id, ..., franchise_categories(name)`);
// Step 2: Busca wallets dos IDs obtidos
const { data: walletsData } = await supabase.from("wallets").select("user_id, balance").in("user_id", userIds);
```

**Impacto**: 2 queries por carregamento de página de usuários. O segundo query usa `.in()` que é eficiente, mas poderia ser evitado com uma View ou RPC que já inclua o balance.

### 6.3 `useTransfers.ts` — 2-step com profiles

```typescript
// Step 1: Busca transfers do usuário
const { data: transferData } = await supabase.from("transfers").select("*")...
// Step 2: Busca profiles dos user_ids coletados
const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
```

**Impacto**: 2 queries por carregamento. Pode ser resolvido com embedded relations:

```typescript
// SOLUÇÃO:
const { data } = await supabase
  .from("transfers")
  .select(`
    *,
    from_profile:profiles!from_user_id(full_name, email),
    to_profile:profiles!to_user_id(full_name, email)
  `)
  .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
```

### 6.4 `useAnalyticsData.ts` — Múltiplas queries paralelas não otimizadas

O hook `useAnalyticsOverview` faz 3 queries sequenciais que retornam **todos os campos** de eventos brutos e agrega no JavaScript:

```typescript
// 3 queries separadas trazendo colunas desnecessárias:
const { data: pageViews } = await supabase.from("analytics_events")
  .select("user_id, session_id") // ainda OK
  .eq("event_type", "page_view")...

const { data: domainEvents } = await supabase.from("analytics_events")
  .select("event_name, status")...

const { data: apiCalls } = await supabase.from("analytics_events")
  .select("event_name, status, duration_ms")...
```

**Impacto**: 3 queries paralelas que podem retornar milhares de linhas de `analytics_events` para agregação no cliente. Deve usar `analytics_daily_rollups` para dados históricos e queries com `GROUP BY` para dados recentes.

### 6.5 `useAdminLots.ts` — Race condition em mutações

As mutações `updateMutation`, `addAssetMutation`, `removeAssetMutation`, `publishMutation`, `cancelMutation` e `deleteMutation` todas fazem:
1. Uma query `SELECT` para verificar o status do lote
2. Uma ou mais queries `UPDATE/INSERT/DELETE`

Não há `FOR UPDATE` lock entre os passos. Um admin poderia publicar um lote enquanto outro admin o cancela simultaneamente, causando estado inconsistente nos assets.

### 6.6 `useLots.ts` — Refetch desnecessário em realtime

```typescript
// Toda mudança no realtime dispara fetchLots() completo
.on("postgres_changes", { event: "*", ... }, () => {
  fetchLots(); // recarrega TODOS os lotes
})
```

Em vez de recarregar todos os lotes, o payload do evento realtime deveria ser usado para atualizar apenas o lote alterado no state local.

### 6.7 `useLotDetail.ts` — Double refetch em realtime

Quando um lance é feito, o `useLotDetail` recebe tanto o broadcast event quanto a mudança de postgres, disparando `fetchLot()` duas vezes quase simultaneamente.

```typescript
// Broadcast event → fetchLot()
.on("broadcast", { event: "bid_placed" }, () => { fetchLot(); })
// E também:
.on("postgres_changes", { table: "bids" }, () => { fetchLot(); })
```

---

## 7. Problemas de Segurança no Schema

### 7.1 CRITICO — `profiles_update_own` sem restrição de colunas

**Descrição**: A política `profiles_update_own` (`USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`) permite que qualquer usuário autenticado atualize qualquer coluna do seu próprio perfil, incluindo:
- `role` — auto-promoção para admin
- `can_withdraw` — habilitação do próprio saque
- `suspended_at` — remoção da própria suspensão

**Impacto**: CRITICO. Qualquer usuário pode se tornar admin via:
```sql
UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
```

**Correção**: Criar política separada para campos restritos, ou remover a permissão de UPDATE direto e forçar uso via RPC.

### 7.2 CRITICO — `withdrawals_insert_own` permite bypass do fluxo atômico

**Descrição**: Usuários podem inserir diretamente na tabela `withdrawals` sem passar pelo edge function `request-withdrawal` e sua função atômica. Isso permite criar saques sem debitar o saldo.

**Correção**: Remover a política `withdrawals_insert_own` e forçar inserções apenas via service_role (edge function).

### 7.3 ALTO — `admin-adjust-balance` não é atômico

Detalhado na Seção 5.6. Race condition que pode levar a saldo incorreto.

### 7.4 ALTO — Dados bancários em texto claro

A coluna `withdrawals.bank_info` (JSONB) armazena chaves PIX e dados bancários sem criptografia. Em caso de vazamento do banco, esses dados sensíveis são expostos.

### 7.5 MÉDIO — Enum legado `mlq` ainda presente

O enum `asset_type` contém o valor `mlq` (legado) além do correto `mql`. A migration `20260128230124` tentou migrar os dados de `mlq` para `mql`, mas **o valor `mlq` ainda existe no ENUM** e não foi removido. Isso pode causar inconsistências se alguém inserir um asset com tipo `mlq` acidentalmente.

### 7.6 MÉDIO — `promotions_select_active` sem restrição de autenticação

```sql
CREATE POLICY "promotions_select_active" ON public.promotions
  FOR SELECT USING (is_active = true);
-- Não tem "TO authenticated" — qualquer sessão anônima pode ver
```

Expõe informações de marketing (nomes de promoções, valores de benefício) para usuários não autenticados.

### 7.7 MÉDIO — Role `oxy_hacker` ainda registrado como enum válido

Após a última migration remover as políticas de `oxy_hacker`, o papel ainda existe no enum `app_role` e em `user_roles`. Usuários com esse papel podem ter comportamento imprevisível em funções que ainda chamam `is_oxy_hacker()` (a função existe mas as políticas foram removidas).

### 7.8 BAIXO — Email duplicado em `profiles` e `auth.users`

O campo `profiles.email` replica `auth.users.email`. Se um usuário alterar o email via `supabase.auth.updateUser()`, o campo em `profiles` ficará desatualizado. O `create-transfer` usa `profiles.email` para lookup, o que pode levar a transferências para o destinatário errado se o email foi alterado.

### 7.9 BAIXO — `bids` expõe user_id de outros participantes

A política `bids_select_lot_participants` retorna lances de todos os usuários no lote, incluindo os `user_id`s. Isso expõe a identidade dos participantes do leilão entre si, o que pode não ser o comportamento desejado em um sistema com privacidade de compradores.

### 7.10 BAIXO — `app_settings` sem proteção de inserção

```sql
CREATE POLICY "Admin can manage settings" ON public.app_settings FOR ALL USING (is_admin());
CREATE POLICY "Authenticated users can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
```

A política `FOR ALL` de admin sobrepõe a de SELECT, mas não há restrição de INSERT para garantir que apenas uma linha exista (singleton). A constraint de singleton é apenas informacional (não há UNIQUE ou CHECK que garanta apenas 1 linha).

---

## 8. Inconsistências de Naming/Design

### 8.1 Redundância de role em `profiles` e `user_roles`

O campo `profiles.role` e a tabela `user_roles` duplicam a informação de role do usuário. As funções de autorização (`is_admin`, `is_oxy_hacker`) consultam `user_roles`, mas `get_user_role()` consulta `profiles.role`. O `useUsers` hook atualiza **ambas** as tabelas ao alterar um role, o que cria acoplamento e risco de dessincronização.

**Recomendação**: Escolher uma fonte de verdade. `user_roles` é mais flexível (suporta múltiplos roles por usuário com o UNIQUE constraint `(user_id, role)`), mas o sistema atual apenas usa um role por usuário. Manter apenas `user_roles` e remover `profiles.role` — ou remover `user_roles` e usar apenas `profiles.role`.

### 8.2 Enum `mlq` legado não removido

O enum `asset_type` tem `mlq` (legado) e `mql` (correto). Os dados foram migrados mas o enum value sobreviveu. O `types.ts` no frontend ainda lista `"mlq"` em `Constants.asset_type`.

### 8.3 Naming inconsistente de funções SECURITY DEFINER

```
handle_updated_at()   -- snake_case, verbo_objeto
handle_new_user()     -- snake_case, verbo_objeto
place_bid_atomic()    -- snake_case, objeto_verbo_qualificador
close_auction_atomic() -- snake_case, objeto_verbo_qualificador
buy_now_atomic()      -- snake_case, verbo_adv_qualificador
credit_wallet()       -- snake_case, verbo_objeto
transfer_balance_atomic() -- snake_case
is_admin()            -- snake_case, is_ prefix
has_role()            -- snake_case, has_ prefix
get_user_role()       -- snake_case, get_ prefix
user_has_bid_on_lot() -- snake_case, sujeito_has_verbo_prep_objeto
```

Mistura de convenções `verbo_objeto` e `objeto_verbo`.

### 8.4 `transfers.amount` é NULLABLE

Para transferências de tipo `balance`, o campo `amount` deveria ser NOT NULL. Apenas para transferências de tipo `asset` (que não usam amount) faria sentido ser nullable. Uma constraint CHECK por tipo resolveria.

### 8.5 `admin_alerts.acknowledged_by` sem FK

```sql
acknowledged_by uuid  -- sem REFERENCES auth.users(id)
```

O campo `acknowledged_by` não tem foreign key, permitindo inserção de UUIDs inválidos.

### 8.6 Tabela `category_asset_availability` subutilizada

A tabela existe para controlar quais tipos de ativo cada categoria pode adquirir, mas nenhuma das funções atômicas ou edge functions verificam essa tabela ao processar lances ou compras. A constraint existe apenas no schema, não sendo aplicada no fluxo transacional.

### 8.7 Ausência de `created_at` em `wallets`

A tabela `wallets` tem apenas `user_id` (PK) e `balance` e `updated_at`. Não há `created_at`, impossibilitando auditoria de quando a carteira foi criada.

### 8.8 `promotions_select_active` conflita com `promotions_all_admin`

Ambas as políticas são PERMISSIVE e se combinam com OR. Isso significa que um admin vê todas as promoções (ativas e inativas) E qualquer usuário vê as promoções ativas. O design pode ser intencional (admin ver tudo, usuários ver apenas ativas), mas a coexistência de `FOR ALL` e `FOR SELECT` pode gerar comportamento confuso em auditoria de políticas.

### 8.9 `lot_items` sem `updated_at`

A tabela de junção não tem `updated_at`, o que é aceitável para uma tabela de junção, mas impede saber quando um ativo foi adicionado/removido de um lote em auditorias (apenas `created_at` existe).

### 8.10 `purchase_status` não tem `pending`

O enum `purchase_status` tem `paid`, `refunded`, `disputed`. Não há um status `pending` para compras onde o pagamento está sendo processado. Isso significa que toda compra inserida já é `paid` imediatamente, sem representar um estado intermediário.

---

## 9. Recomendações de Otimização

Prioridade: **P0** = Segurança crítica, **P1** = Performance crítica, **P2** = Design/Manutenção

### P0 — Segurança Crítica

1. **Remover permissão de auto-atualização de campos privilegiados em `profiles`**: Criar uma política `WITH CHECK` que impeça alteração de `role`, `can_withdraw` e `suspended_at` pelo próprio usuário.

2. **Remover `withdrawals_insert_own`**: Forçar inserções apenas via edge function / service_role.

3. **Reescrever `admin-adjust-balance` como função atômica**: Migrar a lógica para um `SECURITY DEFINER` RPC similar ao `credit_wallet`, com `FOR UPDATE` lock e transação garantida.

4. **Criptografar `bank_info`**: Usar `pgcrypto` (extensão já disponível no Supabase) ou vault para criptografar dados bancários em repouso.

5. **Restringir CORS das edge functions**: Substituir `"*"` pelo domínio da aplicação em produção.

### P1 — Performance Crítica

6. **Criar indexes em `bids`**: `(lot_id)`, `(lot_id, user_id)`, `(lot_id, amount DESC)`, `(user_id)`.

7. **Criar indexes em `wallet_transactions`**: `(user_id)`, `(user_id, created_at DESC)`.

8. **Criar indexes em `lots`**: `(status, ends_at)`, index parcial em lotes live.

9. **Criar indexes em `notifications`**: `(user_id)`, `(user_id, created_at DESC) WHERE read_at IS NULL`.

10. **Criar index em `profiles(email)`**: Para o lookup por email no `create-transfer`.

11. **Otimizar `useLotDetail` com single query**: Substituir 3-4 queries por um único select com embedded relations.

12. **Usar `analytics_daily_rollups` para queries históricas**: Substituir queries full-scan de `analytics_events` por rollups pré-calculados.

13. **Criar pg_cron schedule para `close-auctions`**: Configurar o schedule automático no banco.

### P2 — Design e Manutenção

14. **Eliminar redundância `profiles.role` vs `user_roles`**: Escolher uma fonte de verdade.

15. **Remover enum value `mlq` de `asset_type`**: Usar `ALTER TYPE ... RENAME VALUE 'mlq' TO 'deprecated_mlq'` ou remover completamente.

16. **Adicionar FK em `admin_alerts.acknowledged_by`**.

17. **Implementar verificação de `category_asset_availability`** nas funções de compra/lance.

18. **Adicionar `created_at` à tabela `wallets`**.

19. **Adicionar status `pending` ao enum `purchase_status`** para representar pagamentos em processamento.

20. **Configurar o pg_cron schedule** para encerramento automático de leilões.

21. **Padronizar versão do Deno std** entre edge functions (0.168.0 vs 0.190.0).

---

## 10. Migrations SQL Recomendadas

### 10.1 Indexes críticos

```sql
-- Migration: add_critical_indexes
-- Indexes para a tabela bids (mais crítica do sistema)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_id
  ON public.bids(lot_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_user
  ON public.bids(lot_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_amount
  ON public.bids(lot_id, amount DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_user_id
  ON public.bids(user_id);

-- Wallet transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_id
  ON public.wallet_transactions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_reference
  ON public.wallet_transactions(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- Lots
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_status_ends_at
  ON public.lots(status, ends_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_live_ends_at
  ON public.lots(ends_at) WHERE status = 'live';

-- Notifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Assets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_status
  ON public.assets(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_type_status
  ON public.assets(asset_type, status);

-- Lot items
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lot_items_lot_id
  ON public.lot_items(lot_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lot_items_asset_id
  ON public.lot_items(asset_id);

-- Transfers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_from_user
  ON public.transfers(from_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_to_user
  ON public.transfers(to_user_id);

-- Withdrawals
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_id
  ON public.withdrawals(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_pending
  ON public.withdrawals(requested_at DESC) WHERE status = 'pending';

-- Profiles email lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email
  ON public.profiles(email) WHERE email IS NOT NULL;
```

### 10.2 Correção crítica de segurança — profiles self-update

```sql
-- Migration: fix_profiles_rls_privilege_escalation

-- Remover política atual que permite atualização irrestrita
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Nova política: usuário só pode atualizar campos não-privilegiados
-- Usando WITH CHECK para impedir escalada de privilégio
CREATE POLICY "profiles_update_own_safe"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  -- Impede alteração de campos privilegiados pelo próprio usuário
  -- role, can_withdraw e suspended_at só podem ser alterados por admin
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND can_withdraw = (SELECT can_withdraw FROM public.profiles WHERE id = auth.uid())
  AND (suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM public.profiles WHERE id = auth.uid()))
);
```

### 10.3 Correção — withdrawals sem bypass do fluxo

```sql
-- Migration: fix_withdrawals_direct_insert_bypass

-- Remover política que permite inserção direta pelo usuário
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;

-- Inserções agora somente via service_role (edge function request-withdrawal)
-- Service_role bypassa RLS por padrão, portanto nenhuma nova política é necessária
-- Documentação: INSERT deve passar pelo edge function request-withdrawal
```

### 10.4 Função atômica para admin-adjust-balance

```sql
-- Migration: add_admin_adjust_balance_atomic

CREATE OR REPLACE FUNCTION public.admin_adjust_balance_atomic(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validações
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('error_code', 'INVALID_AMOUNT', 'error_message', 'Valor não pode ser zero');
  END IF;

  IF abs(p_amount) > 100000 THEN
    RETURN jsonb_build_object('error_code', 'AMOUNT_TOO_HIGH', 'error_message', 'Valor máximo é R$ 100.000,00');
  END IF;

  IF length(trim(p_reason)) < 5 THEN
    RETURN jsonb_build_object('error_code', 'REASON_TOO_SHORT', 'error_message', 'Motivo mínimo 5 caracteres');
  END IF;

  -- Verificar que o chamador é admin
  IF NOT public.has_role(p_admin_id, 'admin') THEN
    RETURN jsonb_build_object('error_code', 'UNAUTHORIZED', 'error_message', 'Apenas administradores podem ajustar saldo');
  END IF;

  -- Lock da wallet para evitar race condition
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('error_code', 'WALLET_NOT_FOUND', 'error_message', 'Carteira não encontrada');
  END IF;

  v_new_balance := v_wallet.balance + p_amount;

  -- Impedir saldo negativo em ajustes
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object(
      'error_code', 'INSUFFICIENT_BALANCE',
      'error_message', format('Saldo insuficiente. Saldo atual: R$ %s', to_char(v_wallet.balance, 'FM999G999D00'))
    );
  END IF;

  -- Atualizar saldo
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- Registrar transação
  INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_type, reference_id)
  VALUES (p_user_id, p_amount, 'admin_adjust', trim(p_reason), 'admin_adjustment', p_admin_id::text)
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_balance', v_wallet.balance,
    'new_balance', v_new_balance,
    'amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_balance_atomic TO service_role;
```

### 10.5 Remoção do enum legado `mlq`

```sql
-- Migration: remove_legacy_mlq_enum_value
-- AVISO: Esta migration não pode ser revertida (ALTER TYPE DROP VALUE é irreversível no PostgreSQL < 16)
-- Verificar que não existem registros com mlq antes de executar:
-- SELECT count(*) FROM public.assets WHERE asset_type = 'mlq';
-- SELECT count(*) FROM public.category_asset_availability WHERE asset_type = 'mlq';

-- No PostgreSQL 16+:
-- ALTER TYPE public.asset_type DROP VALUE IF EXISTS 'mlq';

-- No PostgreSQL < 16 (workaround):
-- Criar novo enum sem o valor legado e migrar a tabela
-- (operação complexa — consultar DBA antes de executar em produção)
```

### 10.6 Correção da política de promotions

```sql
-- Migration: fix_promotions_rls_anon_access

DROP POLICY IF EXISTS "promotions_select_active" ON public.promotions;

CREATE POLICY "promotions_select_active"
ON public.promotions
FOR SELECT
TO authenticated  -- Adicionado: apenas usuários autenticados
USING (is_active = true);
```

### 10.7 FK em admin_alerts

```sql
-- Migration: add_admin_alerts_acknowledged_by_fk

ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_acknowledged_by_fkey
  FOREIGN KEY (acknowledged_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;
```

### 10.8 Adicionar created_at à wallets

```sql
-- Migration: add_wallets_created_at

ALTER TABLE public.wallets
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
```

### 10.9 Configurar pg_cron para close-auctions

```sql
-- Migration: configure_pg_cron_close_auctions
-- Executar como superuser no Supabase SQL editor

SELECT cron.schedule(
  'close-expired-auctions',
  '* * * * *',  -- Todo minuto
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/close-auctions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', current_setting('app.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Resumo Executivo

O banco de dados do OxyBroker demonstra um design maduro com boas práticas em várias áreas: funções atômicas com `FOR UPDATE` locks, idempotência no processamento de webhooks Stripe, sistema de promoções bem estruturado e RLS progressivamente refinada. No entanto, foram identificados **3 problemas críticos de segurança** e **ausência total de indexes** nas tabelas de maior volume transacional.

### Prioridades de ação imediata:

| # | Problema | Risco | Esforço |
|---|----------|-------|---------|
| 1 | `profiles_update_own` permite auto-promoção para admin | CRITICO | Baixo |
| 2 | `withdrawals_insert_own` permite saque sem debitar saldo | CRITICO | Baixo |
| 3 | `admin-adjust-balance` não é atômico | ALTO | Médio |
| 4 | Ausência de indexes em `bids` e `wallet_transactions` | ALTO | Baixo |
| 5 | Dados bancários em texto claro em `withdrawals.bank_info` | MÉDIO | Alto |
