# OxyBroker — Architecture Review
*Gerado por Aria (System Architect) em 2026-02-26*

---

## 1. Arquitetura Atual

### 1.1 Diagrama de Camadas (texto)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│  pages/auth/   pages/   pages/admin/                                │
│  Login Signup  Marketplace LotDetail MyAuctions Wallet ...          │
│                AdminLots AdminUsers AdminAnalytics ...               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ React components consume hooks
┌──────────────────────────▼──────────────────────────────────────────┐
│                     APPLICATION / HOOKS LAYER                       │
│                                                                     │
│  Auth & Guard          Data (Custom hooks)    Data (TanStack Query) │
│  ─────────────         ───────────────────    ──────────────────────│
│  useAuth               useWallet              useMyAuctions          │
│  useRoleGuard          useLots                useAdminLots           │
│                        useLotDetail           usePromotions          │
│  Mutations             useTransfers           useActivePromotion     │
│  ─────────────         useUsers               useAnalyticsData       │
│  usePlaceBid                                                        │
│  useBuyNow             Side Effects                                 │
│  useTopUp              ───────────                                  │
│  useWithdraw           useOutbidNotifications                       │
│                        useAnalytics (tracking)                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                     INTEGRATION LAYER                               │
│  supabase/client.ts  (singleton, typed com Database generic)        │
│  supabase/types.ts   (gerado automaticamente, source of truth)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                       BACKEND (Supabase)                            │
│                                                                     │
│  PostgreSQL DB          Auth           Edge Functions               │
│  ─────────────          ────           ──────────────               │
│  lots, bids             JWT sessions   place-bid                    │
│  wallets, assets        Row Level Sec  create-checkout              │
│  profiles, transfers    (RLS)          request-withdrawal           │
│  promotions                            create-user                  │
│  analytics_events                      log-event                    │
│  notifications                         buy_now_atomic (RPC)         │
│                                        get_active_promotion (RPC)   │
│                                                                     │
│  Realtime               Storage                                     │
│  ────────               ───────                                     │
│  postgres_changes       (não observado nos hooks lidos)             │
│  broadcast channels                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Padrões de State Management

O projeto usa **dois padrões coexistentes e inconsistentes**:

**Padrão A — useState + useEffect manual (dominante)**
Usado em: `useWallet`, `useLots`, `useLotDetail`, `useTransfers`, `useUsers`

```ts
// Exemplo representativo de useWallet.ts
const [wallet, setWallet] = useState<Wallet | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchWallet = async () => { ... };
useEffect(() => { fetchWallet(); }, [user]);
return { wallet, loading, error, refetch: fetchWallet };
```

Cada hook implementa manualmente: loading state, error state, fetch trigger, refetch manual. Sem cache, sem deduplication, sem background refetch automático.

**Padrão B — TanStack Query (parcial, emergente)**
Usado em: `useMyAuctions`, `useAdminLots`, `usePromotions`, `useActivePromotion`, `useAnalyticsData`

```ts
// Exemplo representativo de useAdminLots.ts
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["admin-lots", search, status, page, pageSize],
  queryFn: async () => { ... },
});
const createMutation = useMutation({ mutationFn, onSuccess, onError });
```

Esses hooks têm cache automático, invalidação via `queryClient.invalidateQueries`, e estado de mutação granular (`isPending`).

**Contextos React usados:**
- `ThemeContext` — tema dark/light com localStorage
- `QueryClientProvider` — provider do TanStack Query (singleton em `App.tsx`)
- Não existe AuthContext — `useAuth()` é um hook "stateless" que cria estado local a cada chamada.

**Problema crítico identificado:** `useAuth()` é chamado como hook direto em múltiplos componentes e hooks (`useWallet`, `useTransfers`, `useMyAuctions`, `useRoleGuard`, `useOutbidNotifications`, `usePromotions`, `useActivePromotion`). Cada chamada cria uma instância independente com seu próprio estado, subscriptions ao `onAuthStateChange`, e fetches de perfil ao Supabase. Não há singleton de autenticação.

### 1.3 Data Fetching Architecture

**Dois estilos concorrentes de fetch:**

| Hook | Estilo | Cache | Invalidação | Background Refetch |
|------|--------|-------|-------------|-------------------|
| `useLots` | useState + useEffect | Nenhum | Manual (refetch) | Sim (realtime) |
| `useLotDetail` | useState + useEffect | Nenhum | Manual (refetch) | Sim (3 canais) |
| `useWallet` | useState + useEffect | Nenhum | Manual (refetch) | Nenhum |
| `useTransfers` | useState + useEffect | Nenhum | Manual (refetch) | Nenhum |
| `useUsers` | useState + useEffect | Nenhum | Manual (refetch) | Nenhum |
| `useMyAuctions` | TanStack Query | Sim (default) | Via invalidação | polling 30s |
| `useAdminLots` | TanStack Query | Sim | Via invalidação | Nenhum |
| `usePromotions` | TanStack Query | Sim | Via invalidação | Nenhum |
| `useActivePromotion` | TanStack Query | Sim (staleTime 30s) | Via invalidação | Nenhum |
| `useAnalyticsData` | TanStack Query | Sim | Nenhum | Nenhum |

**Patterns de fetch especiais:**
- `useWithdraw` e `useUsers.createUser` chamam Edge Functions via `fetch()` nativo em vez do `supabase.functions.invoke()` — inconsistência que dificulta manutenção e tratamento de erros centralizado.
- `useAnalytics` usa `fetch()` nativo com `fire and forget` para logging — adequado para o caso de uso.
- `useLotDetail` faz 4 queries sequenciais (lot → bids → lot_items → assets) sem paralelismo.
- `useAnalyticsData` faz múltiplos queries separados onde um único query parametrizado ou view server-side resolveria melhor.

### 1.4 Auth & Authorization Flow

```
Startup
  │
  ├─ supabase.auth.onAuthStateChange()   ← subscription ativa
  │    └─ ao receber sessão → setTimeout(0) → fetch profiles
  │
  └─ supabase.auth.getSession()          ← verificação inicial
       └─ fetch profiles diretamente
                    │
                    ▼
             setUser / setSession / setProfile / setLoading
                    │
                    ▼
         useRoleGuard(allowedRoles)
              │
              ├─ loading? → aguarda
              ├─ !user?   → navigate("/auth/login")
              └─ role not allowed? → navigate("/marketplace")
```

**Problema de race condition documentado no código:**
```ts
// useAuth.ts linha 33 — comentário do próprio dev
setTimeout(async () => {
  // Fetch profile with setTimeout to avoid race condition
  const { data } = await supabase.from("profiles")...
}, 0);
```
O `setTimeout(0)` é um workaround para race condition entre `onAuthStateChange` e `getSession()`. Não é uma solução robusta — em conexões lentas ou cold starts, o perfil pode chegar depois que a UI já tentou navegar.

**Ausência de ProtectedRoute component:** Não existe um componente `<ProtectedRoute>` encapsulando as rotas em `App.tsx`. As rotas admin (ex: `/admin/settings`, `/admin/users`) são declaradas sem nenhuma proteção no nível do roteador. A proteção existe apenas dentro de cada página via `useRoleGuard()`. Isso significa que o bundle de código admin é carregado para todos os usuários, e a proteção depende de cada página individual implementar o guard corretamente.

**Dupla fonte de role:**
- `profiles.role` — campo na tabela profiles
- `user_roles` tabela separada — também atualizada em `updateUser` em `useUsers.ts`
Duas sources of truth para o mesmo dado é um risco de dessincronização.

### 1.5 Real-time Architecture

**Canais Supabase Realtime em uso:**

| Hook | Canal | Tipo | Evento |
|------|-------|------|--------|
| `useLots` | `lots-realtime` | postgres_changes | `*` em `lots` |
| `useLotDetail` | `lot-updates-{id}` | broadcast | `bid_placed` |
| `useLotDetail` | `bids-db-{id}` | postgres_changes | `*` em `bids` |
| `useLotDetail` | `lot-db-{id}` | postgres_changes | `*` em `lots` |
| `useOutbidNotifications` | `outbid-{user.id}` | broadcast | `outbid` |
| `useOutbidNotifications` | `notifications-outbid-{user.id}` | postgres_changes | INSERT em `notifications` |

**Problema de duplicação em `useLotDetail`:**
O hook assina 3 canais simultâneos para o mesmo lote: broadcast (para atualizações otimistas de preço/tempo) + postgres_changes em bids (backup) + postgres_changes em lots (backup). Quando um lance é feito, o broadcast dispara `fetchLot()` **e** os dois canais postgres também disparam `fetchLot()`, resultando em até 3 refetches paralelos do mesmo dado.

**Problema de duplicação em `useOutbidNotifications`:**
Dois canais assínam o mesmo evento de outbid por vias diferentes (broadcast direto + INSERT em notifications). O usuário pode receber a notificação toast **duas vezes** pela mesma superação de lance.

---

## 2. Pontos Fortes

**2.1 Type Safety no Integration Layer**
O cliente Supabase é instanciado com o generic `Database` (`createClient<Database>`), e os hooks usam `Database["public"]["Tables"]["..."]["Row"]` para tipar dados. Isso proporciona autocompletion e validação em compile-time para queries, o que é correto e bem executado.

**2.2 Edge Functions para operações críticas de dinheiro**
`place-bid`, `create-checkout`, e o RPC `buy_now_atomic` rodam server-side. A lógica de negócio sensível (debitar carteira, aplicar lances, compra atômica) não está no cliente — decisão arquitetural correta e essencial para um sistema financeiro.

**2.3 RLS presumidamente ativo no Supabase**
A arquitetura delega a autorização de dados ao Row Level Security do PostgreSQL, o que é a abordagem correta para Supabase. Os Edge Functions com `service_role` key teriam acesso total, enquanto o cliente usa a `anon/publishable key` sujeita às policies.

**2.4 Pattern de Broadcast para UX de leilão em tempo real**
O `useLotDetail` usa um canal broadcast (`lot-updates-{id}`) para atualizar preço e tempo de forma otimista sem aguardar um refetch completo. Essa abordagem reduz latência percebida na UI durante lances.

**2.5 Analytics com fire-and-forget**
`useAnalytics` não bloqueia a UI para registrar eventos — o pattern de `fetch(...).catch(warn)` sem await é adequado para telemetria.

**2.6 Separação Admin/User no nível de rotas**
Rotas admin estão em `/admin/*` e páginas admin em `src/pages/admin/`, o que facilita futura implementação de code splitting por grupo de rota.

**2.7 TanStack Query com invalidação granular em `useAdminLots`**
O hook admin de lotes é o mais bem implementado do projeto: usa `useQuery` + `useMutation` com `queryKey` específicos, `onSuccess`/`onError` com toasts, e `queryClient.invalidateQueries` para manter o cache consistente após mutações.

**2.8 `useActivePromotion` com RPC server-side**
A lógica de elegibilidade de promoções roda via `supabase.rpc("get_active_promotion")` em vez de ser calculada no cliente, evitando exposição de regras de negócio e manipulação client-side.

---

## 3. Riscos Criticos (P0)

### P0-1: useAuth sem singleton — múltiplas instâncias com estado independente

**Arquivo:** `src/hooks/useAuth.ts`

`useAuth()` cria uma nova subscription `onAuthStateChange` a cada componente que o chama. Em uma sessão típica com `useWallet`, `useTransfers`, `useMyAuctions`, `useRoleGuard` e `useOutbidNotifications` ativos simultaneamente, existem **5+ subscriptions paralelas** ao estado de auth, cada uma mantendo sua própria cópia de `user`, `session` e `profile`.

Consequências:
- Consumo desnecessário de memória e conexões WebSocket
- Estados podem divergir temporariamente entre instâncias (race condition entre fetches de perfil)
- Cada remount de componente cria e destrói subscriptions
- O `setLoading(false)` em cada instância causa re-renders cascata

**Risco real:** Durante um fluxo de login/logout, as 5+ instâncias recebem o evento auth em ordens potencialmente diferentes, levando a estados intermediários inconsistentes onde alguns componentes veem `user = null` enquanto outros veem `user = {id: "..."}`.

### P0-2: Rotas admin sem proteção no nível do roteador

**Arquivo:** `src/App.tsx`

```tsx
// Nenhuma proteção aqui:
<Route path="/admin/settings" element={<AdminSettings />} />
<Route path="/admin/users" element={<AdminUsers />} />
```

Qualquer usuário não autenticado que acesse `/admin/users` diretamente receberá o componente renderizado. A proteção existe apenas dentro do componente via `useRoleGuard`, mas durante o tempo que `loading = true` (fetch de perfil), o conteúdo admin pode ser parcialmente visível antes do redirect. Adicionalmente, um bug em qualquer página admin que omita o `useRoleGuard` exporia o conteúdo completamente.

**Vetor secundário:** Bundle splitting não existe — o código de todas as páginas admin é incluído no bundle inicial, acessível via DevTools para qualquer visitante.

### P0-3: `useWithdraw` usa fetch nativo com URL hardcoded via env var

**Arquivo:** `src/hooks/useWithdraw.ts` linha 5

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// ...
const response = await fetch(`${SUPABASE_URL}/functions/v1/request-withdrawal`, {
  headers: { Authorization: `Bearer ${sessionData.session.access_token}` }
});
```

Problemas:
1. `SUPABASE_URL` pode ser `undefined` em builds onde a variável não está definida — a URL seria `undefined/functions/v1/request-withdrawal`, causando erro silencioso
2. Erro HTTP (4xx/5xx) não lança exceção no fetch nativo — o código faz `if (!response.ok) throw`, o que está correto, mas o padrão é inconsistente com o resto do projeto que usa `supabase.functions.invoke()`
3. O mesmo padrão existe em `useUsers.createUser` — duplicação de risco

### P0-4: Notificação de outbid duplicada

**Arquivo:** `src/hooks/useOutbidNotifications.ts`

O hook abre dois canais simultâneos para o mesmo evento. Um lance que supera o usuário dispara:
1. Broadcast `outbid` → toast imediato
2. INSERT em `notifications` → segundo toast

O usuário recebe dois toasts de "Você foi ultrapassado!" para o mesmo evento. Em leilões com muita atividade, isso se torna spam de notificações, degradando a experiência.

---

## 4. Problemas Significativos (P1)

### P1-1: Inconsistência no padrão de data fetching (useState vs TanStack Query)

Aproximadamente metade dos hooks usa `useState + useEffect` manual, e a outra metade usa TanStack Query. Isso cria dois ecossistemas paralelos:
- Hooks com `useState` não têm cache — cada mount do componente faz um novo fetch
- Hooks TanStack Query têm `staleTime` default (0) mas ao menos deduplicam requests em flight
- Um `useWallet` + `useTransfers` na mesma tela fazem fetches redundantes ao re-montar
- `invalidateQueries` (TanStack) não afeta hooks com `useState` — a carteira não é revalidada automaticamente após um `buy_now` bem sucedido

### P1-2: N+1 queries em `useLotDetail`

**Arquivo:** `src/hooks/useLotDetail.ts` linhas 36-75

Sequência atual de queries para carregar um lote:
```
1. SELECT * FROM lots WHERE id = ?
2. SELECT * FROM bids WHERE lot_id = ? ORDER BY amount DESC
3. SELECT asset_id FROM lot_items WHERE lot_id = ?
4. SELECT * FROM assets WHERE id IN (assetIds)   ← condicional
```

4 round-trips sequenciais ao banco. Com latência de rede de 100ms cada, isso é 400ms mínimo antes de renderizar. O Supabase suporta joins nativos:
```ts
supabase.from("lots").select(`
  *,
  bids(*),
  lot_items(assets(*))
`).eq("id", lotId).single()
```
Isso reduziria para 1 round-trip.

### P1-3: `useAnalyticsData` faz client-side aggregation de dados ilimitados

**Arquivo:** `src/hooks/useAnalyticsData.ts`

Queries como `useAnalyticsFunnel` e `useAnalyticsTimeseries` buscam **todos os eventos do período selecionado sem paginação** e fazem a agregação no cliente com `Map` e `Set`. Em produção com volume alto de eventos, isso:
- Transfere MB de dados JSON pela rede
- Bloqueia o thread JS com agregação síncrona
- Pode causar OOM no tab do browser

A aggregation deve acontecer server-side via views materializadas, RPCs ou a tabela `analytics_daily_rollups` que já existe no schema mas não é usada nos hooks de analytics.

### P1-4: TypeScript strict mode desabilitado

**Arquivo:** `tsconfig.app.json`

```json
{
  "strict": false,
  "noUnusedLocals": false,
  "noUnusedParameters": false,
  "noImplicitAny": false
}
```

Com `noImplicitAny: false`, parâmetros sem tipo são `any` implicitamente. Combinado com casts explícitos como `data as Profile` e `response.data as PlaceBidResult` nos hooks, erros de tipo em respostas da API passam silenciosamente. Em um sistema que lida com saldos financeiros, um campo `amount` mal tipado pode causar operações incorretas.

### P1-5: `useUsers.deleteUser` deixa registro orphan em `auth.users`

**Arquivo:** `src/hooks/useUsers.ts` linhas 199-212

O próprio código documenta o problema:
```ts
// Note: We cannot delete from auth.users via client SDK
// The profile will remain but user cannot login
```

Deletar via client SDK remove o perfil mas deixa o registro em `auth.users` intacto. O usuário "deletado" pode fazer login novamente se souber as credenciais, pois o JWT ainda seria válido até expirar. A deleção completa requer a Admin API do Supabase, que deve ser chamada via Edge Function com `service_role` key.

### P1-6: `useLots` usa channel name estático

**Arquivo:** `src/hooks/useLots.ts` linha 52

```ts
const channel = supabase.channel("lots-realtime")
```

Se `useLots` for montado múltiplas vezes com opções diferentes (ex: `status="live"` em marketplace e `status="draft"` em admin), ambas as instâncias tentam criar/aderir ao canal `"lots-realtime"` no Supabase. O Supabase reutiliza o canal existente (sem criar duplicata), mas o callback de ambas as instâncias será chamado, causando refetches desnecessários.

### P1-7: `usePromotions` define hook dentro de hook (violação das Rules of Hooks)

**Arquivo:** `src/hooks/usePromotions.ts` linhas 108-147

```ts
const promotionDetailsQuery = (promotionId: string) => useQuery({
  queryKey: ["promotion", promotionId],
  ...
});
```

Esta função retornada (`getPromotionDetails`) chama `useQuery` internamente. Se o componente que consome `usePromotions` chamar `getPromotionDetails(id)` condicionalmente ou em diferentes ordens de render, viola as Rules of Hooks ("only call hooks at the top level"). Isso pode causar erros de runtime sutis e comportamento indefinido.

### P1-8: Validação de amount em `useTopUp` apenas no cliente

**Arquivo:** `src/hooks/useTopUp.ts` linhas 14-20

```ts
if (amount < 10 || amount > 10000) {
  // retorna sem chamar a Edge Function
}
```

A validação de limites de recarga existe apenas no cliente. Um usuário mal-intencionado que chame a Edge Function `create-checkout` diretamente (via curl ou DevTools) pode submeter qualquer valor. A validação **deve** ser replicada na Edge Function server-side.

---

## 5. Melhorias Recomendadas

### 5.1 Criar AuthContext singleton (impacto: P0-1)

Converter `useAuth` em um Context com um único provider no topo da árvore. Um único `onAuthStateChange` subscription, um único estado de user/session/profile, compartilhado via `useContext`.

**Prioridade:** Imediata. Afeta performance e consistência de estado em toda a aplicação.

### 5.2 Implementar ProtectedRoute component (impacto: P0-2)

```tsx
// Exemplo de estrutura
<Route element={<ProtectedRoute roles={["admin"]} />}>
  <Route path="/admin/*" element={<AdminLayout />} />
</Route>
```

Garante proteção no nível do roteador, independente de cada página implementar o guard. Habilita code splitting por grupo de rota.

**Prioridade:** Imediata. Risco de segurança e UX.

### 5.3 Migrar hooks useState para TanStack Query (impacto: P1-1)

`useWallet`, `useLots`, `useTransfers`, `useUsers` devem ser migrados para `useQuery` + `useMutation`. Benefícios: cache, deduplication, background refetch, invalidação cruzada entre hooks.

**Prioridade:** Alta. Elimina fetches redundantes e habilita invalidação automática após mutações.

### 5.4 Unificar chamadas a Edge Functions via `supabase.functions.invoke` (impacto: P0-3)

`useWithdraw` e `useUsers.createUser` devem substituir o `fetch()` nativo por `supabase.functions.invoke()`, que já inclui autenticação automática via token JWT do cliente Supabase.

**Prioridade:** Alta. Elimina risco de URL undefined e centraliza tratamento de erros.

### 5.5 Resolver duplicação de notificações (impacto: P0-4)

Escolher **uma** estratégia de notificação: broadcast OU postgres_changes em `notifications`. Recomendado manter apenas o broadcast (mais rápido) e garantir que a Edge Function `place-bid` persista na tabela `notifications` para histórico, mas sem disparar um segundo toast no cliente.

**Prioridade:** Alta. Problema de UX visível para todos os usuários ativos.

### 5.6 Habilitar TypeScript strict mode gradualmente (impacto: P1-4)

Ativar `noImplicitAny: true` primeiro (menor impacto), depois `strict: true`. Usar `// @ts-expect-error` para suprimir erros legítimos temporariamente durante a migração.

**Prioridade:** Média. Previne bugs futuros em código financeiro.

### 5.7 Implementar code splitting por grupo de rota (impacto: P0-2 + bundle)

```ts
// vite.config.ts — sem rollupOptions, sem manual chunks
// App.tsx — com React.lazy
const AdminLots = lazy(() => import("./pages/admin/AdminLots"));
```

Reduz bundle inicial, melhora LCP em produção, e separa código admin de código de usuário final.

**Prioridade:** Média. Impacto mensurável em performance de primeiro load.

### 5.8 Mover aggregation de analytics para server-side (impacto: P1-3)

Usar a tabela `analytics_daily_rollups` existente para queries agregadas. Criar RPCs no Supabase para as agregações que precisam de dados brutos (funnel, timeseries por hora).

**Prioridade:** Média. Crítico quando o volume de dados crescer.

### 5.9 Corrigir `useLotDetail` com join único (impacto: P1-2)

Substituir 4 queries sequenciais por um único `.select()` com joins nativos do Supabase PostgREST.

**Prioridade:** Média. Reduz latência de carregamento da página mais crítica do produto.

### 5.10 Deletar usuários via Edge Function com Admin API (impacto: P1-5)

Criar Edge Function `delete-user` que use `supabase.auth.admin.deleteUser(userId)` com `service_role` key, garantindo deleção completa do registro em `auth.users`.

**Prioridade:** Média. Risco de segurança em admin panel.

### 5.11 Corrigir violação de Rules of Hooks em `usePromotions` (impacto: P1-7)

Extrair `promotionDetailsQuery` para um hook separado `usePromotionDetails(promotionId: string)` chamado diretamente pelos componentes que precisam.

**Prioridade:** Baixa/Média. Pode causar bugs difíceis de rastrear em produção.

### 5.12 Canal realtime com nome dinâmico em `useLots` (impacto: P1-6)

```ts
// Incluir opções no nome do canal para evitar colisão
const channelName = `lots-realtime-${options.status || "all"}-${options.search || "none"}`;
```

**Prioridade:** Baixa. Impacta apenas cenários com múltiplas instâncias de `useLots`.

---

## 6. Proposta de Arquitetura Melhorada

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│                                                                     │
│  Public Routes         Protected User     Protected Admin           │
│  ─────────────         ──────────────     ──────────────────        │
│  /auth/login           /marketplace       /admin/* (lazy)           │
│  /auth/signup          /lots/:id          (carregado só pra admin)  │
│                        /wallet, etc.                                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                     ROUTING / GUARD LAYER                           │
│                                                                     │
│  <ProtectedRoute roles={[...]}>   ← componente único               │
│    Verifica autenticação e role ANTES de renderizar filhos          │
│    Sem flash de conteúdo, sem guard distribuído por página          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                  APPLICATION / HOOKS LAYER (unified)                │
│                                                                     │
│  Singleton Context     TanStack Query (todos os hooks de dados)     │
│  ───────────────       ────────────────────────────────────         │
│  AuthContext           useWallet        → useQuery + useMutation    │
│    user                useLots          → useQuery + realtime       │
│    session             useLotDetail     → useQuery + realtime       │
│    profile             useTransfers     → useQuery                  │
│    loading             useUsers         → useQuery + useMutation    │
│    hasRole()           useMyAuctions    → useQuery                  │
│                        useAdminLots     → useQuery + useMutation    │
│                                                                     │
│  Side Effects          Mutations (Edge Functions)                   │
│  ────────────          ──────────────────────────                   │
│  useOutbidNotif.       usePlaceBid   → supabase.functions.invoke   │
│  (1 canal apenas)      useBuyNow     → supabase.rpc                │
│  useAnalytics          useTopUp      → supabase.functions.invoke   │
│  (fire-and-forget)     useWithdraw   → supabase.functions.invoke   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                     INTEGRATION LAYER                               │
│                                                                     │
│  supabase/client.ts — singleton tipado, com auth persistente        │
│  supabase/types.ts  — gerado automaticamente, imutável              │
│                                                                     │
│  Regra: TODOS os calls passam pelo supabase client                  │
│  (sem fetch() nativo para endpoints Supabase)                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                       BACKEND (Supabase)                            │
│                                                                     │
│  RLS policies           Edge Functions          RPCs               │
│  (autorização)          (operações críticas)    (server-side agg)  │
│                         place-bid               buy_now_atomic      │
│                         create-checkout         get_active_promo    │
│                         request-withdrawal      daily_analytics_    │
│                         create-user             rollup (novo)       │
│                         delete-user (novo)      funnel_data (novo)  │
│                         log-event                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Roadmap de Refactoring

### Sprint 1 — Fundação de Segurança e Auth (1-2 semanas)

**Objetivo:** Eliminar os P0s que afetam segurança e estabilidade.

1. **Criar `AuthContext`** — mover lógica de `useAuth` para um Context com provider único no `App.tsx`. Converter `useAuth` em um wrapper de `useContext(AuthContext)` para retrocompatibilidade.

2. **Criar `ProtectedRoute` component** — encapsular rotas `/admin/*` e rotas de usuário logado. Remover `useRoleGuard` das páginas e consolidar no router.

3. **Unificar chamadas de Edge Function** — migrar `useWithdraw.requestWithdrawal` e `useUsers.createUser` para `supabase.functions.invoke()`.

4. **Corrigir duplicação de notificações** — remover um dos dois canais de `useOutbidNotifications`. Manter apenas broadcast para o toast; deixar postgres_changes para persistência interna.

5. **Corrigir `usePromotions`** — extrair `promotionDetailsQuery` em `usePromotionDetails(id)` separado.

### Sprint 2 — Migração para TanStack Query (2-3 semanas)

**Objetivo:** Padronizar data fetching, habilitar cache e invalidação cruzada.

1. Migrar `useWallet` → `useQuery` + invalida após `useBuyNow`, `useTopUp`, `useWithdraw`
2. Migrar `useTransfers` → `useQuery`
3. Migrar `useLots` → `useQuery` + manter integração realtime como `queryClient.invalidateQueries` ao receber evento
4. Migrar `useLotDetail` → `useQuery` + resolver N+1 com join único
5. Migrar `useUsers` (admin) → `useQuery` + `useMutation` pattern já usado em `useAdminLots`

### Sprint 3 — Performance e Bundle (1-2 semanas)

**Objetivo:** Melhorar performance de carregamento e runtime.

1. **Code splitting** — adicionar `React.lazy` + `Suspense` para todas as rotas admin
2. **Analytics server-side** — mover aggregation de `useAnalyticsData` para RPCs/views no Supabase, usar `analytics_daily_rollups` para queries de timeseries
3. **Configurar `rollupOptions` no Vite** — definir `manualChunks` para separar vendor (react, tanstack, supabase, recharts) e garantir chunks previsíveis

### Sprint 4 — Type Safety e Developer Experience (1 semana)

**Objetivo:** Prevenir bugs futuros com tipagem mais forte.

1. Habilitar `noImplicitAny: true` em `tsconfig.app.json` — corrigir erros emergentes
2. Habilitar `strict: true` — corrigir erros restantes (principalmente `null` checks)
3. Remover todos os casts `as T` substituindo por parsing com `zod` nas respostas de Edge Functions
4. Implementar `QueryKey` factory pattern para evitar queryKey strings soltas:

```ts
// src/lib/query-keys.ts
export const queryKeys = {
  wallet: (userId: string) => ["wallet", userId] as const,
  lots: (opts: UseLotOptions) => ["lots", opts] as const,
  lotDetail: (id: string) => ["lot-detail", id] as const,
  // ...
} as const;
```

### Sprint 5 — Operações Admin Robustas (1 semana)

**Objetivo:** Resolver débitos técnicos em funcionalidades admin.

1. Criar Edge Function `delete-user` com Admin API para deleção completa
2. Consolidar `profiles.role` e `user_roles` tabela — eliminar dual source of truth
3. Adicionar validação server-side de `amount` na Edge Function `create-checkout`
4. Corrigir nome do canal realtime em `useLots` para evitar colisão

---

## 8. Decisoes de Design (ADRs Recomendados)

### ADR-001: Auth State via Context, não via Hook Instanciado

**Contexto:** `useAuth()` atual cria múltiplas subscriptions independentes.

**Decisão:** Implementar `AuthContext` com provider único. `useAuth()` se torna alias para `useContext(AuthContext)`.

**Consequências positivas:** Estado de auth consistente em toda a árvore, uma única subscription WebSocket para auth, perfil carregado uma vez.

**Consequências negativas:** Requer refactor de todos os pontos de uso (mas a API pública `useAuth()` permanece idêntica — sem breaking change para os consumidores).

---

### ADR-002: TanStack Query como padrão exclusivo de data fetching

**Contexto:** Dois padrões coexistem (`useState+useEffect` vs `useQuery`).

**Decisão:** Todos os hooks de leitura de dados usam `useQuery`. Todas as mutações usam `useMutation`. Realtime Supabase dispara `queryClient.invalidateQueries` em vez de `setState` manual.

**Consequências positivas:** Cache unificado, deduplication automática, invalidação cruzada, DevTools do TanStack Query para debug.

**Consequências negativas:** Migração incremental requer coexistência temporária dos dois padrões durante os sprints. Overhead de aprendizado para novos devs.

---

### ADR-003: Supabase SDK para todos os calls, sem fetch() nativo

**Contexto:** `useWithdraw` e `useUsers.createUser` usam `fetch()` nativo com URLs montadas manualmente.

**Decisão:** Todo call a endpoints Supabase (REST, Functions, RPC, Auth) passa pelo `supabase` client. `fetch()` nativo apenas para APIs externas não-Supabase.

**Consequências positivas:** Autenticação automática via token JWT, tratamento de erros padronizado, resiliência a URL undefined em ambiente sem variáveis configuradas.

**Consequências negativas:** Nenhuma significativa.

---

### ADR-004: Lógica de negócio financeira exclusivamente server-side

**Contexto:** `useBuyNow` usa RPC `buy_now_atomic`. `usePlaceBid` usa Edge Function. Ambos corretos.

**Decisão:** Qualquer operação que modifique saldo, registre transação, ou altere status de leilão deve rodar em Edge Function ou RPC PostgreSQL. O cliente apenas invoca e exibe resultado.

**Consequências positivas:** Atomicidade garantida pelo banco, impossibilidade de manipulação client-side, auditoria server-side.

**Consequências negativas:** Latência adicional de cold start em Edge Functions (mitigável com Supabase Edge Runtime).

---

### ADR-005: Proteção de rotas no roteador, não nos componentes

**Contexto:** Cada página admin chama `useRoleGuard` individualmente. Rotas não têm proteção estrutural.

**Decisão:** `<ProtectedRoute roles={[...]}>` encapsula grupos de rotas no `App.tsx`. Páginas individuais não são responsáveis por verificar autenticação ou role.

**Consequências positivas:** Proteção consistente, impossibilidade de esquecer o guard em uma nova página, code splitting natural por grupo de acesso.

**Consequências negativas:** `ProtectedRoute` precisa aguardar `loading` do `AuthContext` antes de renderizar ou redirecionar — necessário implementar um skeleton/loading state global.

---

*Review conduzida com base na leitura de 24 arquivos-fonte: App.tsx, 17 hooks, 2 contexts/providers, client.ts, types.ts (200 linhas), vite.config.ts, tsconfig.app.json, tailwind.config.ts, e package.json.*
