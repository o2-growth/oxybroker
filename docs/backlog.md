# OxyBroker — Backlog Priorizado
*Gerado por Pax (Product Owner) em 2026-02-26*

---

## Contexto de Priorizacao

O backlog foi construido a partir de tres fontes de assessment (Atlas, Aria, Dara) e ordenado pelo criterio **Risco x Impacto**:

- **P0 — Seguranca Critica**: Vulnerabilidades que permitem escalada de privilegio, bypass de fluxo financeiro ou race conditions em operacoes de dinheiro. **Devem ser corrigidas antes de qualquer release em producao.**
- **P1 — Fundacao Tecnica**: Problemas arquiteturais que impactam consistencia, performance e seguranca de forma sistemica. Prerequisitos para crescimento saudavel.
- **P2 — Qualidade & Padronizacao**: Tech debt que aumenta custo de manutencao, duplicacao de codigo e inconsistencia de comportamento.
- **P3 — Hardening Progressivo**: TypeScript strict, cobertura de testes, melhorias de robustez.

---

## Sprint 1 — Seguranca & Fundacao (Critical Path)
*Meta: Eliminar todas as vulnerabilidades criticas e estabelecer a fundacao de auth e roteamento*
*Duracao estimada: 2 semanas | Pontos totais: 21*

---

### STORY-001: Fix RLS privilege escalation em profiles
**Tipo:** Security Fix | **Prioridade:** P0 | **Pontos:** 3 | **Risco:** CRITICO

**Descricao:**
A policy `profiles_update_own` permite que qualquer usuario autenticado execute `UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()` diretamente via Supabase JS client. Nao ha `WITH CHECK` restringindo colunas. Os campos `role`, `can_withdraw` e `suspended_at` sao editaveis livremente pelo proprio usuario.

**Arquivos a criar/modificar:**
- `supabase/migrations/20260226000001_fix_rls_profiles_privilege_escalation.sql` (criar)

**SQL da migration:**
```sql
-- supabase/migrations/20260226000001_fix_rls_profiles_privilege_escalation.sql

-- 1. Remover a policy atual que permite UPDATE irrestrito
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2. Criar policy restrita: usuario pode atualizar apenas campos de perfil publico
--    Colunas restritas: role, can_withdraw, suspended_at, is_active
--    Colunas permitidas: full_name, avatar_url, phone (e outras de perfil publico)
CREATE POLICY "profiles_update_own_restricted"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Impede alteracao de campos privilegiados comparando com o valor atual no banco
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND can_withdraw = (SELECT can_withdraw FROM public.profiles WHERE id = auth.uid())
    AND suspended_at IS NOT DISTINCT FROM (SELECT suspended_at FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

-- 3. Adicionar comentario de documentacao
COMMENT ON POLICY "profiles_update_own_restricted" ON public.profiles IS
  'Permite usuario atualizar apenas campos de perfil publico. '
  'Campos privilegiados (role, can_withdraw, suspended_at, is_active) '
  'sao imutaveis via cliente — requerem Edge Function com service_role.';
```

**Criterios de aceite:**
- [ ] Usuario comum NAO consegue executar `UPDATE profiles SET role = 'admin'` via Supabase JS client
- [ ] Usuario comum NAO consegue alterar `can_withdraw = true` no proprio perfil
- [ ] Usuario comum NAO consegue remover `suspended_at` do proprio perfil
- [ ] Usuario comum CONSEGUE atualizar `full_name` e `avatar_url` normalmente
- [ ] Admin CONSEGUE alterar role de outro usuario via Edge Function (service_role bypass RLS)
- [ ] Teste de regressao: fluxo de atualizacao de perfil na UI continua funcionando

**Notas tecnicas:**
- A subquery `(SELECT role FROM public.profiles WHERE id = auth.uid())` dentro do `WITH CHECK` garante que o valor nao foi alterado na requisicao. O Postgres avalia o `WITH CHECK` apos o UPDATE, comparando o novo valor com o valor lido antes.
- Alternativa mais robusta: remover UPDATE direto e criar RPC `update_own_profile(full_name, avatar_url)` com SECURITY DEFINER.
- Dependencia: nenhuma.

---

### STORY-002: Fix RLS withdrawals bypass do fluxo atomico
**Tipo:** Security Fix | **Prioridade:** P0 | **Pontos:** 2 | **Risco:** CRITICO

**Descricao:**
A policy `withdrawals_insert_own` (`auth.uid() = user_id`) permite que qualquer usuario autenticado insira diretamente na tabela `withdrawals` via Supabase JS client, **sem passar pelo Edge Function `request-withdrawal`**. O Edge Function executa `request_withdrawal_atomic` que verifica `can_withdraw`, debita o saldo atomicamente e cria a `wallet_transaction`. O INSERT direto bypassa tudo isso: o usuario pode registrar um saque sem que o saldo seja debitado.

**Arquivos a criar/modificar:**
- `supabase/migrations/20260226000002_fix_rls_withdrawals_bypass.sql` (criar)

**SQL da migration:**
```sql
-- supabase/migrations/20260226000002_fix_rls_withdrawals_bypass.sql

-- 1. Remover a policy de INSERT que permite acesso direto
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;

-- 2. RESULTADO: agora apenas service_role (Edge Functions) pode inserir em withdrawals.
--    O service_role bypassa RLS por padrao no Supabase.
--    A policy de SELECT permanece: usuario ve apenas os proprios saques.

-- 3. Comentario de documentacao
COMMENT ON TABLE public.withdrawals IS
  'Saques de saldo. Insercao EXCLUSIVA via Edge Function request-withdrawal '
  '(service_role). Cliente nao tem permissao de INSERT direto — '
  'garante que request_withdrawal_atomic seja sempre executado.';
```

**Criterios de aceite:**
- [ ] Usuario autenticado NAO consegue executar `INSERT INTO withdrawals (...)` via Supabase JS client (deve retornar erro de permissao RLS)
- [ ] Edge Function `request-withdrawal` CONTINUA funcionando (usa service_role)
- [ ] Usuario CONSEGUE visualizar os proprios saques (SELECT policy intacta)
- [ ] Admin CONSEGUE ver todos os saques (admin SELECT policy intacta)
- [ ] Teste: chamar `supabase.from('withdrawals').insert({...})` no cliente deve retornar `42501` (insufficient_privilege)

**Notas tecnicas:**
- O Edge Function `request-withdrawal` usa o client com `service_role` key, que bypassa RLS automaticamente — nenhuma alteracao na Edge Function e necessaria.
- Verificar que `SUPABASE_SERVICE_ROLE_KEY` esta configurado no ambiente do Edge Function.
- Dependencia: STORY-001 (pode ser feita em paralelo).

---

### STORY-003: Fix race condition em admin-adjust-balance
**Tipo:** Security Fix | **Prioridade:** P0 | **Pontos:** 5 | **Risco:** CRITICO

**Descricao:**
O Edge Function `admin-adjust-balance` e a unica operacao financeira do sistema que NAO usa uma funcao atomica. O fluxo atual e:
1. `SELECT balance FROM wallets WHERE user_id = X` — le o saldo atual
2. `UPDATE wallets SET balance = <valor_lido + amount>` — atualiza sem lock
3. `INSERT INTO wallet_transactions (...)` — registra transacao

Entre os passos 1 e 2, outra operacao concorrente (lance, compra, transferencia) pode alterar o saldo. O UPDATE usa o valor lido no passo 1, nao o valor atual do banco, causando inconsistencia. Adicionalmente, o "rollback" manual em caso de falha e uma segunda UPDATE que tambem pode falhar — nao e uma transacao real.

**Arquivos a criar/modificar:**
- `supabase/migrations/20260226000003_create_admin_adjust_balance_atomic.sql` (criar)
- `supabase/functions/admin-adjust-balance/index.ts` (modificar)

**SQL da migration:**
```sql
-- supabase/migrations/20260226000003_create_admin_adjust_balance_atomic.sql

CREATE OR REPLACE FUNCTION public.admin_adjust_balance_atomic(
  p_user_id    uuid,
  p_amount     numeric,   -- positivo = credito, negativo = debito
  p_note       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance numeric;
  v_new_balance numeric;
  v_transaction_id uuid;
BEGIN
  -- Lock exclusivo na linha da wallet para serializar operacoes concorrentes
  SELECT balance INTO v_old_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;  -- SELECT FOR UPDATE: outras transacoes aguardam o lock

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_new_balance := v_old_balance + p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Requested debit: %',
      v_old_balance, ABS(p_amount);
  END IF;

  -- Atualiza saldo atomicamente (dentro da mesma transacao que tem o lock)
  UPDATE public.wallets
  SET balance = v_new_balance,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Registra transacao no ledger (atomico: se falhar, o UPDATE acima e revertido)
  INSERT INTO public.wallet_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_type
  ) VALUES (
    p_user_id,
    'admin_adjust',
    p_amount,
    v_new_balance,
    COALESCE(p_note, 'Ajuste administrativo'),
    'admin_adjust'
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success',         true,
    'old_balance',     v_old_balance,
    'new_balance',     v_new_balance,
    'transaction_id',  v_transaction_id
  );
END;
$$;

-- Revogar execucao publica — apenas service_role (Edge Functions) pode chamar
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance_atomic FROM authenticated;

COMMENT ON FUNCTION public.admin_adjust_balance_atomic IS
  'Ajuste de saldo por admin. Atomico via SELECT FOR UPDATE. '
  'Suporta credito (amount > 0) e debito (amount < 0). '
  'Chamado exclusivamente pelo Edge Function admin-adjust-balance.';
```

**Modificacao no Edge Function (`supabase/functions/admin-adjust-balance/index.ts`):**
```typescript
// Substituir o fluxo manual (SELECT + UPDATE + INSERT) por:
const { data, error } = await supabaseAdmin.rpc('admin_adjust_balance_atomic', {
  p_user_id: userId,
  p_amount: amount,        // positivo ou negativo
  p_note: note ?? null,
});

if (error) throw error;
return new Response(JSON.stringify(data), { status: 200 });
```

**Criterios de aceite:**
- [ ] Multiplas chamadas simultaneas ao Edge Function com o mesmo `user_id` resultam em saldo final correto (nao ha duplicacao ou perda de valor)
- [ ] Chamada com `amount` que causaria saldo negativo retorna erro 400 com mensagem clara
- [ ] Cada ajuste gera exatamente 1 registro em `wallet_transactions`
- [ ] A funcao `admin_adjust_balance_atomic` nao e executavel por usuarios autenticados via cliente (apenas service_role)
- [ ] Suporte a ajustes negativos (debito admin) funcionando

**Notas tecnicas:**
- `SELECT FOR UPDATE` garante que duas transacoes concorrentes para o mesmo `user_id` se serializam — a segunda aguarda o lock ser liberado.
- O `SECURITY DEFINER` garante que a funcao roda com privilegios do dono (postgres), podendo executar o UPDATE mesmo com RLS ativo.
- Dependencia: STORY-001, STORY-002 podem ser feitas em paralelo.

---

### STORY-004: Criar AuthContext singleton
**Tipo:** Architecture | **Prioridade:** P0 | **Pontos:** 5 | **Dependencias:** nenhuma

**Descricao:**
`useAuth` e um hook puro com `useState + useEffect` que cria uma nova subscricao `supabase.auth.onAuthStateChange` a cada componente que o chama. Em uma sessao tipica, existem 8-12 subscricoes paralelas e 8-12 fetches independentes da tabela `profiles`. Isso causa consumo excessivo de conexoes WebSocket, estados potencialmente divergentes entre instancias durante login/logout, e o anti-pattern `setTimeout(0)` para workaround de race condition.

**Arquivos a criar/modificar:**
- `src/contexts/AuthContext.tsx` (criar)
- `src/hooks/useAuth.ts` (modificar — converter em wrapper de `useContext`)
- `src/App.tsx` (modificar — adicionar `AuthProvider`)

**Estrutura de arquivos:**
```
src/
├── contexts/
│   ├── ThemeContext.tsx   (existente)
│   └── AuthContext.tsx    (NOVO)
└── hooks/
    └── useAuth.ts         (modificar)
```

**Implementacao (`src/contexts/AuthContext.tsx`):**
```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data ?? null);
  }

  useEffect(() => {
    // Inicializacao: busca sessao atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // UMA UNICA subscricao para toda a aplicacao
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signOut: () => supabase.auth.signOut(),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
```

**Modificacao em `src/hooks/useAuth.ts`:**
```typescript
// Converter para wrapper retrocompativel — zero breaking change nos consumidores
import { useAuthContext } from "@/contexts/AuthContext";
export function useAuth() {
  return useAuthContext();
}
```

**Modificacao em `src/App.tsx`:**
```tsx
// Adicionar AuthProvider ao topo da arvore de providers:
import { AuthProvider } from "@/contexts/AuthContext";

// Ordem dos providers (AuthProvider envolve tudo):
<QueryClientProvider client={queryClient}>
  <AuthProvider>           {/* NOVO — singleton de auth */}
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          ...
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </AuthProvider>
</QueryClientProvider>
```

**Criterios de aceite:**
- [ ] Apenas 1 subscricao `onAuthStateChange` ativa por sessao (verificar via Supabase Realtime dashboard)
- [ ] `useAuth()` em qualquer componente retorna o mesmo objeto de usuario (referencia estavel)
- [ ] Login e logout propagam para todos os componentes simultaneamente sem divergencia de estado
- [ ] O `setTimeout(0)` workaround e removido sem regressao no fluxo de auth
- [ ] Todas as paginas existentes que chamam `useAuth()` continuam funcionando sem modificacao
- [ ] Loading state global correto: `loading = true` ate o perfil ser carregado

**Notas tecnicas:**
- `useAuth()` em `src/hooks/useAuth.ts` torna-se um alias de `useAuthContext()` — API identica para todos os 25 hooks consumidores, zero breaking change.
- Remover o `setTimeout(0)` anti-pattern presente em `useAuth.ts` linha 33.
- Dependencia: STORY-005 depende desta story.

---

### STORY-005: Implementar ProtectedRoute e AdminRoute
**Tipo:** Security + Architecture | **Prioridade:** P0 | **Pontos:** 3 | **Dependencias:** STORY-004

**Descricao:**
Todas as rotas `/admin/*` em `App.tsx` nao possuem wrapper de protecao. A verificacao de role e feita dentro de cada pagina via `useRoleGuard`, o que significa: (1) o bundle admin e carregado para todos os usuarios, (2) ha flash de conteudo antes do redirect, e (3) qualquer nova pagina admin que esquecer o `useRoleGuard` fica desprotegida. Alem disso, rotas de usuarios autenticados (Wallet, MyAuctions, etc.) tambem nao tem protecao no roteador.

**Arquivos a criar/modificar:**
- `src/components/routes/ProtectedRoute.tsx` (criar)
- `src/components/routes/AdminRoute.tsx` (criar)
- `src/App.tsx` (modificar — envolver grupos de rotas)

**Implementacao (`src/components/routes/ProtectedRoute.tsx`):**
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  redirectTo?: string;
}

export function ProtectedRoute({ redirectTo = "/auth/login" }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    // Evita flash de redirect enquanto a sessao esta carregando
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="oxy-spinner" aria-label="Carregando..." />
      </div>
    );
  }

  if (!user) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
```

**Implementacao (`src/components/routes/AdminRoute.tsx`):**
```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_ROLES = ["admin"] as const;

export function AdminRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="oxy-spinner" aria-label="Verificando permissoes..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  if (!profile || !ADMIN_ROLES.includes(profile.role as typeof ADMIN_ROLES[number])) {
    return <Navigate to="/marketplace" replace />;
  }

  return <Outlet />;
}
```

**Modificacao em `src/App.tsx`:**
```tsx
import { ProtectedRoute } from "@/components/routes/ProtectedRoute";
import { AdminRoute }     from "@/components/routes/AdminRoute";

// Antes (sem protecao):
<Route path="/marketplace" element={<Marketplace />} />
<Route path="/admin/users" element={<AdminUsers />} />

// Depois (com protecao no roteador):
<Route element={<ProtectedRoute />}>
  <Route path="/marketplace" element={<Marketplace />} />
  <Route path="/lot/:id" element={<LotDetail />} />
  <Route path="/wallet" element={<Wallet />} />
  <Route path="/my-auctions" element={<MyAuctions />} />
  <Route path="/transfers" element={<Transfers />} />
  <Route path="/purchases" element={<Purchases />} />
  <Route path="/notifications" element={<Notifications />} />
</Route>

<Route element={<AdminRoute />}>
  <Route path="/admin/lots" element={<AdminLots />} />
  <Route path="/admin/users" element={<AdminUsers />} />
  <Route path="/admin/assets" element={<AdminAssets />} />
  <Route path="/admin/categories" element={<AdminCategories />} />
  <Route path="/admin/promotions" element={<AdminPromotions />} />
  <Route path="/admin/analytics" element={<AdminAnalytics />} />
  <Route path="/admin/settings" element={<AdminSettings />} />
</Route>
```

**Criterios de aceite:**
- [ ] Usuario nao autenticado que acessa `/marketplace` e redirecionado para `/auth/login` sem flash de conteudo
- [ ] Usuario autenticado sem role `admin` que acessa `/admin/users` e redirecionado para `/marketplace` sem flash
- [ ] Admin consegue acessar todas as rotas `/admin/*` normalmente
- [ ] Loading state e exibido enquanto o perfil esta carregando (sem redirect prematuro)
- [ ] `useRoleGuard` pode ser removido das paginas admin (a protecao agora e no roteador) — remocao e opcional nesta story, mas deve ser planejada

**Notas tecnicas:**
- O `loading` state vem do `AuthContext` (STORY-004) — sem ele, o `ProtectedRoute` nao pode aguardar a sessao corretamente.
- Futura melhoria: adicionar `React.lazy` + `Suspense` nas rotas admin para code splitting.
- Dependencia: STORY-004 (AuthContext).

---

### STORY-006: Adicionar indexes criticos no banco de dados
**Tipo:** Performance | **Prioridade:** P0 | **Pontos:** 2 | **Dependencias:** nenhuma

**Descricao:**
As tabelas mais acessadas do sistema (`bids`, `wallet_transactions`, `lots`, `notifications`) nao possuem indexes nas colunas usadas em condicoes WHERE, JOINs e ORDER BY. Sem indexes, o PostgreSQL executa full table scans em toda operacao de lance, consulta de carteira e carregamento do marketplace. A tabela `bids` e especialmente critica: a funcao `close_auction_atomic` faz loop com `OFFSET` sobre lances sem index `(lot_id, amount DESC)`, causando leituras sequenciais crescentes para cada fallback de bidder.

**Arquivos a criar/modificar:**
- `supabase/migrations/20260226000004_add_critical_indexes.sql` (criar)

**SQL da migration:**
```sql
-- supabase/migrations/20260226000004_add_critical_indexes.sql
-- Adiciona indexes criticos para performance de producao
-- Usar CONCURRENTLY para nao bloquear tabelas em producao

-- ============================================================
-- CRITICO: bids (tabela mais lida em toda operacao de leilao)
-- ============================================================

-- Lances por lote (useLotDetail, place_bid_atomic, close_auction_atomic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_id
  ON public.bids(lot_id);

-- Lance maximo por lote — ORDER BY amount DESC (RLS policy, close_auction_atomic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_amount_desc
  ON public.bids(lot_id, amount DESC);

-- Lances de um usuario (RLS select policy, useMyAuctions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_user_id
  ON public.bids(user_id);

-- Combinado: lances de usuario em lote especifico (useAuctionStatus, user_has_bid_on_lot)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_lot_user
  ON public.bids(lot_id, user_id);

-- ============================================================
-- CRITICO: wallet_transactions (ledger financeiro — alta frequencia)
-- ============================================================

-- Transacoes por usuario (useWallet — extrato)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_id
  ON public.wallet_transactions(user_id);

-- Transacoes recentes por usuario (ORDER BY created_at DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(user_id, created_at DESC);

-- Busca por referencia (auditing, reconciliation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_reference
  ON public.wallet_transactions(reference_type, reference_id);

-- ============================================================
-- ALTO: lots (marketplace — todos os usuarios visualizam)
-- ============================================================

-- Marketplace: lotes ativos ordenados por encerramento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_status_ends_at
  ON public.lots(status, ends_at);

-- Partial index: apenas lotes live (subset mais consultado)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_live_ends_at
  ON public.lots(ends_at)
  WHERE status = 'live';

-- Lotes criados pelo admin (AdminLots)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lots_created_by
  ON public.lots(created_by);

-- ============================================================
-- ALTO: notifications (realtime + historico)
-- ============================================================

-- Notificacoes por usuario (RLS + Notifications.tsx)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id);

-- Notificacoes nao lidas recentes por usuario (TopBar badge count)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ============================================================
-- MEDIO: assets, lot_items, transfers, withdrawals
-- ============================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_status
  ON public.assets(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_type_status
  ON public.assets(asset_type, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lot_items_lot_id
  ON public.lot_items(lot_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lot_items_asset_id
  ON public.lot_items(asset_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_from_user
  ON public.transfers(from_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfers_to_user
  ON public.transfers(to_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_user_id
  ON public.withdrawals(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdrawals_pending
  ON public.withdrawals(requested_at DESC)
  WHERE status = 'pending';

-- Profiles email: usado por create-transfer para buscar destinatario
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email
  ON public.profiles(email);

COMMENT ON INDEX idx_bids_lot_amount_desc IS
  'Critico para close_auction_atomic: determina o vencedor sem full table scan';
COMMENT ON INDEX idx_lots_live_ends_at IS
  'Partial index para lotes live — subset mais consultado no marketplace';
COMMENT ON INDEX idx_notifications_user_unread IS
  'Partial index para badge count no TopBar — apenas notificacoes nao lidas';
```

**Criterios de aceite:**
- [ ] Migration executada sem erros (CONCURRENTLY nao bloqueia tabelas)
- [ ] `EXPLAIN ANALYZE` em `SELECT * FROM bids WHERE lot_id = X ORDER BY amount DESC` mostra `Index Scan` em vez de `Seq Scan`
- [ ] `EXPLAIN ANALYZE` em `SELECT * FROM lots WHERE status = 'live' ORDER BY ends_at` mostra uso do partial index
- [ ] `EXPLAIN ANALYZE` em `SELECT COUNT(*) FROM notifications WHERE user_id = X AND read_at IS NULL` mostra `Index Scan`
- [ ] Performance do carregamento de LotDetail mensuravel antes/depois (target: < 200ms)

**Notas tecnicas:**
- `CREATE INDEX CONCURRENTLY` nao bloqueia leituras e escritas durante a criacao — seguro para producao.
- `IF NOT EXISTS` garante idempotencia — pode ser re-executado sem erro.
- O partial index `idx_lots_live_ends_at` e menor e mais rapido que o index completo `idx_lots_status_ends_at` para a query mais comum do marketplace.

---

### STORY-007: Fix notificacoes outbid duplicadas
**Tipo:** Bug Fix | **Prioridade:** P1 | **Pontos:** 1 | **Dependencias:** STORY-004

**Descricao:**
`useOutbidNotifications` abre dois canais Supabase simultaneos para o mesmo evento de outbid: (1) broadcast channel `outbid-{user.id}` e (2) postgres_changes INSERT em `notifications`. Quando um usuario e superado em um lance, recebe dois toasts "Voce foi ultrapassado!" para o mesmo evento, alem de 2x o consumo de conexoes WebSocket.

**Arquivos a criar/modificar:**
- `src/hooks/useOutbidNotifications.ts` (modificar)

**Implementacao:**
```typescript
// Manter APENAS o broadcast channel (mais rapido, menos latencia)
// Remover o canal postgres_changes que duplica o toast

// REMOVER este canal:
// const notifChannel = supabase.channel(`notifications-outbid-${user.id}`)
//   .on('postgres_changes', { event: 'INSERT', table: 'notifications', ... })

// MANTER apenas:
const broadcastChannel = supabase.channel(`outbid-${user.id}`)
  .on('broadcast', { event: 'outbid' }, ({ payload }) => {
    // Exibir toast (apenas aqui — source of truth para o toast)
    toast({ title: "Voce foi ultrapassado!", description: `...` });
  })
  .subscribe();

// A persistencia na tabela notifications acontece no Edge Function place-bid
// O usuario vera o historico em Notifications.tsx via SELECT normal
```

**Criterios de aceite:**
- [ ] Usuario recebe EXATAMENTE 1 toast de outbid por evento de superacao de lance
- [ ] Notificacao aparece em `Notifications.tsx` (persistencia no banco continua funcionando)
- [ ] Apenas 1 canal Supabase ativo por usuario para outbid (verificar em Supabase Realtime)
- [ ] Cleanup correto do canal no `useEffect` return

**Notas tecnicas:**
- O broadcast channel e disparado diretamente pelo Edge Function `place-bid` — latencia < 100ms.
- O postgres_changes INSERT e um fallback redundante — pode ser removido sem perda funcional.
- O historico de notificacoes em `Notifications.tsx` usa SELECT direto na tabela, nao depende do canal postgres_changes.

---

## Sprint 2 — Qualidade & Padronizacao
*Meta: Unificar padroes de data fetching, eliminar duplicacao de codigo e acesso direto ao Supabase em paginas*
*Duracao estimada: 2-3 semanas | Pontos totais: 26*

---

### STORY-008: Unificar data fetching com TanStack Query (hooks manuais)
**Tipo:** Refactoring | **Prioridade:** P1 | **Pontos:** 8 | **Dependencias:** STORY-004

**Descricao:**
Cinco hooks usam `useState + useEffect` manual sem cache, deduplicacao ou invalidacao automatica: `useWallet`, `useLotDetail`, `useTransfers`, `useUsers`, `useLots`. Isso causa: (1) requests duplicados quando o mesmo hook e montado em multiplos componentes, (2) dados obsoletos apos mutacoes (a carteira nao invalida apos compra), (3) ausencia de deduplicacao em requests em flight, (4) dificuldade de onboarding para novos devs.

**Arquivos a criar/modificar:**
- `src/hooks/useWallet.ts` (refatorar)
- `src/hooks/useLotDetail.ts` (refatorar — ver STORY-009 para otimizacao de query)
- `src/hooks/useTransfers.ts` (refatorar)
- `src/hooks/useUsers.ts` (refatorar)
- `src/hooks/useLots.ts` (refatorar)
- `src/lib/query-keys.ts` (criar — factory de query keys)

**Criar `src/lib/query-keys.ts`:**
```typescript
// Factory centralizado de query keys — evita strings soltas e typos
export const queryKeys = {
  wallet:         (userId: string) => ["wallet", userId] as const,
  walletTxns:     (userId: string) => ["wallet-transactions", userId] as const,
  lotDetail:      (lotId: string)  => ["lot-detail", lotId] as const,
  lots:           (opts: object)   => ["lots", opts] as const,
  transfers:      (userId: string) => ["transfers", userId] as const,
  users:          (opts: object)   => ["users", opts] as const,
  myAuctions:     (userId: string) => ["my-auctions", userId] as const,
  adminLots:      (opts: object)   => ["admin-lots", opts] as const,
  notifications:  (userId: string) => ["notifications", userId] as const,
  purchases:      (userId: string) => ["purchases", userId] as const,
} as const;
```

**Padrao de migracao para useWallet:**
```typescript
// ANTES (useState manual):
const [wallet, setWallet] = useState<Wallet | null>(null);
useEffect(() => { fetchWallet(); }, [user]);

// DEPOIS (TanStack Query):
const walletQuery = useQuery({
  queryKey: queryKeys.wallet(user?.id ?? ""),
  queryFn: async () => {
    const { data, error } = await supabase
      .from("wallets").select("*").eq("user_id", user!.id).single();
    if (error) throw error;
    return data;
  },
  enabled: !!user,
  staleTime: 30_000,
});

// Realtime: invalida o cache ao receber mudanca (sem setState manual)
useEffect(() => {
  if (!user) return;
  const ch = supabase.channel(`wallet-${user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "wallets",
        filter: `user_id=eq.${user.id}` },
      () => queryClient.invalidateQueries({ queryKey: queryKeys.wallet(user.id) })
    ).subscribe();
  return () => { supabase.removeChannel(ch); };
}, [user?.id]);
```

**Criterios de aceite:**
- [ ] `useWallet` migrado: multiplos componentes usando o mesmo hook compartilham o mesmo cache (0 requests duplicados)
- [ ] Apos `useBuyNow` sucesso, `useWallet` invalida e refetch automaticamente (saldo atualiza na UI)
- [ ] `useLotDetail` migrado: carregamento do lote usa TanStack Query com invalidacao via realtime
- [ ] `useTransfers` migrado: lista de transferencias com cache e invalidacao apos nova transferencia
- [ ] `useUsers` migrado: seguindo o padrao de `useAdminLots` (useQuery + useMutation)
- [ ] `queryKeys.ts` em uso em todos os hooks novos
- [ ] Nenhum regression nos fluxos de UI existentes

**Notas tecnicas:**
- Migrar um hook por PR para facilitar review e rollback.
- `queryClient.invalidateQueries` substitui todos os `setState` manuais chamados a partir de eventos realtime.
- `staleTime: 30_000` para wallet reduz refetches desnecessarios mantendo dados razoavelmente frescos.

---

### STORY-009: Corrigir N+1 em useLotDetail (4 queries para 1)
**Tipo:** Performance | **Prioridade:** P1 | **Pontos:** 3 | **Dependencias:** STORY-008

**Descricao:**
`useLotDetail` executa 4 queries sequenciais para carregar um unico lote: (1) SELECT lote, (2) SELECT bids, (3) SELECT lot_items, (4) SELECT assets. Com latencia de rede de 100ms, isso e 400ms minimos antes de renderizar a pagina mais critica do produto. O Supabase PostgREST suporta joins nativos via `.select()` com relacionamentos aninhados.

**Arquivos a criar/modificar:**
- `src/hooks/useLotDetail.ts` (modificar — implementar apos STORY-008)

**Implementacao:**
```typescript
// ANTES (4 round-trips):
const { data: lotData }   = await supabase.from("lots").select("*").eq("id", lotId).maybeSingle();
const { data: bidsData }  = await supabase.from("bids").select("*").eq("lot_id", lotId).order("amount", { ascending: false });
const { data: itemsData } = await supabase.from("lot_items").select("asset_id").eq("lot_id", lotId);
const { data: assetsData } = await supabase.from("assets").select("*").in("id", assetIds);

// DEPOIS (1 round-trip com join nativo PostgREST):
const { data, error } = await supabase
  .from("lots")
  .select(`
    *,
    bids(
      id, amount, user_id, created_at,
      profiles(full_name, avatar_url)
    ),
    lot_items(
      asset_id,
      assets(
        id, asset_type, sector, state, revenue,
        employees, scoring, status
      )
    )
  `)
  .eq("id", lotId)
  .order("amount", { foreignTable: "bids", ascending: false })
  .single();

if (error) throw error;
return data;
```

**Criterios de aceite:**
- [ ] Carregamento do LotDetail faz 1 request ao banco (verificar via Supabase Query Editor ou Network tab)
- [ ] Dados de lote, bids, lot_items e assets aparecem corretamente na UI
- [ ] Performance: carregamento < 200ms em condicao normal de rede
- [ ] Realtime ainda funciona: novos lances invalidam o cache via broadcast channel
- [ ] Os 3 canais realtime em `useLotDetail` sao revisados — manter apenas 1 (broadcast) + postgres_changes em `lots` como fallback; remover canal duplicado de `bids`

**Notas tecnicas:**
- O PostgREST do Supabase suporta `foreignTable` no `.order()` para ordenar resultados de tabelas relacionadas.
- A query aninhada `profiles(full_name)` dentro de `bids` evita o segundo round-trip para buscar dados de exibicao dos bidders.

---

### STORY-010: Extrair utilitarios formatCurrency e formatDate
**Tipo:** Code Quality | **Prioridade:** P2 | **Pontos:** 1 | **Dependencias:** nenhuma

**Descricao:**
A funcao `formatCurrency` com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` esta duplicada em pelo menos 9 arquivos: `LotDetail.tsx`, `Wallet.tsx`, `Transfers.tsx`, `Purchases.tsx`, `AdminLots.tsx`, `AdminPromotions.tsx`, `BidPanel.tsx`, `TopBar.tsx`, `MyAuctions.tsx`. Idem para `formatDate`. Qualquer ajuste de formatacao (ex: mudar locale ou adicionar centavos) exige alterar 9 arquivos.

**Arquivos a criar/modificar:**
- `src/lib/format.ts` (criar)
- 9 arquivos consumidores (remover definicao local e importar de `src/lib/format.ts`)

**Implementacao (`src/lib/format.ts`):**
```typescript
/**
 * Formata valor numerico como moeda BRL.
 * @example formatCurrency(1500.5) // "R$ 1.500,50"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata Date ou string ISO como data/hora pt-BR.
 * @example formatDate("2026-02-26T10:00:00Z") // "26/02/2026, 07:00"
 */
export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString("pt-BR", options);
}

/**
 * Formata Date ou string ISO como data curta pt-BR.
 * @example formatDateShort("2026-02-26") // "26/02/2026"
 */
export function formatDateShort(value: string | Date): string {
  return new Date(value).toLocaleDateString("pt-BR");
}
```

**Criterios de aceite:**
- [ ] `src/lib/format.ts` criado com `formatCurrency`, `formatDate`, `formatDateShort`
- [ ] Todos os 9 arquivos com definicao local de `formatCurrency` removida — importam de `@/lib/format`
- [ ] Output visual das funcoes identico ao anterior (nenhuma regressao de formatacao)
- [ ] Funcoes exportadas cobertas por unit tests minimos (ver STORY-015)

**Notas tecnicas:**
- Esta e a story mais simples do backlog. Pode ser feita por qualquer dev como warm-up.
- `@/lib/format` segue a convencao `src/lib/` ja estabelecida no projeto (onde `src/lib/utils.ts` existe).

---

### STORY-011: Consolidar sistema de toast (remover toaster, manter sonner)
**Tipo:** Code Quality | **Prioridade:** P2 | **Pontos:** 2 | **Dependencias:** nenhuma

**Descricao:**
O projeto possui dois sistemas de toast ativos simultaneamente: `shadcn/ui Toaster` (Radix-based, via `useToast()`) e `Sonner` (`<Sonner />` em App.tsx). Isso resulta em dois "toasters" distintos no DOM com comportamentos visuais diferentes. A maioria dos hooks usa `import { toast } from "@/hooks/use-toast"` (Radix). A escolha e manter Sonner (mais moderno, animacoes melhores, ja instalado como pacote dedicado) e migrar todos os callers para `import { toast } from "sonner"`.

**Arquivos a criar/modificar:**
- `src/App.tsx` (remover `<Toaster />` do shadcn, manter `<Sonner />`)
- `src/hooks/use-toast.ts` (avaliar remocao ou manter para retrocompatibilidade temporaria)
- Todos os hooks que importam `toast` de `@/hooks/use-toast` (migrar para `sonner`)
- `src/components/ui/toaster.tsx` (pode ser removido do projeto)

**Mapa de migracao:**
```typescript
// ANTES (Radix toast):
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();
toast({ title: "Sucesso!", description: "Lance enviado." });

// DEPOIS (Sonner):
import { toast } from "sonner";
toast.success("Lance enviado.");
toast.error("Erro ao enviar lance.");
toast("Mensagem neutra");
```

**Criterios de aceite:**
- [ ] Apenas 1 `<Toaster />` no DOM (Sonner)
- [ ] Todos os toasts do sistema usam a API do Sonner
- [ ] Toasts de sucesso, erro e neutros exibem corretamente (visual e comportamento)
- [ ] `@/components/ui/toaster.tsx` pode ser removido sem erros de import
- [ ] Nenhuma regressao nos fluxos que usam toast (lance, compra, saque, transferencia)

**Notas tecnicas:**
- Sonner ja esta instalado (`1.7.4`) e ja renderizado em `App.tsx` — apenas os callers precisam migrar.
- `shadcn/ui` tem um wrapper para Sonner: `npx shadcn@latest add sonner` pode ja ter configurado o tema corretamente.
- Remover `next-themes` (instalado mas nunca usado) pode ser feito nesta story como bonus.

---

### STORY-012: Extrair logica de fetch das paginas para hooks customizados
**Tipo:** Code Quality | **Prioridade:** P2 | **Pontos:** 3 | **Dependencias:** STORY-008

**Descricao:**
Tres paginas fazem fetch diretamente dentro do componente, quebrando separacao de responsabilidades e impossibilitando reutilizacao: `Purchases.tsx` (linhas 41-72: fetch purchases + returns), `Notifications.tsx` (linhas 34-51: fetch notifications + subscricao realtime), `AdminSettings.tsx` (linhas 26-48: fetch app_settings).

**Arquivos a criar/modificar:**
- `src/hooks/usePurchases.ts` (criar)
- `src/hooks/useNotifications.ts` (criar)
- `src/hooks/useAppSettings.ts` (criar)
- `src/pages/Purchases.tsx` (remover logica de fetch, consumir hook)
- `src/pages/Notifications.tsx` (remover logica de fetch, consumir hook)
- `src/pages/admin/AdminSettings.tsx` (remover logica de fetch, consumir hook)

**Padrao para usePurchases.ts:**
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";

export function usePurchases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.purchases(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, returns(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
```

**Criterios de aceite:**
- [ ] `usePurchases`, `useNotifications`, `useAppSettings` criados e testados
- [ ] `Purchases.tsx`, `Notifications.tsx`, `AdminSettings.tsx` sem logica de fetch (apenas consumo do hook)
- [ ] Comportamento identico ao anterior (nenhuma regressao de UI)
- [ ] `useNotifications` inclui subscricao realtime para novas notificacoes (igual ao que estava em `Notifications.tsx`)
- [ ] Novos hooks seguem o padrao TanStack Query estabelecido em STORY-008

---

### STORY-013: Substituir fetch() nativo por supabase.functions.invoke()
**Tipo:** Code Quality + Security | **Prioridade:** P2 | **Pontos:** 2 | **Dependencias:** STORY-004

**Descricao:**
`useWithdraw` e `useUsers.createUser` chamam Edge Functions via `fetch()` nativo com URLs montadas manualmente (`${VITE_SUPABASE_URL}/functions/v1/...`). Isso cria tres riscos: (1) se `VITE_SUPABASE_URL` nao estiver definido, a URL sera `undefined/functions/v1/...` e o erro sera silencioso, (2) o codigo e inconsistente com o resto do projeto que usa `supabase.functions.invoke()`, (3) tratamento de erros HTTP e feito manualmente com `if (!response.ok)`.

**Arquivos a criar/modificar:**
- `src/hooks/useWithdraw.ts` (modificar)
- `src/hooks/useUsers.ts` (modificar — funcao `createUser`)

**Implementacao:**
```typescript
// ANTES (useWithdraw.ts — fetch nativo):
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const response = await fetch(`${SUPABASE_URL}/functions/v1/request-withdrawal`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionData.session.access_token}`,
  },
  body: JSON.stringify({ amount, bankInfo }),
});
if (!response.ok) throw new Error(await response.text());

// DEPOIS (supabase.functions.invoke):
const { data, error } = await supabase.functions.invoke("request-withdrawal", {
  body: { amount, bankInfo },
  // JWT e injetado automaticamente pelo cliente Supabase
});
if (error) throw error;
```

**Criterios de aceite:**
- [ ] `useWithdraw` nao importa `VITE_SUPABASE_URL` nem usa `fetch()` nativo
- [ ] `useUsers.createUser` nao usa `fetch()` nativo
- [ ] Fluxo de saque funciona corretamente de ponta a ponta
- [ ] Fluxo de criacao de usuario funciona corretamente
- [ ] Tratamento de erro consistente com o resto do projeto

**Notas tecnicas:**
- `supabase.functions.invoke()` injeta automaticamente o JWT do usuario logado via o token da sessao — nao e necessario passar o `Authorization` header manualmente.
- Erros HTTP (4xx/5xx) sao retornados como `error` no objeto de retorno — tratamento uniforme.

---

## Sprint 3 — TypeScript & Testes
*Meta: Habilitar strict mode, adicionar cobertura de testes para codigo financeiro e fluxos criticos*
*Duracao estimada: 2 semanas | Pontos totais: 18*

---

### STORY-014: Habilitar TypeScript strict mode
**Tipo:** Code Quality | **Prioridade:** P2 | **Pontos:** 5 | **Dependencias:** STORY-008, STORY-013

**Descricao:**
`tsconfig.app.json` tem `"strict": false`, `"noImplicitAny": false`, `"noUnusedLocals": false`. Com `noImplicitAny: false`, parametros sem tipo sao `any` implicito. Em hooks financeiros, um campo `amount` mal tipado pode causar operacoes incorretas silenciosamente. A abordagem e migracao gradual: primeiro `noImplicitAny`, depois `strict: true`.

**Arquivos a criar/modificar:**
- `tsconfig.app.json` (modificar — habilitar flags gradualmente)
- Varios arquivos de hooks e componentes (corrigir erros emergentes)

**Plano de migracao:**
```json
// Fase 1 — tsconfig.app.json (menor impacto):
{
  "noImplicitAny": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}

// Fase 2 (apos corrigir erros da fase 1):
{
  "strict": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true
}
```

**Criterios de aceite:**
- [ ] `tsc --noEmit` sem erros com `noImplicitAny: true` (fase 1)
- [ ] `tsc --noEmit` sem erros com `strict: true` (fase 2)
- [ ] Nenhum cast `as T` em hooks financeiros (`useWallet`, `usePlaceBid`, `useWithdraw`, `useBuyNow`) — substituir por parsing Zod das respostas de Edge Functions
- [ ] `noUnusedLocals: true` remove variaveis mortas (ex: `useLots.ts` dead code)
- [ ] Build de producao (`vite build`) sem warnings de TypeScript

**Notas tecnicas:**
- Usar `// @ts-expect-error` com comentario explicativo para suprimir erros legitimos temporariamente durante a migracao.
- Priorizar correcao nos hooks financeiros (`useWallet`, `useWithdraw`, `usePlaceBid`) antes dos componentes de UI.
- Remover `next-themes` (instalado mas nunca usado) nesta story para limpar `noUnusedLocals`.

---

### STORY-015: Adicionar unit tests para hooks financeiros
**Tipo:** Testing | **Prioridade:** P2 | **Pontos:** 5 | **Dependencias:** STORY-008, STORY-013

**Descricao:**
O projeto tem Vitest + @testing-library configurados mas zero testes uteis. Hooks financeiros (`useWallet`, `usePlaceBid`, `useWithdraw`, `useBuyNow`) nao tem cobertura. Uma regressao nesses hooks pode resultar em perda financeira para usuarios.

**Arquivos a criar/modificar:**
- `src/hooks/__tests__/useWallet.test.ts` (criar)
- `src/hooks/__tests__/usePlaceBid.test.ts` (criar)
- `src/hooks/__tests__/useWithdraw.test.ts` (criar)
- `src/lib/__tests__/format.test.ts` (criar — testar STORY-010)
- `src/test/setup.ts` (criar ou verificar — mock do supabase client)

**Exemplo de test (`format.test.ts`):**
```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formata valor positivo como BRL", () => {
    expect(formatCurrency(1500.50)).toBe("R$\u00a01.500,50");
  });
  it("formata zero", () => {
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
  });
  it("formata valor negativo", () => {
    expect(formatCurrency(-100)).toBe("-R$\u00a0100,00");
  });
});
```

**Criterios de aceite:**
- [ ] `vitest run` executa sem erros
- [ ] `formatCurrency` e `formatDate` com cobertura de 100%
- [ ] `useWallet` com testes de: carregamento inicial, estado de loading, estado de erro, dados retornados
- [ ] `usePlaceBid` com testes de: lance valido, lance abaixo do minimo, lance com saldo insuficiente (mock da Edge Function)
- [ ] `useWithdraw` com testes de: saque valido, saque sem `can_withdraw`, resposta de erro da Edge Function
- [ ] Cobertura minima de 80% nas funcoes de `src/lib/format.ts`

---

### STORY-016: Adicionar integration tests para fluxo de auth
**Tipo:** Testing | **Prioridade:** P2 | **Pontos:** 3 | **Dependencias:** STORY-004, STORY-005

**Descricao:**
O fluxo de autenticacao (login, logout, redirect de rotas protegidas, guard de rotas admin) nao tem nenhum teste. Com `AuthContext` e `ProtectedRoute` criados nas STORY-004 e STORY-005, agora e possivel testar esses componentes de forma isolada.

**Arquivos a criar/modificar:**
- `src/contexts/__tests__/AuthContext.test.tsx` (criar)
- `src/components/routes/__tests__/ProtectedRoute.test.tsx` (criar)
- `src/components/routes/__tests__/AdminRoute.test.tsx` (criar)

**Casos de teste prioritarios:**
```typescript
// ProtectedRoute.test.tsx
describe("ProtectedRoute", () => {
  it("redireciona para /auth/login quando usuario nao autenticado", ...)
  it("renderiza children quando usuario autenticado", ...)
  it("exibe loading state enquanto sessao carrega", ...)
})

// AdminRoute.test.tsx
describe("AdminRoute", () => {
  it("redireciona para /marketplace quando role nao e admin", ...)
  it("renderiza children quando role e admin", ...)
  it("redireciona para /auth/login quando nao autenticado", ...)
})
```

**Criterios de aceite:**
- [ ] 6+ testes passando para `ProtectedRoute` e `AdminRoute`
- [ ] Mock do `AuthContext` funcionando com diferentes estados (loading, authenticated, unauthenticated, admin, non-admin)
- [ ] `vitest run` sem erros

---

### STORY-017: Adicionar E2E test para fluxo de lance
**Tipo:** Testing | **Prioridade:** P3 | **Pontos:** 5 | **Dependencias:** STORY-015, STORY-016

**Descricao:**
O fluxo critico do produto (login > marketplace > selecionar lote > dar lance > ver confirmacao) nao tem nenhum E2E test. Um E2E test protege contra regressoes neste fluxo core.

**Arquivos a criar/modificar:**
- `e2e/bid-flow.spec.ts` (criar — requer escolha de framework: Playwright recomendado)
- `playwright.config.ts` (criar se usando Playwright)
- `package.json` (adicionar `@playwright/test` como devDependency)

**Fluxo do E2E:**
```typescript
// e2e/bid-flow.spec.ts (Playwright)
test("usuario pode dar lance em lote ativo", async ({ page }) => {
  // 1. Login
  await page.goto("/auth/login");
  await page.fill("[data-testid=email]", testUser.email);
  await page.fill("[data-testid=password]", testUser.password);
  await page.click("[data-testid=login-button]");
  await expect(page).toHaveURL("/marketplace");

  // 2. Selecionar lote
  await page.click("[data-testid=lot-card]:first-child");
  await expect(page).toHaveURL(/\/lot\/.+/);

  // 3. Dar lance
  const currentPrice = await page.textContent("[data-testid=current-price]");
  await page.fill("[data-testid=bid-input]", String(parseFloat(currentPrice) + 10));
  await page.click("[data-testid=bid-submit]");

  // 4. Verificar confirmacao
  await expect(page.locator("[data-testid=bid-success-toast]")).toBeVisible();
  await expect(page.locator("[data-testid=auction-status]")).toContainText("Ganhando");
});
```

**Criterios de aceite:**
- [ ] Playwright configurado com ambiente de staging/test
- [ ] E2E test do fluxo de lance passando em CI
- [ ] E2E test de tentativa de acesso admin sem permissao passando
- [ ] E2E test de fluxo de login/logout passando

**Notas tecnicas:**
- Requer ambiente de staging com dados de seed (usuario de teste + lote ativo).
- Adicionar `data-testid` nos elementos interativos necessarios (login form, bid input, etc.).
- Playwright recomendado sobre Cypress por performance e suporte a WebSockets (necessario para testar realtime).

---

## Backlog Completo (tabela resumo)

| Story | Titulo | Sprint | Prioridade | Pontos | Dependencias |
|-------|--------|--------|-----------|--------|--------------|
| STORY-001 | Fix RLS privilege escalation em profiles | 1 | P0 | 3 | — |
| STORY-002 | Fix withdrawals RLS bypass do fluxo atomico | 1 | P0 | 2 | — |
| STORY-003 | Fix race condition em admin-adjust-balance | 1 | P0 | 5 | — |
| STORY-004 | Criar AuthContext singleton | 1 | P0 | 5 | — |
| STORY-005 | Implementar ProtectedRoute e AdminRoute | 1 | P0 | 3 | STORY-004 |
| STORY-006 | Adicionar indexes criticos no banco de dados | 1 | P0 | 2 | — |
| STORY-007 | Fix notificacoes outbid duplicadas | 1 | P1 | 1 | STORY-004 |
| STORY-008 | Unificar data fetching com TanStack Query | 2 | P1 | 8 | STORY-004 |
| STORY-009 | Corrigir N+1 em useLotDetail | 2 | P1 | 3 | STORY-008 |
| STORY-010 | Extrair utilitarios formatCurrency e formatDate | 2 | P2 | 1 | — |
| STORY-011 | Consolidar sistema de toast (manter Sonner) | 2 | P2 | 2 | — |
| STORY-012 | Extrair logica de fetch das paginas para hooks | 2 | P2 | 3 | STORY-008 |
| STORY-013 | Substituir fetch() nativo por supabase.functions.invoke() | 2 | P2 | 2 | STORY-004 |
| STORY-014 | Habilitar TypeScript strict mode | 3 | P2 | 5 | STORY-008, STORY-013 |
| STORY-015 | Adicionar unit tests para hooks financeiros | 3 | P2 | 5 | STORY-008, STORY-013 |
| STORY-016 | Adicionar integration tests para fluxo de auth | 3 | P2 | 3 | STORY-004, STORY-005 |
| STORY-017 | Adicionar E2E test para fluxo de lance | 3 | P3 | 5 | STORY-015, STORY-016 |

**Total de pontos:** 58 pontos | **Total de sprints:** 3

---

## Grafo de Dependencias

```
STORY-001 ──┐
STORY-002 ──┤ (P0 independentes — podem ser feitas em paralelo)
STORY-003 ──┤
STORY-006 ──┘

STORY-004 (AuthContext)
    ├── STORY-005 (ProtectedRoute)
    │       └── STORY-016 (Auth tests)
    ├── STORY-007 (Fix outbid dup)
    ├── STORY-008 (TanStack Query migration)
    │       ├── STORY-009 (N+1 fix)
    │       ├── STORY-012 (Hooks das paginas)
    │       └── STORY-014 (TS strict)
    └── STORY-013 (fetch() -> invoke())
            └── STORY-015 (Unit tests financeiros)
                    └── STORY-017 (E2E)

STORY-010 (formatCurrency) — independente, qualquer momento
STORY-011 (toast unification) — independente, qualquer momento
```

---

## Criterios de Done (Definition of Done)

Para todas as stories:
- [ ] Codigo revisado por pelo menos 1 desenvolvedor
- [ ] Sem warnings de TypeScript (`tsc --noEmit`)
- [ ] Sem erros de lint (ESLint)
- [ ] Testes existentes passando (`vitest run`)
- [ ] Behavior identico ao anterior (nenhuma regressao funcional)
- [ ] Para migrations SQL: testadas em ambiente de staging antes de producao
- [ ] Para security fixes: validados com os testes de SQL em `docs/rls-security-tests.sql`

---

## Riscos e Bloqueadores

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| STORY-001 quebra fluxo de atualizacao de perfil na UI | Media | Alto | Testar todos os campos de perfil editaveis antes do deploy |
| STORY-003 requer deploy de Edge Function + migration em conjunto | Alta | Alto | Deploy atomico: migration primeiro, Edge Function em seguida (< 1 min) |
| STORY-008 (migracao TanStack) causa regressao em fluxo de realtime | Media | Alto | Migrar 1 hook por PR, validar realtime apos cada migracao |
| STORY-006 (CONCURRENTLY) demora em tabelas grandes | Baixa | Medio | Executar fora do horario de pico; monitorar `pg_stat_activity` |
| STORY-004 (AuthContext) muda comportamento de loading/redirect | Media | Alto | Testar todos os fluxos de auth em staging antes de producao |

---

*Backlog gerado por Pax (Product Owner) — AIOS-MASTER*
*Projeto: OxyBroker | Data: 2026-02-26*
*Baseado nos assessments de: Atlas (Business Analyst), Aria (System Architect), Dara (Database Architect)*
