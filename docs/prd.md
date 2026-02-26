# OxyBroker — Enhancement PRD
*Gerado por Morgan (Product Manager) em 2026-02-26*
*Versao: 1.0*
*Baseado em: brownfield-assessment.md, architecture-review.md, database-audit.md*

---

## Executive Summary

O OxyBroker e uma plataforma de leiloes de ativos comerciais B2B operada pela O2 Inc., que movimenta dinheiro real via Stripe e gestiona lancamentos em tempo real. O sistema esta funcionalmente completo como MVP — fluxo de lance, anti-sniping, realtime e o painel de analytics estao implementados. No entanto, a auditoria tecnica de Phase 0 revelou **vulnerabilidades criticas de seguranca** que permitem escalada de privilegio e bypass financeiro, alem de divida tecnica arquitetural significativa que impede o sistema de escalar com seguranca.

As melhorias propostas neste PRD tratam, em ordem de prioridade: (1) falhas de seguranca criticas que devem ser corrigidas antes de qualquer escala da base de usuarios, pois representam vetores de ataque financeiro real; (2) problemas arquiteturais de alta severidade que causam instabilidade crescente a medida que o volume aumenta; (3) performance e otimizacao de banco que se tornarao gargalos criticos com volume de producao; e (4) divida tecnica de codigo que aumenta o custo de manutencao e o risco de novos bugs.

O objetivo e levar o OxyBroker de um estado de "apto para MVP/beta" para um estado de "apto para escala producao", com seguranca financeira robusta, arquitetura de autenticacao singleton, banco de dados indexado, e codebase unificado em padroes consistentes. As melhorias estao divididas em 3 sprints de 2-3 semanas cada, priorizadas para que cada sprint entregue valor independente e reduza risco de forma cumulativa.

---

## Metricas de Sucesso

| Categoria | Metrica | Baseline (atual) | Meta (pos-melhorias) |
|-----------|---------|-----------------|---------------------|
| Seguranca | Vulnerabilidades criticas abertas | 3 (escalada privilegio, bypass saque, race condition) | 0 |
| Performance | Tempo de carregamento de LotDetail (P50) | ~400ms (4 round-trips) | <120ms (1 query com join) |
| Performance | Full table scans em queries de lance | 100% (zero indexes em bids) | 0% (indexes criados) |
| Estabilidade | Subscricoes paralelas de auth por sessao | 8-12 instancias | 1 (AuthContext singleton) |
| Estabilidade | Notificacoes de outbid duplicadas | 100% dos eventos | 0% (canal unico) |
| Qualidade | Arquivos com formatCurrency duplicada | 9 arquivos | 1 (src/lib/format.ts) |
| Qualidade | Sistemas de toast coexistindo | 2 (shadcn + sonner) | 1 unificado |
| Qualidade | Hooks usando useState manual vs TanStack Query | 5 hooks manuais | 0 (todos TanStack Query) |
| Tipo | TypeScript strict violations | Strict: false | Strict: true sem erros |
| Cobertura | Testes com cobertura real | 0% | >60% em hooks criticos |
| UX | Notificacoes com link contextual | 0% | 100% (bid_outbid, bid_won) |
| UX | Confirmacao de destinatario em transferencias | Ausente | Implementado |

---

## Epic 1: Seguranca Critica — Vulnerabilidades Financeiras e de Privilegio

*Risco: CRITICO | Esforca: Medio | Impacto: Alto*
*Sprint: 1 — BLOQUEANTE para producao*

### Descricao

Tres vulnerabilidades criticas identificadas na auditoria de banco de dados representam vetores de ataque reais contra um sistema que movimenta dinheiro via Stripe:

1. **Escalada de privilegio via `profiles_update_own`**: qualquer usuario autenticado pode executar `UPDATE public.profiles SET role = 'admin'` e se tornar administrador imediatamente, pois a policy RLS nao tem `WITH CHECK` restringindo campos sensiveis (`role`, `can_withdraw`, `suspended_at`).

2. **Bypass financeiro via `withdrawals_insert_own`**: a policy permite inserir diretamente na tabela `withdrawals` sem passar pelo edge function `request-withdrawal`, criando registros de saque sem debitar o saldo da carteira.

3. **Race condition em `admin-adjust-balance`**: unica operacao financeira nao atomica — faz SELECT + UPDATE em dois passos sem `FOR UPDATE` lock, permitindo que operacoes concorrentes (compras, lances) alterem o saldo entre os dois passos, corrompendo o balance.

Essas tres issues devem ser corrigidas antes de qualquer push de marketing ou onboarding de novos usuarios.

### Historias de Usuario

#### US-1.1: Bloquear auto-promoco de role em profiles

- **Como:** Usuario autenticado mal-intencionado tentando escalar privilegios
- **Quero:** Nao conseguir atualizar campos restritos (`role`, `can_withdraw`, `suspended_at`) no meu proprio perfil via API direta
- **Para:** Que a plataforma mantenha integridade de hierarquia de papeis
- **Criterios de aceite:**
  - [ ] A policy `profiles_update_own` tem `WITH CHECK` restringindo os campos atualizaveis pelo proprio usuario
  - [ ] Um usuario `franquia` nao consegue executar `UPDATE profiles SET role = 'admin'` via Supabase JS client
  - [ ] Um usuario `franquia` nao consegue executar `UPDATE profiles SET can_withdraw = true` via API
  - [ ] Um usuario `franquia` nao consegue remover `suspended_at` via API direta
  - [ ] Admins ainda conseguem atualizar esses campos normalmente
  - [ ] Usuarios conseguem atualizar campos publicos do perfil (`full_name`, `avatar_url`) sem problema
  - [ ] Existe migration SQL aplicada e testada no ambiente de staging antes de producao
- **Arquivos afetados:**
  - `supabase/migrations/[novo_timestamp]_fix_profiles_update_rls.sql` (nova migration)
  - Opcional: criar RPC `update_profile(full_name, avatar_url)` para encapsular updates permitidos

---

#### US-1.2: Forcar insercao de saques exclusivamente via Edge Function

- **Como:** Usuario autenticado tentando criar saque fraudulento sem debitar saldo
- **Quero:** Nao conseguir inserir diretamente na tabela `withdrawals` via Supabase JS client
- **Para:** Que todo saque passe obrigatoriamente pelo fluxo atomico de validacao de saldo
- **Criterios de aceite:**
  - [ ] A policy `withdrawals_insert_own` e removida da tabela `withdrawals`
  - [ ] Qualquer tentativa de INSERT direto em `withdrawals` pelo cliente retorna erro de RLS
  - [ ] O edge function `request-withdrawal` continua funcionando (usa service_role que bypassa RLS)
  - [ ] O fluxo de saque via UI continua operacional end-to-end
  - [ ] Teste de regressao: saque de valor valido retorna sucesso e debita saldo
  - [ ] Teste de seguranca: INSERT direto via anon/authenticated key retorna `new row violates row-level security`
- **Arquivos afetados:**
  - `supabase/migrations/[novo_timestamp]_fix_withdrawals_rls.sql` (remocao da policy insert_own)
  - `supabase/functions/request-withdrawal/index.ts` (verificar integridade — nao alterar logica)

---

#### US-1.3: Tornar admin-adjust-balance atomico com RPC PostgreSQL

- **Como:** Administrador ajustando saldo de usuario durante operacoes concorrentes
- **Quero:** Que o ajuste de saldo seja atomico e livre de race conditions
- **Para:** Garantir que o saldo seja sempre matematicamente correto mesmo sob carga
- **Criterios de aceite:**
  - [ ] Criado RPC `admin_adjust_balance_atomic(target_user_id, amount, description)` como `SECURITY DEFINER`
  - [ ] O RPC executa SELECT com `FOR UPDATE` + UPDATE + INSERT em wallet_transactions em uma unica transacao
  - [ ] O edge function `admin-adjust-balance` e refatorado para chamar o novo RPC via `supabase.rpc()`
  - [ ] Suporte a ajustes negativos (debito admin) alem dos positivos ja existentes
  - [ ] A "rollback manual" do codigo atual (UPDATE para restaurar valor antigo) e eliminada
  - [ ] Teste de concorrencia: dois ajustes simultaneos resultam em soma correta (nao perdas por race)
  - [ ] Teste: ajuste positivo aparece no extrato como `admin_adjust`
  - [ ] Teste: ajuste negativo com valor maior que saldo retorna erro sem alterar saldo
- **Arquivos afetados:**
  - `supabase/migrations/[novo_timestamp]_add_admin_adjust_balance_atomic.sql` (nova funcao)
  - `supabase/functions/admin-adjust-balance/index.ts` (refatorar para usar RPC)

---

#### US-1.4: Restringir CORS das Edge Functions ao dominio da aplicacao

- **Como:** Atacante tentando chamar Edge Functions de origem nao autorizada
- **Quero:** Que as Edge Functions rejeitem requests de origens desconhecidas
- **Para:** Reduzir a superficie de ataque de chamadas nao autorizadas
- **Criterios de aceite:**
  - [ ] Todos os edge functions substituem `"Access-Control-Allow-Origin": "*"` pelo dominio da aplicacao
  - [ ] Configuracao via variavel de ambiente `ALLOWED_ORIGIN` no Supabase
  - [ ] Chamadas de `localhost` (desenvolvimento) continuam funcionando via condicional de ambiente
  - [ ] `stripe-webhook` e tratado separadamente (webhook do Stripe nao e chamado pelo browser — CORS pode ser removido)
  - [ ] Nenhum edge function de producao usa `"*"` como origem permitida
- **Arquivos afetados:**
  - `supabase/functions/place-bid/index.ts`
  - `supabase/functions/admin-adjust-balance/index.ts`
  - `supabase/functions/create-transfer/index.ts`
  - `supabase/functions/request-withdrawal/index.ts`
  - `supabase/functions/stripe-webhook/index.ts` (remover CORS — desnecessario)
  - `supabase/functions/_shared/cors.ts` (criar utilitario compartilhado)

---

#### US-1.5: Bloquear acesso anonimo a promocoes ativas

- **Como:** Visitante nao autenticado acessando dados de marketing da plataforma
- **Quero:** Nao conseguir ver promocoes ativas sem estar autenticado
- **Para:** Que informacoes comerciais sensiveis (nomes, valores de desconto) nao sejam publicas
- **Criterios de aceite:**
  - [ ] A policy `promotions_select_active` tem `TO authenticated` adicionado
  - [ ] Sessao anonima retorna 0 linhas ao consultar `promotions`
  - [ ] Usuario autenticado `franquia` continua vendo promocoes ativas
  - [ ] Admin continua vendo todas as promocoes (ativas e inativas)
- **Arquivos afetados:**
  - `supabase/migrations/[novo_timestamp]_fix_promotions_rls.sql`

---

## Epic 2: AuthContext Singleton e Protecao de Rotas

*Risco: Alto | Esforco: Medio | Impacto: Alto*
*Sprint: 1*

### Descricao

O hook `useAuth` e instanciado independentemente em cada componente que o chama, criando entre 8 e 12 subscricoes paralelas ao `supabase.auth.onAuthStateChange` por sessao. Isso significa multiplas queries de `profiles` simultâneas, estados que podem divergir entre instancias durante login/logout, e consumo desnecessario de conexoes WebSocket. Paralelamente, as rotas `/admin/*` nao tem protecao no nivel do roteador — um usuario nao autorizado que acesse `/admin/users` diretamente ve o componente renderizando enquanto o `useRoleGuard` interno ainda esta carregando.

### Historias de Usuario

#### US-2.1: Criar AuthContext singleton com provider unico

- **Como:** Desenvolvedor mantendo o codebase
- **Quero:** Que o estado de autenticacao seja gerenciado por um unico Provider na arvore React
- **Para:** Eliminar subscricoes duplicadas ao Supabase Auth e garantir consistencia de estado
- **Criterios de aceite:**
  - [ ] Criado `src/contexts/AuthContext.tsx` com `AuthProvider` e `useAuth` hook exportados
  - [ ] Um unico `onAuthStateChange` subscription ativo por sessao
  - [ ] Um unico fetch de `profiles` por evento de auth (sem duplicatas)
  - [ ] `AuthProvider` adicionado ao topo da arvore em `App.tsx` (antes de `BrowserRouter`)
  - [ ] O arquivo `src/hooks/useAuth.ts` e refatorado para ser um alias de `useContext(AuthContext)`
  - [ ] API publica de `useAuth()` permanece identica: `{ user, session, profile, loading, signIn, signOut }`
  - [ ] O anti-pattern `setTimeout(0)` e eliminado — sequenciamento correto de `getSession` + fetch de profile
  - [ ] Todos os 25+ pontos de uso de `useAuth()` no codebase continuam funcionando sem breaking change
  - [ ] Teste: login dispara exatamente 1 fetch de profile (verificado via Supabase logs)
  - [ ] Teste: logout limpa estado de todos os componentes simultaneamente
- **Arquivos afetados:**
  - `src/contexts/AuthContext.tsx` (novo arquivo)
  - `src/hooks/useAuth.ts` (refatorado para useContext wrapper)
  - `src/App.tsx` (adicionar AuthProvider)
  - Todos os hooks que chamam `useAuth()` internamente: `useWallet`, `useTransfers`, `useMyAuctions`, `useRoleGuard`, `useOutbidNotifications`, `usePromotions`, `useActivePromotion`, `usePlaceBid`, `useBuyNow`, `useWithdraw`

---

#### US-2.2: Implementar ProtectedRoute e AdminRoute no roteador

- **Como:** Usuario nao autenticado ou sem role admin tentando acessar paginas restritas
- **Quero:** Ser redirecionado imediatamente para login ou marketplace sem ver conteudo restrito
- **Para:** Que o sistema de controle de acesso seja robusto e centralizado
- **Criterios de aceite:**
  - [ ] Criado componente `src/components/routing/ProtectedRoute.tsx` que verifica `user` e redireciona para `/auth/login` se ausente
  - [ ] Criado componente `src/components/routing/AdminRoute.tsx` que verifica `profile.role === 'admin'` e redireciona para `/marketplace` se insuficiente
  - [ ] Todas as rotas autenticadas em `App.tsx` encapsuladas em `<ProtectedRoute>`
  - [ ] Todas as rotas `/admin/*` encapsuladas em `<AdminRoute>`
  - [ ] `ProtectedRoute` exibe skeleton de loading global enquanto `AuthContext.loading === true`
  - [ ] Zero flash de conteudo admin para usuarios nao autorizados
  - [ ] `useRoleGuard()` e removido de todas as paginas admin (logica centralizada no router)
  - [ ] Teste: URL `/admin/users` acessada por usuario `franquia` redireciona para `/marketplace`
  - [ ] Teste: URL `/wallet` acessada sem sessao redireciona para `/auth/login`
  - [ ] Teste: URL `/admin/settings` acessada por admin renderiza normalmente
- **Arquivos afetados:**
  - `src/components/routing/ProtectedRoute.tsx` (novo)
  - `src/components/routing/AdminRoute.tsx` (novo)
  - `src/App.tsx` (reestruturar rotas)
  - `src/hooks/useRoleGuard.ts` (manter para retrocompatibilidade, marcar como deprecated)
  - `src/pages/admin/*.tsx` (remover chamadas a `useRoleGuard`)

---

#### US-2.3: Corrigir notificacoes de outbid duplicadas

- **Como:** Usuario participando de leilao ativo
- **Quero:** Receber exatamente um toast de "Voce foi ultrapassado" por evento de lance
- **Para:** Nao ser spammado com notificacoes duplicadas durante leiloes intensos
- **Criterios de aceite:**
  - [ ] `useOutbidNotifications` mantem apenas o canal broadcast `outbid-{user.id}` para exibir toast
  - [ ] O canal `notifications-outbid-{user.id}` (postgres_changes) e removido do hook de notificacao de UI
  - [ ] O INSERT em `notifications` continua ocorrendo no edge function `place-bid` (para historico persistente)
  - [ ] A pagina `Notifications.tsx` continua exibindo o historico de notificacoes do banco normalmente
  - [ ] Teste: dar um lance em um lote onde o usuario X era lider gera exatamente 1 toast para X
  - [ ] Teste: em leilao com muita atividade (10 lances em 10 segundos), usuario ve no maximo 10 toasts (um por evento real)
- **Arquivos afetados:**
  - `src/hooks/useOutbidNotifications.ts` (remover canal postgres_changes duplicado)

---

#### US-2.4: Migrar chamadas de Edge Function para supabase.functions.invoke()

- **Como:** Desenvolvedor mantendo o codebase
- **Quero:** Que todas as chamadas a Edge Functions usem o Supabase SDK uniformemente
- **Para:** Eliminar riscos de URL undefined em builds e centralizar tratamento de erros
- **Criterios de aceite:**
  - [ ] `useWithdraw.ts` substitui `fetch(${SUPABASE_URL}/functions/v1/request-withdrawal, ...)` por `supabase.functions.invoke('request-withdrawal', { body })`
  - [ ] `useUsers.ts` substitui `fetch()` nativo em `createUser` por `supabase.functions.invoke('create-user', { body })`
  - [ ] Variaveis de ambiente `VITE_SUPABASE_URL` nao sao mais acessadas diretamente nesses hooks
  - [ ] Tratamento de erro e consistente com o padrao do resto do projeto (try/catch + toast)
  - [ ] Teste: saque bem-sucedido continua funcionando end-to-end
  - [ ] Teste: criacao de usuario admin continua funcionando end-to-end
  - [ ] Teste: se o edge function retornar 4xx, o erro e capturado e exibido como toast
- **Arquivos afetados:**
  - `src/hooks/useWithdraw.ts`
  - `src/hooks/useUsers.ts`

---

#### US-2.5: Corrigir violacao de Rules of Hooks em usePromotions

- **Como:** Desenvolvedor usando `usePromotions` em componentes com renders condicionais
- **Quero:** Que o hook seja livre de violacoes das React Rules of Hooks
- **Para:** Prevenir bugs de runtime sutis em modo strict e prodution builds
- **Criterios de aceite:**
  - [ ] `promotionDetailsQuery` (funcao que chama `useQuery` internamente) e extraida para hook separado `usePromotionDetails(promotionId: string)`
  - [ ] `usePromotions.ts` nao exporta mais `getPromotionDetails` como funcao que instancia hooks
  - [ ] Componentes que precisavam de detalhes de uma promocao especifica usam `usePromotionDetails(id)` diretamente
  - [ ] React Strict Mode nao loga warnings sobre violacoes de hooks
  - [ ] Teste de regressao: pagina AdminPromotions carrega e exibe detalhes normalmente
- **Arquivos afetados:**
  - `src/hooks/usePromotions.ts`
  - `src/hooks/usePromotionDetails.ts` (novo hook)
  - `src/pages/admin/AdminPromotions.tsx`

---

## Epic 3: Database Indexes e Otimizacao de Queries

*Risco: Alto | Esforco: Baixo | Impacto: Alto*
*Sprint: 1*

### Descricao

A tabela `bids` — a mais critica do sistema, lida em toda operacao de lance e encerramento — nao tem nenhum index alem da PK. Sem indexes, o banco faz full table scans em operacoes de alto volume como `place_bid_atomic`, `close_auction_atomic` e `useLotDetail`. Paralelamente, `wallet_transactions`, `notifications` e `lots` tambem carecem de indexes essenciais. O custo de criar indexes e baixo (uma migration com `CREATE INDEX CONCURRENTLY`) e o impacto de performance e imediato e significativo.

A pagina de detalhe de lote (`LotDetail`) faz 4 round-trips sequenciais ao banco (lot → bids → lot_items → assets), somando ~400ms minimos de latencia em uma pagina que e o core do produto. Um unico join PostgREST resolve para ~100ms.

### Historias de Usuario

#### US-3.1: Criar indexes criticos nas tabelas de alta frequencia

- **Como:** Sistema processando lances em tempo real
- **Quero:** Que queries em `bids`, `wallet_transactions`, `lots` e `notifications` usem indexes
- **Para:** Eliminar full table scans e garantir performance sob carga de producao
- **Criterios de aceite:**
  - [ ] Migration criada e aplicada com `CREATE INDEX CONCURRENTLY IF NOT EXISTS` para evitar lock em producao
  - [ ] Indexes em `bids`: `idx_bids_lot_id(lot_id)`, `idx_bids_lot_user(lot_id, user_id)`, `idx_bids_lot_amount(lot_id, amount DESC)`, `idx_bids_user_id(user_id)`
  - [ ] Indexes em `wallet_transactions`: `idx_wallet_transactions_user_id(user_id)`, `idx_wallet_transactions_user_created(user_id, created_at DESC)`, `idx_wallet_transactions_reference(reference_type, reference_id) WHERE reference_id IS NOT NULL`
  - [ ] Indexes em `lots`: `idx_lots_status_ends_at(status, ends_at)`, index parcial `idx_lots_live_ends_at(ends_at) WHERE status = 'live'`
  - [ ] Indexes em `notifications`: `idx_notifications_user_id(user_id)`, `idx_notifications_user_unread(user_id, created_at DESC) WHERE read_at IS NULL`
  - [ ] Indexes em `lot_items`: `idx_lot_items_lot_id(lot_id)`, `idx_lot_items_asset_id(asset_id)`
  - [ ] Indexes em `transfers`: `idx_transfers_from_user(from_user_id)`, `idx_transfers_to_user(to_user_id)`
  - [ ] Index em `withdrawals`: `idx_withdrawals_user_id(user_id)`, `idx_withdrawals_pending(requested_at DESC) WHERE status = 'pending'`
  - [ ] Index em `profiles`: `idx_profiles_email(email)` (usado pelo create-transfer)
  - [ ] EXPLAIN ANALYZE antes/depois documentado para queries criticas de `bids`
  - [ ] Zero degradacao de performance em INSERTs (indexes adicionam overhead pequeno)
- **Arquivos afetados:**
  - `supabase/migrations/[novo_timestamp]_add_critical_indexes.sql` (nova migration)

---

#### US-3.2: Otimizar useLotDetail com single query e joins PostgREST

- **Como:** Usuario abrindo a pagina de detalhe de um lote
- **Quero:** Que a pagina carregue em menos de 150ms
- **Para:** Ter uma experiencia fluida na pagina mais critica do produto (onde se dao os lances)
- **Criterios de aceite:**
  - [ ] `useLotDetail` substitui 4 queries sequenciais por 1 query com embedded relations PostgREST
  - [ ] A query usa `.select('*, bids(*), lot_items(assets(*))')` com `.eq("id", lotId).maybeSingle()`
  - [ ] Tipo TypeScript do retorno e atualizado para refletir a estrutura aninhada
  - [ ] Os canais realtime continuam funcionando e chamam `refetch()` apos mudancas
  - [ ] A deduplicacao de refetch e implementada: broadcast + postgres_changes nao disparam 2 fetches simultaneos (usar debounce ou flag)
  - [ ] Teste: pagina de lote carrega com todos os dados (lot info, bids, assets) em um unico request
  - [ ] Teste: dar um lance atualiza a lista de bids via realtime corretamente
  - [ ] Medida de performance: LotDetail load time P50 < 150ms em staging
- **Arquivos afetados:**
  - `src/hooks/useLotDetail.ts`

---

#### US-3.3: Otimizar useTransfers com join de profiles

- **Como:** Usuario acessando a pagina de transferencias
- **Quero:** Que as transferencias sejam carregadas com os nomes dos remetentes/destinatarios em uma unica query
- **Para:** Eliminar o 2-step lookup desnecessario
- **Criterios de aceite:**
  - [ ] `useTransfers` substitui 2 queries (transfers + profiles) por uma unica query com aliases PostgREST
  - [ ] A query usa `from_profile:profiles!from_user_id(full_name, email)` e `to_profile:profiles!to_user_id(full_name, email)`
  - [ ] Tipo TypeScript do retorno e atualizado
  - [ ] Pagina `Transfers.tsx` continua renderizando nomes corretamente
  - [ ] Teste de regressao: transferencia enviada e recebida aparecem corretamente na lista
- **Arquivos afetados:**
  - `src/hooks/useTransfers.ts`
  - `src/pages/Transfers.tsx`

---

#### US-3.4: Criar hooks dedicados para Purchases e Notifications

- **Como:** Desenvolvedor mantendo as paginas de Compras e Notificacoes
- **Quero:** Que a logica de fetch seja extraida para hooks customizados
- **Para:** Seguir o padrao do projeto e habilitar reuso e testabilidade
- **Criterios de aceite:**
  - [ ] Criado `src/hooks/usePurchases.ts` com logica extraida de `Purchases.tsx`
  - [ ] Criado `src/hooks/useNotifications.ts` com logica extraida de `Notifications.tsx`
  - [ ] `Purchases.tsx` usa `usePurchases()` — zero fetch logic direta no componente
  - [ ] `Notifications.tsx` usa `useNotifications()` — zero fetch logic direta no componente
  - [ ] `AdminSettings.tsx` usa hook `useAppSettings()` — zero fetch logic direta no componente
  - [ ] Subscricao realtime de `Notifications.tsx` e gerenciada no hook com cleanup correto
  - [ ] Teste: pagina de compras lista compras e devolucoes corretamente
  - [ ] Teste: pagina de notificacoes lista e marca como lida corretamente
- **Arquivos afetados:**
  - `src/hooks/usePurchases.ts` (novo)
  - `src/hooks/useNotifications.ts` (novo)
  - `src/hooks/useAppSettings.ts` (novo)
  - `src/pages/Purchases.tsx`
  - `src/pages/Notifications.tsx`
  - `src/pages/admin/AdminSettings.tsx`

---

## Epic 4: Unificacao de State Management com TanStack Query

*Risco: Medio | Esforco: Alto | Impacto: Alto*
*Sprint: 2*

### Descricao

Metade dos hooks usa `useState + useEffect` manual (sem cache, sem deduplicacao), e a outra metade usa TanStack Query (com cache, invalidacao automatica). Isso cria dois ecossistemas paralelos: `useWallet` e `useTransfers` sem cache fazem um novo fetch a cada mount do componente, enquanto `useMyAuctions` tem cache automatico. O resultado e requests redundantes ao banco, invalidacao inconsistente apos mutacoes (compra via `buy_now` nao atualiza automaticamente o saldo da carteira), e dificuldade crescente de manutencao.

### Historias de Usuario

#### US-4.1: Migrar useWallet para TanStack Query com invalidacao cruzada

- **Como:** Usuario visualizando saldo em diferentes partes da UI (TopBar, Wallet, BidPanel)
- **Quero:** Que o saldo seja consistente em todos os componentes e atualizado automaticamente apos transacoes
- **Para:** Nao ver saldos desatualizados apos lances, compras ou recargas
- **Criterios de aceite:**
  - [ ] `useWallet` refatorado para usar `useQuery({ queryKey: ["wallet", user?.id], queryFn: ... })`
  - [ ] `queryKey` factory criada em `src/lib/query-keys.ts` (ex: `queryKeys.wallet(userId)`)
  - [ ] `useBuyNow` chama `queryClient.invalidateQueries(queryKeys.wallet(userId))` em `onSuccess`
  - [ ] `useTopUp` chama `queryClient.invalidateQueries(queryKeys.wallet(userId))` em `onSuccess`
  - [ ] `useWithdraw` chama `queryClient.invalidateQueries(queryKeys.wallet(userId))` em `onSuccess`
  - [ ] `TopBar`, `Wallet.tsx`, `BidPanel`, `LotDetail` e `Transfers.tsx` — todos usam o mesmo cache, zero queries duplicadas
  - [ ] Polling de 30s removido de `useMyAuctions` (realtime ja cobre)
  - [ ] Teste: comprar um lote atualiza o saldo exibido no TopBar sem reload
  - [ ] Teste: recarregar via Stripe atualiza o saldo apos retorno do checkout
  - [ ] Teste: 5 componentes com `useWallet()` ativos = 1 unico request ao banco (verificado via network tab)
- **Arquivos afetados:**
  - `src/hooks/useWallet.ts`
  - `src/lib/query-keys.ts` (novo arquivo)
  - `src/hooks/useBuyNow.ts`
  - `src/hooks/useTopUp.ts`
  - `src/hooks/useWithdraw.ts`
  - `src/hooks/useMyAuctions.ts` (remover polling)

---

#### US-4.2: Migrar useUsers (admin) para TanStack Query

- **Como:** Administrador gerenciando usuarios na pagina AdminUsers
- **Quero:** Que a lista de usuarios seja atualizada automaticamente apos criar/editar/excluir
- **Para:** Nao precisar recarregar a pagina manualmente apos operacoes admin
- **Criterios de aceite:**
  - [ ] `useUsers.ts` refatorado para `useQuery` (listagem) + `useMutation` (CRUD)
  - [ ] Seguir padrao ja estabelecido em `useAdminLots.ts` (o hook mais bem implementado do projeto)
  - [ ] Filtros de busca, role e status migrados para server-side (passados como parametros da query)
  - [ ] Busca por nome/email funciona em todos os usuarios, nao apenas na pagina atual
  - [ ] Paginacao server-side mantida e integrada com TanStack Query (`queryKey` inclui `page`, `search`, `roleFilter`)
  - [ ] `createUser`, `updateUser`, `deleteUser`, `suspendUser` sao `useMutation` com `onSuccess` invalidando a listagem
  - [ ] Teste: criar usuario via modal atualiza a lista sem reload
  - [ ] Teste: buscar "joao" retorna usuarios com "joao" em qualquer pagina, nao apenas na pagina 1
- **Arquivos afetados:**
  - `src/hooks/useUsers.ts`
  - `src/pages/admin/AdminUsers.tsx`

---

#### US-4.3: Migrar useLots para TanStack Query com realtime via invalidacao

- **Como:** Usuario no marketplace vendo lotes em tempo real
- **Quero:** Que novos lotes e mudancas de status aparecan automaticamente
- **Para:** Ter o marketplace sempre atualizado sem polling desnecessario
- **Criterios de aceite:**
  - [ ] `useLots.ts` refatorado para `useQuery`
  - [ ] Evento realtime `postgres_changes` em `lots` chama `queryClient.invalidateQueries(queryKeys.lots(...))` em vez de `setState` manual
  - [ ] Nome do canal realtime inclui as opcoes do hook para evitar colisao: `lots-realtime-${status}-${search}`
  - [ ] `useLots.ts` (hook nao utilizado) e removido ou marcado claramente como alias de `useMarketplaceFilters`
  - [ ] Teste: publicar um lote no admin aparece no marketplace sem reload
  - [ ] Teste: lote que expira muda de status no marketplace em tempo real
- **Arquivos afetados:**
  - `src/hooks/useLots.ts`
  - `src/hooks/useMarketplaceFilters.ts`

---

#### US-4.4: Remover dead code e dependencias nao utilizadas

- **Como:** Desenvolvedor novo integrando ao projeto
- **Quero:** Que o codebase nao tenha arquivos e dependencias mortas que causem confusao
- **Para:** Ter uma base de codigo limpa e clara
- **Criterios de aceite:**
  - [ ] `next-themes` removido de `package.json` (nunca importado — ThemeContext proprio e utilizado)
  - [ ] `lovable-tagger` removido de `package.json` (artefato do Lovable, sem valor para o projeto)
  - [ ] `src/pages/Index.tsx` removido (componente vazio nao utilizado — App.tsx faz redirect direto)
  - [ ] `src/hooks/useLots.ts` (se substituido) marcado como removido com comentario no git
  - [ ] `npm run build` sem warnings de dependencias nao utilizadas
  - [ ] Bundle size reduzido mensuravelmente (validar com `npx vite-bundle-analyzer`)
- **Arquivos afetados:**
  - `package.json`
  - `src/pages/Index.tsx`

---

#### US-4.5: Implementar code splitting para rotas admin

- **Como:** Usuario franquia acessando o marketplace pela primeira vez
- **Quero:** Que o bundle inicial nao inclua codigo das paginas admin
- **Para:** Ter carregamento inicial mais rapido (LCP)
- **Criterios de aceite:**
  - [ ] Todas as 7 paginas admin usam `React.lazy()` e `import()` dinamico
  - [ ] `<Suspense fallback={<AdminSkeleton />}>` encapsulando as rotas admin
  - [ ] Bundle inicial (chunk principal) nao inclui `AdminLots`, `AdminUsers`, `AdminAssets`, etc.
  - [ ] `vite.config.ts` configurado com `rollupOptions.output.manualChunks` para separar vendor chunks (react, tanstack, supabase, recharts)
  - [ ] Medida: first load bundle size reduzido em >20% para usuarios nao-admin
  - [ ] Teste: usuario admin navega para `/admin/lots` — chunk carrega na primeira visita, fica em cache nas seguintes
- **Arquivos afetados:**
  - `src/App.tsx`
  - `vite.config.ts`
  - `src/components/admin/AdminSkeleton.tsx` (novo)

---

## Epic 5: Qualidade de Codigo e Utilitarios Compartilhados

*Risco: Baixo | Esforco: Medio | Impacto: Medio*
*Sprint: 2*

### Descricao

`formatCurrency` com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` esta duplicada em pelo menos 9 arquivos. `formatDate` idem. Dois sistemas de toast coexistem simultaneamente no DOM (`shadcn/use-toast` e `sonner`). Emojis hardcoded em toasts de producao criam problemas de acessibilidade. Badges usam 3 sistemas diferentes de styling. Essas inconsistencias aumentam o custo de cada mudanca futura e introduzem bugs visuais.

### Historias de Usuario

#### US-5.1: Centralizar formatadores de moeda e data

- **Como:** Desenvolvedor adicionando uma nova feature que exibe valores monetarios
- **Quero:** Ter uma funcao `formatCurrency` importavel de um local canonico
- **Para:** Nao duplicar a mesma funcao novamente e manter consistencia de formatacao
- **Criterios de aceite:**
  - [ ] Criado `src/lib/format.ts` com `formatCurrency(value: number): string` e `formatDate(date: string | Date, opts?): string`
  - [ ] Todas as 9+ copias duplicadas de `formatCurrency` removidas dos arquivos que a definem localmente
  - [ ] Todas as copias substituidas por `import { formatCurrency } from "@/lib/format"`
  - [ ] Mesma cobertura de casos: valores negativos, zero, valores grandes
  - [ ] Teste unitario para `formatCurrency` e `formatDate` com casos de borda
  - [ ] ESLint rule ou comentario no arquivo para prevenir futuras duplicacoes
- **Arquivos afetados:**
  - `src/lib/format.ts` (novo)
  - `src/pages/LotDetail.tsx`
  - `src/pages/Wallet.tsx`
  - `src/pages/Transfers.tsx`
  - `src/pages/Purchases.tsx`
  - `src/pages/MyAuctions.tsx`
  - `src/pages/admin/AdminLots.tsx`
  - `src/pages/admin/AdminPromotions.tsx`
  - `src/components/auction/BidPanel.tsx`
  - `src/components/layout/TopBar.tsx`

---

#### US-5.2: Unificar sistema de toast

- **Como:** Usuario recebendo feedback de acoes na plataforma
- **Quero:** Que todos os toasts tenham aparencia e comportamento consistentes
- **Para:** Ter uma experiencia visual coerente e previsivel
- **Criterios de aceite:**
  - [ ] Escolhido um sistema de toast como padrao (recomendado: `sonner` pelo melhor suporte a promises e design)
  - [ ] Todos os `toast()` do codebase importam do sistema escolhido
  - [ ] O sistema descartado e removido de `App.tsx` e de `package.json`
  - [ ] `<Toaster>` e `<Sonner>` — apenas um renderizado no DOM
  - [ ] Todos os toasts existentes (sucesso, erro, warning) continuam funcionando visivelmente
  - [ ] Teste: dar lance exibe toast de sucesso com texto correto e design consistente
  - [ ] Teste: erro em transfer exibe toast de erro visivelmente
- **Arquivos afetados:**
  - `src/App.tsx`
  - `src/hooks/use-toast.ts` (deprecar ou remover)
  - Todos os ~20 hooks e paginas que importam `toast`
  - `package.json`

---

#### US-5.3: Padronizar sistema de badges e styling de status

- **Como:** Desenvolvedor adicionando um novo badge de status
- **Quero:** Ter um padrao claro de qual sistema usar para badges
- **Para:** Manter consistencia visual e evitar criar um quarto sistema de styling
- **Criterios de aceite:**
  - [ ] Definida decisao arquitetural: usar classes `.oxy-badge-*` do design system como padrao
  - [ ] `MyAuctions.tsx` substituir `bg-green-500/10 text-green-600 border-green-500/30` por `oxy-badge-success`
  - [ ] `AdminUsers.tsx` substituir `roleColors[...]` por classes `.oxy-badge-*` equivalentes
  - [ ] `AuctionStatusBadge` e o componente padrao para status de leilao — todos os outros pontos que duplicam essa logica sao substituidos
  - [ ] Emojis em toasts de producao substituidos por icones Lucide (`Trophy`, `Bell`, `CheckCircle`)
  - [ ] `BidPanel.tsx` toast sem emoji "🚀 Lance aceito + tempo estendido!" → texto com icone acessivel
  - [ ] `useOutbidNotifications` toast sem emoji "🔔 Voce foi ultrapassado!" → texto com icone
  - [ ] Teste de acessibilidade: screen reader le corretamente os badges de status (sem dependencia de emoji)
- **Arquivos afetados:**
  - `src/pages/MyAuctions.tsx`
  - `src/pages/admin/AdminUsers.tsx`
  - `src/components/auction/BidPanel.tsx`
  - `src/hooks/useOutbidNotifications.ts`
  - `src/pages/LotDetail.tsx`

---

#### US-5.4: Padronizar chamadas a useRoleGuard e tabelas admin

- **Como:** Desenvolvedor lendo o codigo admin
- **Quero:** Que `useRoleGuard` seja sempre chamado com o mesmo formato e que tabelas sigam um componente unico
- **Para:** Reduzir cognitive load e facilitar code reviews
- **Criterios de aceite:**
  - [ ] Apos US-2.2 (ProtectedRoute), `useRoleGuard` e removido das paginas admin (redundante)
  - [ ] Se `useRoleGuard` for mantido em outras paginas, padronizar para sempre aceitar array: `useRoleGuard(["admin"])`
  - [ ] `AdminLots.tsx` e `AdminAssets.tsx` migrados de `<table>` nativo com `.oxy-table` para componente `<Table>` do shadcn/ui
  - [ ] Comportamento visual identico ao `AdminUsers.tsx` (referencia de implementacao correta)
  - [ ] Colunas de tabela com `sort` e `filter` se ja existiam sao mantidas
  - [ ] Teste visual: todas as tabelas admin tem aparencia consistente (header, hover, padding)
- **Arquivos afetados:**
  - `src/pages/admin/AdminLots.tsx`
  - `src/pages/admin/AdminAssets.tsx`
  - `src/hooks/useRoleGuard.ts`

---

#### US-5.5: Corrigir navegacao SPA e duplicidade de email em perfil

- **Como:** Usuario em MyAuctions clicando em "Ir para marketplace"
- **Quero:** Navegar sem full page reload
- **Para:** Manter o estado da aplicacao e ter uma experiencia SPA fluida
- **Criterios de aceite:**
  - [ ] `window.location.href = "/marketplace"` em `MyAuctions.tsx` substituido por `useNavigate()`
  - [ ] Todos os casos de `window.location.href` no codebase substituidos por `useNavigate` (auditoria completa)
  - [ ] `useAuth` padronizado para usar `user.email` como fonte de verdade (nao `profile.email`)
  - [ ] `profile.email` ainda carregado do banco mas apenas como fallback — nao como fonte primaria
  - [ ] Comentario no codigo documentando `user.email` como source of truth
  - [ ] Teste: clicar em "Ir para marketplace" nao dispara reload da pagina (verificado via DevTools Network)
- **Arquivos afetados:**
  - `src/pages/MyAuctions.tsx`
  - `src/hooks/useAuth.ts` (ou `AuthContext.tsx`)

---

## Epic 6: TypeScript Strict e Cobertura de Testes

*Risco: Baixo | Esforco: Alto | Impacto: Medio*
*Sprint: 3*

### Descricao

`tsconfig.app.json` tem `strict: false`, `noImplicitAny: false`, e `noUnusedLocals: false`. Em um sistema financeiro, `any` implicito em parametros de funcoes de calculo de saldo e de alto risco. A infraestrutura de testes (Vitest + Testing Library) esta configurada mas sem testes reais implementados. A cobertura de testes em hooks criticos (usePlaceBid, useBuyNow, useWallet) e zero.

### Historias de Usuario

#### US-6.1: Habilitar TypeScript strict mode progressivamente

- **Como:** Desenvolvedor adicionando codigo financeiro
- **Quero:** Que o compilador TypeScript rejeite tipagem fraca em codigo de producao
- **Para:** Prevenir bugs de tipo em operacoes de saldo que passariam silenciosamente com `any`
- **Criterios de aceite:**
  - [ ] Fase 1: `noImplicitAny: true` habilitado — todos os erros emergentes corrigidos
  - [ ] Fase 2: `strict: true` habilitado — null checks e erros restantes corrigidos
  - [ ] `noUnusedLocals: true` e `noUnusedParameters: true` habilitados
  - [ ] Zero casts `as T` sem validacao — substituidos por parsing tipado (Zod ou type guards)
  - [ ] Respostas de Edge Functions tipadas via interfaces correspondentes, nao `as PlaceBidResult`
  - [ ] `npm run build` sem erros TypeScript
  - [ ] `npm run typecheck` adicionado ao `package.json` scripts e ao pipeline de CI (se existir)
- **Arquivos afetados:**
  - `tsconfig.app.json`
  - Possivelmente todos os hooks (correccao de tipos emergentes)

---

#### US-6.2: Implementar testes unitarios em hooks criticos

- **Como:** Desenvolvedor fazendo refactor de hooks financeiros
- **Quero:** Ter cobertura de teste que detecte regressoes
- **Para:** Fazer mudancas com confianca em codigo que lida com dinheiro real
- **Criterios de aceite:**
  - [ ] `useWallet.test.ts` — testa: carregamento de saldo, erro de fetch, refetch apos invalidacao
  - [ ] `usePlaceBid.test.ts` — testa: lance aceito, lance rejeitado (saldo insuficiente), lance em leilao encerrado
  - [ ] `useBuyNow.test.ts` — testa: compra bem-sucedida, erro de saldo, item ja comprado
  - [ ] `src/lib/format.test.ts` — testa: `formatCurrency` com valores positivos, negativos, zero, decimais
  - [ ] `AuthContext.test.tsx` — testa: provider com user autenticado, sem user, loading state
  - [ ] Cobertura de linhas > 60% nos 5 arquivos acima
  - [ ] `npm test` passa sem falhas em CI
  - [ ] Mocking de `supabase` client via `vi.mock` configurado em `src/__tests__/setup.ts`
- **Arquivos afetados:**
  - `src/__tests__/setup.ts`
  - `src/hooks/useWallet.test.ts` (novo)
  - `src/hooks/usePlaceBid.test.ts` (novo)
  - `src/hooks/useBuyNow.test.ts` (novo)
  - `src/lib/format.test.ts` (novo)
  - `src/contexts/AuthContext.test.tsx` (novo)

---

#### US-6.3: Adicionar validacao Zod em formularios criticos

- **Como:** Usuario preenchendo formulario de transferencia ou saque
- **Quero:** Receber feedback de validacao claro e imediato no cliente
- **Para:** Evitar enviar requests invalidos ao servidor e ter UX melhor
- **Criterios de aceite:**
  - [ ] `Transfers.tsx` usa `react-hook-form + zod` — schema valida: email valido, valor > 0, valor <= saldo disponivel
  - [ ] `WithdrawModal.tsx` usa `react-hook-form + zod` — schema valida: dados bancarios obrigatorios, valor minimo
  - [ ] `AdminLots.tsx` formulario de criacao valida: datas futuras, preco_inicial > 0, pelo menos 1 ativo no lote
  - [ ] `AdminAssets.tsx` formulario de criacao valida: campos obrigatorios, valores numericos positivos
  - [ ] Mensagens de erro em pt-BR, visiveis inline (nao apenas como toast)
  - [ ] Submit e bloqueado ate o formulario ser valido (botao disabled)
  - [ ] Teste: tentar transferir valor negativo exibe erro inline sem chamar o edge function
  - [ ] Teste: formulario de saque sem dados bancarios nao pode ser submetido
- **Arquivos afetados:**
  - `src/pages/Transfers.tsx`
  - `src/components/wallet/WithdrawModal.tsx`
  - `src/pages/admin/AdminLots.tsx`
  - `src/pages/admin/AdminAssets.tsx`

---

## Epic 7: UX e Melhorias de Experiencia do Usuario

*Risco: Baixo | Esforco: Medio | Impacto: Medio*
*Sprint: 3*

### Descricao

Varias lacunas de UX foram identificadas que afetam diretamente a seguranca percebida e a usabilidade em um sistema financeiro: transferencias sem confirmacao de destinatario, notificacoes sem link para o lote relacionado, extrato da carteira sem paginacao, status de leilao encerrado ambiguo, e busca textual ausente no marketplace.

### Historias de Usuario

#### US-7.1: Adicionar confirmacao de destinatario em transferencias

- **Como:** Usuario enviando saldo para outro usuario
- **Quero:** Ver um step de confirmacao mostrando o nome do destinatario antes de confirmar
- **Para:** Evitar enviar dinheiro para a pessoa errada por erro de digitacao de email
- **Criterios de aceite:**
  - [ ] Formulario de transferencia tem 2 steps: (1) email + valor, (2) preview "Voce esta enviando R$ X para [Nome Completo]"
  - [ ] Step 2 faz lookup do nome do destinatario via `profiles` antes de habilitar o botao "Confirmar"
  - [ ] Email invalido (sem cadastro) exibe mensagem "Usuario nao encontrado" no step 1
  - [ ] Botao "Confirmar" no step 2 tem cor de destaque (warning/primary) para chamar atencao
  - [ ] "Voltar" no step 2 retorna ao step 1 com os dados preenchidos
  - [ ] Teste: transferencia para email valido exibe o nome correto no step 2
  - [ ] Teste: transferencia para email invalido mostra erro sem avancar para step 2
- **Arquivos afetados:**
  - `src/pages/Transfers.tsx`
  - `src/hooks/useTransfers.ts` (adicionar lookup de destinatario)

---

#### US-7.2: Adicionar links contextuais em notificacoes

- **Como:** Usuario que recebe notificacao de "voce foi ultrapassado" ou "voce ganhou"
- **Quero:** Clicar na notificacao e ser levado diretamente ao lote relacionado
- **Para:** Nao precisar navegar manualmente ate o marketplace e procurar o lote
- **Criterios de aceite:**
  - [ ] Notificacoes do tipo `bid_outbid` e `bid_won` tem `lot_id` no campo `payload` (JSONB)
  - [ ] O edge function `place-bid` inclui `lot_id` no payload ao inserir a notificacao
  - [ ] `Notifications.tsx` renderiza notificacoes com link clicavel para `/lot/:lot_id` quando `payload.lot_id` existe
  - [ ] Notificacoes sem `lot_id` renderizam normalmente sem link (retrocompatibilidade)
  - [ ] `useNotifications` marca a notificacao como lida ao clicar no link
  - [ ] Teste: clicar em notificacao de outbid navega para a pagina do lote correto
  - [ ] Teste: notificacoes antigas sem lot_id no payload continuam sendo exibidas corretamente
- **Arquivos afetados:**
  - `supabase/functions/place-bid/index.ts` (incluir lot_id no payload)
  - `src/hooks/useNotifications.ts`
  - `src/pages/Notifications.tsx`

---

#### US-7.3: Implementar paginacao no extrato da carteira

- **Como:** Usuario com historico longo de transacoes
- **Quero:** Navegar por paginas de transacoes ou usar scroll infinito
- **Para:** Acessar transacoes mais antigas que as ultimas 50
- **Criterios de aceite:**
  - [ ] `useWallet` suporta `page` e `pageSize` como parametros (ou cursor-based com `before` timestamp)
  - [ ] `Wallet.tsx` exibe controles de paginacao ("Anterior", "Proximo", numero de pagina atual)
  - [ ] Limite de 50 hardcoded em `useWallet.ts` removido — substituido por `pageSize` configuravel (default: 20)
  - [ ] `queryKey` inclui `page` para que TanStack Query cache cada pagina separadamente
  - [ ] Teste: usuario com 60 transacoes ve 20 na primeira pagina e 20 na segunda
  - [ ] Teste: navegar para pagina 2 e voltar para pagina 1 e instantaneo (cache)
- **Arquivos afetados:**
  - `src/hooks/useWallet.ts`
  - `src/pages/Wallet.tsx`

---

#### US-7.4: Corrigir status de leilao encerrado em MyAuctions

- **Como:** Usuario que participou de um leilao que ja encerrou
- **Quero:** Ver o status correto ("Vencedor" ou "Nao adquirido") em vez de "ganhando"/"perdendo"
- **Para:** Entender claramente o resultado final dos leiloes que participei
- **Criterios de aceite:**
  - [ ] `MyAuctions.tsx` distingue entre leilao `live` e `ended` ao exibir o status do lance
  - [ ] Leilao `ended` onde o usuario e o vencedor: badge "Vencedor" (verde)
  - [ ] Leilao `ended` onde o usuario perdeu: badge "Nao adquirido" (cinza)
  - [ ] Leilao `ended` convertido em compra (via purchase): badge "Comprado" com link para Purchases
  - [ ] Leilao `live`: comportamento atual mantido ("ganhando"/"perdendo")
  - [ ] Logica de determinacao no `useAuctionStatus` ou diretamente no componente de card
  - [ ] Corrigir comparacao fragil de timestamps: substituir `myLastBid.created_at === highestBid.created_at` por comparacao de `bid.id`
  - [ ] Teste: leilao encerrado onde usuario ganhou exibe "Vencedor"
  - [ ] Teste: leilao encerrado onde usuario perdeu exibe "Nao adquirido"
- **Arquivos afetados:**
  - `src/hooks/useAuctionStatus.ts`
  - `src/pages/MyAuctions.tsx`

---

#### US-7.5: Adicionar busca textual no marketplace

- **Como:** Usuario procurando um tipo especifico de lote no marketplace
- **Quero:** Poder digitar um termo de busca e filtrar os lotes pelo titulo
- **Para:** Encontrar lotes relevantes rapidamente sem precisar fazer scroll em uma lista longa
- **Criterios de aceite:**
  - [ ] `MarketplaceFilters.tsx` tem campo de busca textual ("Buscar por titulo...")
  - [ ] `useMarketplaceFilters` aceita parametro `search: string` e aplica `.ilike("title", \`%${search}%\`)` na query Supabase
  - [ ] Busca e debounced em 300ms (nao faz query a cada keystroke)
  - [ ] Busca e server-side (nao client-side sobre a pagina atual)
  - [ ] Campo de busca e limpo ao resetar filtros
  - [ ] Nenhum resultado exibe estado vazio com mensagem "Nenhum lote encontrado para sua busca"
  - [ ] Teste: buscar "premium" retorna apenas lotes com "premium" no titulo
  - [ ] Teste: campo debounce: digitar "abc" em rapida successao dispara apenas 1 request
- **Arquivos afetados:**
  - `src/hooks/useMarketplaceFilters.ts`
  - `src/components/marketplace/MarketplaceFilters.tsx`

---

#### US-7.6: Adicionar paginacao server-side no marketplace

- **Como:** Admin com 100+ lotes ativos
- **Quero:** Que o marketplace nao carregue todos os lotes de uma vez
- **Para:** Evitar lentidao e sobrecarga do banco com um unico request massivo
- **Criterios de aceite:**
  - [ ] `useMarketplaceFilters` implementa paginacao com `limit` e `offset` (ou cursor)
  - [ ] UI tem "Carregar mais" (infinite scroll) ou paginacao numerica
  - [ ] Default: 20 lotes por pagina
  - [ ] `queryKey` inclui pagina atual para cache correto
  - [ ] Teste: marketplace com 50 lotes exibe os 20 mais recentes e permite carregar mais
- **Arquivos afetados:**
  - `src/hooks/useMarketplaceFilters.ts`
  - `src/pages/Marketplace.tsx`

---

## Roadmap Visual

| Story | Epic | Sprint | Semana | Prioridade | Esforco (dias) |
|-------|------|--------|--------|-----------|---------------|
| US-1.1 | Seguranca | 1 | 1 | CRITICO | 0.5 |
| US-1.2 | Seguranca | 1 | 1 | CRITICO | 0.5 |
| US-1.3 | Seguranca | 1 | 1 | CRITICO | 1.5 |
| US-1.4 | Seguranca | 1 | 1 | CRITICO | 1 |
| US-1.5 | Seguranca | 1 | 1 | Alto | 0.5 |
| US-2.1 | AuthContext | 1 | 1-2 | CRITICO | 3 |
| US-2.2 | Routing | 1 | 2 | CRITICO | 1.5 |
| US-2.3 | Notificacoes | 1 | 2 | Alto | 0.5 |
| US-2.4 | Edge Functions | 1 | 2 | Alto | 0.5 |
| US-2.5 | Hooks | 1 | 2 | Medio | 0.5 |
| US-3.1 | DB Indexes | 1 | 1 | CRITICO | 0.5 |
| US-3.2 | Queries | 1 | 2 | Alto | 1 |
| US-3.3 | Queries | 1 | 2 | Medio | 0.5 |
| US-3.4 | Hooks | 1 | 2 | Medio | 1 |
| US-4.1 | State Mgmt | 2 | 3 | Alto | 2 |
| US-4.2 | State Mgmt | 2 | 3 | Alto | 2 |
| US-4.3 | State Mgmt | 2 | 3 | Medio | 1 |
| US-4.4 | Cleanup | 2 | 3 | Baixo | 0.5 |
| US-4.5 | Performance | 2 | 4 | Medio | 1.5 |
| US-5.1 | Code Quality | 2 | 3 | Alto | 1 |
| US-5.2 | Code Quality | 2 | 4 | Medio | 1 |
| US-5.3 | Code Quality | 2 | 4 | Medio | 1 |
| US-5.4 | Code Quality | 2 | 4 | Baixo | 0.5 |
| US-5.5 | Code Quality | 2 | 4 | Baixo | 0.5 |
| US-6.1 | TypeScript | 3 | 5 | Medio | 2 |
| US-6.2 | Testes | 3 | 5-6 | Medio | 3 |
| US-6.3 | Validacao | 3 | 5 | Medio | 2 |
| US-7.1 | UX | 3 | 6 | Medio | 1 |
| US-7.2 | UX | 3 | 6 | Medio | 1 |
| US-7.3 | UX | 3 | 6 | Baixo | 1 |
| US-7.4 | UX | 3 | 6 | Medio | 0.5 |
| US-7.5 | UX | 3 | 6 | Medio | 1 |
| US-7.6 | UX | 3 | 6 | Baixo | 1 |

### Resumo por Sprint

| Sprint | Semanas | Stories | Esforco total (dias) | Foco |
|--------|---------|---------|---------------------|------|
| Sprint 1 | 1-2 | US-1.1 a US-3.4 | ~12 | Seguranca critica + Fundacao de auth + DB indexes |
| Sprint 2 | 3-4 | US-4.1 a US-5.5 | ~12 | Unificacao de state + Qualidade de codigo |
| Sprint 3 | 5-6 | US-6.1 a US-7.6 | ~12 | TypeScript strict + Testes + UX |

---

## Criterios de Done (Global)

Toda user story entregue deve satisfazer os seguintes criterios antes de ser considerada Done:

### Codigo
- [ ] Codigo revisado por pelo menos 1 outro desenvolvedor (code review)
- [ ] Nenhum `console.log`, `console.error`, ou `debugger` no codigo submetido
- [ ] Nenhuma variavel ou import nao utilizado
- [ ] Nenhum `@ts-ignore` sem comentario explicativo
- [ ] Nenhum `any` explicito sem justificativa documentada

### Testes
- [ ] Cenarios de happy path testados (funcionalidade principal funciona)
- [ ] Cenario de erro testado (o que acontece quando algo falha)
- [ ] Para mudancas em RLS/migrations: teste manual de que a policy nova nao quebra fluxos existentes
- [ ] Para mudancas em hooks: `npm test` passa sem falhas

### Seguranca (stories de Epic 1)
- [ ] Testado que a vulnerabilidade corrigida nao e mais exploravel via Supabase JS client direto
- [ ] Testado que fluxos legitimos continuam funcionando (regressao)
- [ ] Migration aplicada em staging antes de producao

### Performance
- [ ] Para queries otimizadas: medida de before/after com EXPLAIN ANALYZE documentada
- [ ] Nenhuma regressao de performance em fluxos existentes

### UX
- [ ] Feature testada em Chrome + Firefox + Safari (macOS)
- [ ] Feature testada em viewport mobile 375px (iPhone SE) e tablet 768px
- [ ] Estados de loading, erro e empty state implementados e visiveis
- [ ] Mensagens de erro em pt-BR

### Documentacao
- [ ] Comentario de codigo em funcoes nao-obvias
- [ ] Novo hook documentado com JSDoc resumindo o proposito
- [ ] Mudancas de schema documentadas com comentario na migration SQL

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Migration de RLS em producao bloqueia tabela | Medio | Alto | Usar `CONCURRENTLY` onde possivel; executar em horario de baixo trafego; rollback plan documentado |
| Refactor de AuthContext quebra autenticacao | Alto | Critico | Manter `useAuth()` como alias publico (sem breaking change de API); testar em staging com sessoes reais antes de producao |
| Migracao de hooks para TanStack Query causa regressao | Medio | Alto | Migrar um hook por vez; manter hook antigo comentado durante a sprint; feature flags se necessario |
| `strict: true` no TypeScript revela muitos erros | Alto | Medio | Ativar `noImplicitAny` primeiro (menor impacto), depois `strict`; usar `// @ts-expect-error` como transicao temporaria documentada |
| Novo sistema de toast causa inconsistencia visual | Baixo | Baixo | Validacao visual em todas as paginas que usam toast antes do merge |
| Index creation em bids trava operacoes em producao | Baixo | Alto | Usar `CREATE INDEX CONCURRENTLY` que nao bloqueia DML; executar em horario de baixo trafego |
| Paginacao do marketplace quebra filtros existentes | Medio | Medio | Manter estado de filtros em URL params para que paginacao + filtros coexistam corretamente |
| Edge Function com CORS restrito bloqueia usuarios legitimos | Baixo | Alto | Testar com dominio real antes de remover `*`; manter lista de origens permitidas em variavel de ambiente |
| Remocao de `withdrawals_insert_own` sem coordenacao com edge function | Baixo | Critico | Verificar que edge function usa service_role (nao anon key) ANTES de remover a policy; testar fluxo de saque completo em staging |

---

## Dependencias entre Epics

```
Epic 1 (Seguranca)     ─── independente, pode comecar imediatamente
Epic 3 (DB Indexes)    ─── independente, pode comecar imediatamente
Epic 2 (AuthContext)   ─── independente, pode comecar em paralelo com Epic 1
  └── US-2.2 (ProtectedRoute) depende de US-2.1 (AuthContext) estar completo
Epic 4 (TanStack)      ─── depende de US-2.1 (AuthContext) para invalidacao correta
  └── US-4.1 (useWallet) depende de src/lib/query-keys.ts (US-4.1 cria o arquivo)
Epic 5 (Qualidade)     ─── pode comecar independente, US-5.2 (toast) em paralelo com Epic 4
Epic 6 (TypeScript)    ─── depende de Epic 4 e 5 estarem majoritariamente completos
  └── US-6.2 (testes) mais facil apos refactoring de hooks estar estavel
Epic 7 (UX)            ─── independente de todos, pode ser feito em paralelo no Sprint 3
  └── US-7.2 (notificacoes com link) depende de US-3.4 (useNotifications hook) estar pronto
```

---

*PRD gerado por Morgan (Product Manager) — AIOS-MASTER*
*Projeto: OxyBroker | Data: 2026-02-26*
*Baseado nos assessments de Atlas (Business Analyst), Aria (System Architect) e Dara (Database Architect)*
