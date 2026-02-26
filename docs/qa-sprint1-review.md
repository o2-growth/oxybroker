# QA Review — Sprint 1
*Gerado por Quinn (QA Engineer) em 2026-02-26*

---

## Resultado Geral: PASS WITH NOTES

O Sprint 1 endereça vulnerabilidades críticas reais e está tecnicamente sólido na maioria dos pontos. Foram encontrados **1 bug crítico** (idempotência do CREATE INDEX CONCURRENTLY), **2 bugs médios** e **3 observações menores** que não bloqueiam o deploy, mas devem ser documentadas e corrigidas em seguida.

---

## Story-by-Story Review

---

### STORY-001: RLS profiles — Fix privilege escalation
**Status: PASS WITH NOTES**

**Análise detalhada:**

A policy `profiles_update_own_restricted` usa corretamente a cláusula `WITH CHECK` para comparar os campos privilegiados (`role`, `can_withdraw`, `suspended_at`) com seus valores correntes via subquery. A lógica está conceitualmente correta: se o cliente tentar `UPDATE profiles SET role = 'admin'`, o `WITH CHECK` vai falhar porque `role = (SELECT p.role ...)` retornará `false` — o UPDATE é rejeitado com erro RLS.

**Teste mental — ataque de escalada:**
```sql
-- Ataque: usuário autenticado tenta se tornar admin
UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
-- Resultado: WITH CHECK falha. "new row violates row-level security policy"
-- CORRETO — protegido.
```

**Teste mental — ataque misto (campos legítimos + campo privilegiado):**
```sql
-- Ataque: atualizar full_name E role no mesmo UPDATE
UPDATE public.profiles SET full_name = 'Hack', role = 'admin' WHERE id = auth.uid();
-- Resultado: WITH CHECK falha. CORRETO — o UPDATE inteiro é rejeitado.
```

**Verificação de schema:** Os campos `role`, `can_withdraw`, `suspended_at` existem na tabela `profiles` conforme `types.ts`. Nomes corretos.

**Issues encontrados:**

1. **[MINOR] Subquery recursiva em WITH CHECK pode causar recursão infinita em RLS.** A subquery `SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()` é executada dentro de uma policy `FOR UPDATE` na mesma tabela `profiles`. No Postgres, a avaliação de `WITH CHECK` acontece depois do UPDATE já ter sido aplicado em memória — a subquery lê a *versão pré-UPDATE do snapshot* (isolamento READ COMMITTED). Isso funciona corretamente neste contexto, mas **se a tabela `profiles` tiver outras policies FOR SELECT ativas que chamem funções SECURITY DEFINER**, pode haver recursão de RLS em versões antigas do Postgres (< 14). No Supabase Postgres 14+ (conforme `types.ts` que declara `PostgrestVersion: "14.1"`), o comportamento é estável. **Risco baixo, mas vale monitorar.**

2. **[MINOR] A policy de SELECT `profiles_select_own` só permite o usuário ver o próprio perfil.** O código do `AuthContext.tsx` faz `supabase.from("profiles").select("*").eq("id", userId)` — isso funciona. Mas componentes admin que precisam listar perfis de outros usuários precisam de policy adicional (`profiles_select_admin`). Esta story não cria essa policy — confirmar que ela existe em migration anterior.

**Aprovado para deploy:** Sim

---

### STORY-002: RLS withdrawals — Fix bypass do fluxo atômico
**Status: PASS**

**Análise detalhada:**

A solução é cirúrgica e correta: dropar `withdrawals_insert_own` bloqueia INSERT direto pelo cliente JS, enquanto o `service_role` continua funcionando por bypassar RLS por default no Supabase. A migration é idempotente (`DROP POLICY IF EXISTS`).

**Verificação de schema:** A tabela `withdrawals` existe conforme `types.ts`. Campos `user_id`, `amount`, `bank_info`, `status`, `requested_at` todos corretos.

**Teste mental — bypass attempt após a migration:**
```js
// Cliente JS tenta inserir diretamente
const { error } = await supabase.from('withdrawals').insert({ user_id: uid, amount: 100, ... });
// Resultado: erro RLS — INSERT bloqueado. CORRETO.
```

**Verificação de regressão — SELECT do próprio usuário:**
A story garante que `withdrawals_select_own` e `withdrawals_select_admin` não são tocadas. Conforme comentário no arquivo: "SELECT próprio: INTACTO via `withdrawals_select_own`". Leitura do usuário continua funcionando.

**Nota:** Existe também a view `withdrawals_user` no schema — ela já filtra por `user_id` e é a interface pública para leitura. Não é afetada por esta migration.

**Issues encontrados:** Nenhum.

**Aprovado para deploy:** Sim

---

### STORY-003: Race condition atômica — admin_adjust_balance_atomic
**Status: PASS WITH NOTES**

**Análise SQL:**

A função usa `FOR UPDATE` no `SELECT` da wallet — isso serializa corretamente chamadas concorrentes para o mesmo `user_id`. O `UPDATE` e o `INSERT` em `wallet_transactions` acontecem na mesma transação gerenciada pelo Postgres, eliminando a race condition do fluxo anterior.

**Verificação de schema:**
- Tabela `wallets`: colunas `balance`, `updated_at`, `user_id` — todas corretas.
- Tabela `wallet_transactions`: colunas `user_id`, `amount`, `type` (enum), `description`, `reference_id`, `reference_type`, `created_at` — todas corretas.
- Enum `wallet_transaction_type`: inclui `'admin_adjust'` — confirmado em `types.ts` linha 1100. CORRETO.
- `SECURITY DEFINER`: presente na linha 17. CORRETO.
- `SET search_path = public`: presente na linha 18. CORRETO.
- `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO service_role`: presentes nas linhas 85-86. CORRETO.

**Análise do Edge Function `admin-adjust-balance/index.ts`:**

- Valida Bearer token antes de qualquer operação.
- Usa `supabaseUser.auth.getClaims(token)` para extrair o `adminId` do JWT — sem confiar no corpo da requisição para identidade.
- Chama `has_role(_user_id, 'admin')` com cliente `service_role` para verificar autorização. A função `has_role` existe no schema conforme `types.ts` linha 1041. CORRETO.
- Valida todos os inputs: `user_id` (string), `amount` (number > 0, <= 100000), `reason` (string, 5-500 chars).
- Chama `admin_adjust_balance_atomic` via `supabaseAdmin.rpc()` — com service_role, garante que a função SQL é chamada com permissões elevadas.

**Issues encontrados:**

3. **[MEDIO] Validação de `amount` rejeita valores negativos — mas a função SQL aceita `p_amount` negativo (débito).** No edge function, linha 83: `if (typeof amount !== "number" || amount <= 0)` rejeita qualquer valor `<= 0`. Isso significa que **débitos administrativos (amount negativo) são impossíveis via este endpoint**. A função SQL aceita valores negativos e até tem proteção contra saldo negativo (`v_new_balance < 0`). Se a intenção é suportar débitos admin no futuro, a validação no edge function precisará ser ajustada. Se a intenção atual é crédito-only, o comentário na linha 119-120 (`p_amount: amount`) e o log na linha 150 (`"added"`) confirmam crédito-only, mas a função SQL e o tipo TypeScript `p_amount: NUMERIC` sugerem bidirecionalidade. **Inconsistência de design que deve ser clarificada.**

4. **[MINOR] `getClaims` não é API pública estável do Supabase JS v2.** O método `supabaseUser.auth.getClaims(token)` (linha 35) não consta na documentação oficial do `@supabase/supabase-js@2`. A API documentada para verificar tokens server-side é `supabase.auth.getUser(token)` que retorna `{ data: { user }, error }`. Se `getClaims` não existir na versão do SDK em uso, a função retornará um erro de runtime silencioso e sempre rejeitará com 401. **Verificar se a versão do SDK `@supabase/supabase-js@2` instalada no ambiente Deno expõe `getClaims` ou se deveria ser `getUser`.**

**Aprovado para deploy:** Sim, com ressalva sobre o item 4 (verificar API getClaims).

---

### STORY-004 + STORY-005: AuthContext + Routes
**Status: PASS**

**Análise do AuthContext (`src/contexts/AuthContext.tsx`):**

- **Memory leak:** A subscription é corretamente limpa no cleanup do `useEffect` via `return () => subscription.unsubscribe()` (linha 86). Sem leak.
- **Ordem de inicialização:** `getSession()` é chamado antes de `onAuthStateChange` — correto para evitar flash de estado não-autenticado no primeiro render.
- **Loading state:** `setLoading(false)` é chamado tanto no path com usuário (dentro de `fetchProfile`, linha 55) quanto no path sem usuário (linha 67). Sem risco de loading infinito.
- **Uma única subscription:** O comentário na linha 71 confirma e o código confirma — apenas um `onAuthStateChange` registrado. Correto.
- **Retrocompatibilidade:** `useAuth.ts` é um re-export limpo de `AuthContext.tsx` (linha 8). Todos os imports de `@/hooks/useAuth` continuam funcionando sem alteração.

**Análise do Profile type:** O tipo `Profile` em `AuthContext.tsx` (linhas 9-20) corresponde exatamente às colunas da tabela `profiles` em `types.ts` — `id`, `full_name`, `email`, `role`, `franchise_category_id`, `avatar_url`, `can_withdraw`, `suspended_at`, `created_at`, `updated_at`. CORRETO.

**Análise do ProtectedRoute:**
- Mostra spinner enquanto `loading = true` — sem flash de conteúdo protegido.
- Redireciona para `/auth/login` com `state.from` para redirect pós-login.
- Cobre os dois cenários: loading e não-autenticado.

**Análise do AdminRoute:**
- Três estados cobertos: loading geral, user ausente, profile ausente (loading pós-user).
- Quando `loading = false`, `user` presente e `profile` ausente: exibe spinner (linhas 36-41). Isso previne flash do conteúdo admin enquanto o profile ainda carrega.
- Verifica `profile.role !== 'admin'` — corretamente usa a propriedade do objeto, não uma função.

**Análise do App.tsx:**
- `AuthProvider` está dentro de `BrowserRouter` (linha 45) — necessário porque `AuthProvider` usa `useNavigate` (linha 43 do AuthContext). Se estivesse fora do Router, `useNavigate` lançaria erro. CORRETO.
- `OutbidNotificationProvider` está dentro de `AuthProvider` — correto, pois o provider de notificações depende de `useAuth`.
- Rotas públicas `/auth/login` e `/auth/signup` não são envolvidas por `ProtectedRoute`. CORRETO.

**Issues encontrados:**

5. **[MINOR] `fetchProfile` não trata erro de RLS ou profile inexistente.** Na linha 46-55 de `AuthContext.tsx`, se o SELECT retornar erro (ex: profile ainda não foi criado via trigger, ou RLS bloqueou), o `data` será `null` e `setProfile` não é chamado — `profile` permanece `null` indefinidamente. Isso não causa crash mas pode deixar o usuário preso no spinner do `AdminRoute` (que aguarda `!profile`). Recomenda-se adicionar tratamento: `if (!data) { setProfile(null); }` para garantir que o estado seja resolvido.

**Aprovado para deploy:** Sim

---

### STORY-006: Indexes críticos de performance
**Status: FAIL — BUG CRÍTICO**

**Bug Crítico encontrado:**

**[CRITICO] `CREATE INDEX CONCURRENTLY` não pode ser executado dentro de um transaction block — e o Supabase executa cada migration dentro de uma transação implícita.**

No Supabase, as migrations SQL são executadas via `supabase db push` ou pela plataforma, que envolve cada arquivo em um `BEGIN ... COMMIT` implícito. O `CREATE INDEX CONCURRENTLY` é explicitamente proibido dentro de transaction blocks pelo PostgreSQL:

```
ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

Isso significa que **todos os 13 `CREATE INDEX CONCURRENTLY` desta migration vão falhar** quando executados via `supabase db push` ou pelo migration runner do Supabase. A migration vai abortar na primeira instrução, nenhum index será criado, e a migration ficará marcada como falha no histórico do Supabase.

**Arquivo:** `supabase/migrations/20260226000004_add_critical_indexes.sql`
**Linhas afetadas:** 22, 27, 32, 36, 43, 47, 55, 61, 69, 75, 80, 87, 92, 99, 103

**A migration precisa ser reescrita de uma de duas formas:**

**Opção A — Remover CONCURRENTLY (mais simples, requer janela de manutenção):**
```sql
CREATE INDEX IF NOT EXISTS idx_bids_lot_id ON bids(lot_id);
-- (sem CONCURRENTLY — bloqueia writes durante criação, mas funciona em migration)
```

**Opção B — Usar `supabase/migrations` com flag `-- no-transaction`:**
Adicionar ao topo do arquivo:
```sql
-- no-transaction
```
Isso instrui o Supabase CLI a não envolver o arquivo em transaction block, permitindo `CONCURRENTLY`. Esta é a abordagem correta para manter os indexes não-bloqueantes em produção.

**Recomendação:** Usar Opção B (`-- no-transaction`) pois mantém o benefício do CONCURRENTLY (zero downtime em produção). A Opção A funcionaria mas bloquearia escritas durante a criação dos indexes.

**Issues encontrados:** Bug crítico acima.

**Aprovado para deploy:** Não — requer correção antes.

---

### STORY-007: Outbid fix — useOutbidNotifications
**Status: PASS**

**Análise:**

- **Canal único:** Uma única chamada a `supabase.channel()` dentro do `useEffect`. Sem duplicação. CORRETO.
- **Nome de canal único por usuário:** `outbid-${user.id}` — evita conflito entre usuários diferentes na mesma sessão de desenvolvimento/test. CORRETO.
- **Cleanup correto:** `return () => { supabase.removeChannel(channel); }` — o canal é removido quando o componente desmonta ou quando `user` muda. Sem memory leak.
- **Dependências do useEffect:** `[user, toast, formatCurrency]` — correto. `formatCurrency` é memoizado com `useCallback([], [])` (sem dependências externas). `toast` vem de `useToast` e é estável. `user` é o trigger correto para reconstruir o canal quando o usuário muda.
- **Guard `if (!user) return`:** Previne subscrição quando não autenticado. CORRETO.
- **Remoção do canal duplicado:** O comentário (linhas 29-31) documenta que o `postgres_changes` anterior foi removido, resolvendo o bug dos dois toasts por outbid.

**Issues encontrados:** Nenhum.

**Aprovado para deploy:** Sim

---

## Bugs Encontrados

### Bug Crítico (bloqueante para deploy)

| # | Story | Arquivo | Linha | Descrição |
|---|-------|---------|-------|-----------|
| BUG-001 | STORY-006 | `supabase/migrations/20260226000004_add_critical_indexes.sql` | 22, 27, 32, 36, 43, 47, 55, 61, 69, 75, 80, 87, 92, 99, 103 | `CREATE INDEX CONCURRENTLY` falha dentro de transaction block. O Supabase executa migrations em transação implícita. Todos os 13 indexes vão falhar. A migration deve adicionar `-- no-transaction` na primeira linha, ou substituir `CONCURRENTLY` por indexes bloqueantes simples. |

**Correção exata para BUG-001:**

No arquivo `supabase/migrations/20260226000004_add_critical_indexes.sql`, adicionar na **linha 1** (antes de qualquer comentário):

```sql
-- no-transaction
```

O arquivo completo ficaria:
```sql
-- no-transaction
-- =============================================================================
-- STORY-006: Indexes criticos de performance
-- ...resto do arquivo sem alteração...
```

---

### Bugs Médios (não bloqueantes, mas devem ser corrigidos em seguida)

| # | Story | Arquivo | Linha | Descrição |
|---|-------|---------|-------|-----------|
| BUG-002 | STORY-003 | `supabase/functions/admin-adjust-balance/index.ts` | 35 | `supabase.auth.getClaims(token)` não é API documentada do Supabase JS v2. A API correta é `supabase.auth.getUser(token)` que retorna `{ data: { user }, error }`. Se `getClaims` não existir no runtime Deno, a função sempre retornará 401 silenciosamente. |
| BUG-003 | STORY-003 | `supabase/functions/admin-adjust-balance/index.ts` | 83 | Validação `amount <= 0` torna impossível débitos administrativos, mas a função SQL `admin_adjust_balance_atomic` suporta valores negativos (com proteção contra saldo negativo). Inconsistência entre edge function e função SQL. Deve ser documentada como decisão intencional ou corrigida. |

---

## Bugs Menores / Sugestões

| # | Story | Arquivo | Descrição | Prioridade |
|---|-------|---------|-----------|------------|
| SUG-001 | STORY-004 | `src/contexts/AuthContext.tsx` linha 46-55 | `fetchProfile` não trata o caso de `data === null` (profile inexistente ou erro RLS). Usuário autenticado sem profile fica com `profile = null` e pode travar no spinner do `AdminRoute`. Adicionar `else { setProfile(null); setLoading(false); }` após o bloco `if (data)`. | Baixa |
| SUG-002 | STORY-001 | `supabase/migrations/20260226000001_fix_rls_profiles_privilege_escalation.sql` | Confirmar que existe policy `profiles_select_admin` em migration anterior para que admins consigam listar perfis de outros usuários. Esta migration não a cria e o `AdminUsers` page provavelmente precisa dela. | Baixa |
| SUG-003 | STORY-004 | `src/contexts/AuthContext.tsx` | `signOut` (linha 113) chama `navigate("/auth/login")` diretamente. Se `signOut` for chamado de dentro de um componente que já foi desmontado (ex: timeout), pode causar warning de "Can't perform a state update on an unmounted component". Considerar checar se ainda montado ou usar `window.location.href` como fallback. | Muito baixa |

---

## Checklist de Regressão

| Item | Resultado | Observação |
|------|-----------|------------|
| SQL sintaticamente válido | PASS | Todas as 4 migrations sem erros de sintaxe |
| Migrations idempotentes | PASS (com nota) | STORY-006 usa `IF NOT EXISTS` mas falha antes disso por causa do transaction block |
| Policies RLS protegem corretamente | PASS | STORY-001 e STORY-002 protegem os cenários descritos |
| Nomes de tabelas/colunas batem com schema | PASS | Todos os nomes verificados contra `types.ts` |
| Função atômica tem SECURITY DEFINER | PASS | Linha 17 do migration STORY-003 |
| Função atômica tem SET search_path = public | PASS | Linha 18 do migration STORY-003 |
| REVOKE/GRANT corretos | PASS | Linhas 85-86 do migration STORY-003 |
| CREATE INDEX CONCURRENTLY compatível com transactions | FAIL | BUG-001 — não compatível, migration vai falhar |
| AuthContext sem memory leak | PASS | Cleanup via `subscription.unsubscribe()` correto |
| Retrocompatibilidade do useAuth | PASS | `src/hooks/useAuth.ts` é re-export limpo |
| ProtectedRoute trata loading corretamente | PASS | Spinner enquanto loading, redirect se não autenticado |
| AdminRoute trata loading e profile corretamente | PASS | Três estados cobertos: loading, sem user, sem profile |
| App.tsx — AuthProvider dentro de BrowserRouter | PASS | Linha 44-45 — ordem correta |
| Sem re-renders desnecessários no AuthContext | PASS | Estado simples com useState, sem loops de re-render |
| useOutbidNotifications tem 1 canal e cleanup | PASS | Canal único com `removeChannel` no cleanup |
| Política profiles impede `SET role = 'admin'` | PASS | WITH CHECK rejeita mudança de campo privilegiado |
| DROP de withdrawals_insert_own não quebra SELECT | PASS | SELECT policies intactas |
| Edge function valida caller como admin | PASS | `has_role` chamado com service_role antes de executar RPC |
| Usuários comuns não acessam /admin/* | PASS | AdminRoute verifica `profile.role !== 'admin'` |
| Usuário não autenticado vai para /auth/login | PASS | ProtectedRoute e AdminRoute redirecionam corretamente |
| Rotas /auth/login e /auth/signup públicas | PASS | Não estão dentro de ProtectedRoute no App.tsx |
| Componentes com useAuth() direto ainda funcionam | PASS | Re-export garante mesma interface |
| `admin_adjust` existe no enum wallet_transaction_type | PASS | Confirmado em types.ts linha 1100 |
| Coluna `created_by` em lots (não seller_id) | PASS | Migration STORY-006 usa `created_by` corretamente |

---

## Recomendação Final

**REQUEST CHANGES**

O Sprint 1 está bem executado na essência — as vulnerabilidades de segurança (STORY-001, STORY-002) são corretamente endereçadas, a função atômica (STORY-003) tem a estrutura certa, e o trabalho de frontend (STORY-004, STORY-005, STORY-007) está limpo e sem regressões.

**O bloqueio para deploy é único: BUG-001 na STORY-006.**

A correção é mínima — adicionar `-- no-transaction` na primeira linha do arquivo `supabase/migrations/20260226000004_add_critical_indexes.sql`. Após esta correção, o Sprint pode ser aprovado para deploy com confiança.

**Prioridade de ação:**
1. **Imediato (bloqueante):** Corrigir BUG-001 — adicionar `-- no-transaction` em `20260226000004_add_critical_indexes.sql`.
2. **Próxima sprint (médio):** Investigar e corrigir BUG-002 (`getClaims` vs `getUser` na edge function).
3. **Backlog:** BUG-003 (decisão de design sobre débitos negativos), SUG-001 (fetchProfile sem tratamento de erro), SUG-002 (confirmar policy select_admin).

Após a correção do BUG-001: **APPROVE**.
