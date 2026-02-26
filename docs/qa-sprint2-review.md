# QA Review — Sprint 2: Quality Standardization

**Revisor:** Quinn (QA Engineer)
**Data:** 2026-02-26
**Branch:** `feat/sprint2-quality-standardization`
**Projeto:** OxyBroker

---

## Veredicto Final: REQUEST CHANGES

O Sprint 2 entregou uma base de padronização sólida — QueryKey factory, formatCurrency centralizado e migração para Sonner estão corretos. No entanto, foram identificados **3 bugs reais** que precisam ser corrigidos antes do merge, além de problemas de lint que impactam a qualidade do código.

---

## Resumo por Story

| Story | Status | Observações |
|-------|--------|-------------|
| STORY-008 — QueryKey Factory | PASS | Implementação correta |
| STORY-009 — N+1 fix + TanStack Query | PASS com ressalvas | useWallet tem silenciamento parcial de erro (ver BUG-002) |
| STORY-010 — formatCurrency centralizado | PASS | Nenhuma definição local encontrada fora de `format.ts` |
| STORY-011 — Toast unificado | PASS | Sonner presente, Toaster antigo removido |
| STORY-012 — Hooks para páginas | REQUEST CHANGES | BUG-001: channel name fixo em useNotifications |
| STORY-013 — fetch() → supabase.functions.invoke | PARTIAL PASS | useUsers não foi migrado para useQuery (ver BUG-003) |

---

## Bugs Encontrados

### BUG-001 — ALTA SEVERIDADE
**Arquivo:** `src/hooks/useNotifications.ts`, linha 37
**Descrição:** Channel name estático `"user-notifications"` causa conflito de canal no Supabase Realtime.

Se o mesmo usuário abrir duas abas, ou se o componente montar/desmontar rapidamente (StrictMode, navegação), o Supabase vai rejeitar ou sobrescrever o canal existente silenciosamente, causando perda de notificações em tempo real.

**Código atual:**
```typescript
const channel = supabase
  .channel("user-notifications")   // <-- FIXO: conflito multi-aba / re-mount
```

**Correção necessária:** Incluir o `user.id` no nome do canal para torná-lo único por usuário:
```typescript
const channel = supabase
  .channel(`user-notifications-${user.id}`)
```

**Comparação com padrão já adotado no projeto:** `useOutbidNotifications.ts` usa corretamente `channel(\`outbid-${user.id}\`)`. O `useNotifications.ts` deve seguir o mesmo padrão.

---

### BUG-002 — MÉDIA SEVERIDADE
**Arquivo:** `src/hooks/useWallet.ts`, linhas 36–38
**Descrição:** Erro da query de perfil (`profileResult.error`) é silenciado. Se a tabela `profiles` retornar erro (ex: permissão, coluna ausente), a função retorna `canWithdraw: false` silenciosamente sem propagar o erro ao usuário.

**Código atual:**
```typescript
if (walletResult.error) throw walletResult.error;
if (txResult.error) throw txResult.error;
// profileResult.error NÃO é verificado — silenciado

return {
  wallet: walletResult.data,
  transactions: txResult.data ?? [],
  canWithdraw: profileResult.data?.can_withdraw ?? false,  // false em caso de erro também
};
```

**Impacto:** Usuário com permissão de saque pode ter o botão "Sacar" escondido sem nenhuma mensagem de erro, porque `profileResult.error` nunca é propagado pelo `useQuery`.

**Correção necessária:**
```typescript
if (walletResult.error) throw walletResult.error;
if (txResult.error) throw txResult.error;
if (profileResult.error) throw profileResult.error;
```

---

### BUG-003 — MÉDIA SEVERIDADE
**Arquivo:** `src/hooks/useUsers.ts`
**Story:** STORY-013 (fetch() → supabase.functions.invoke)
**Descrição:** A STORY-013 dizia que `useUsers.ts` seria "refatorado". A única mudança observada foi a adição de `supabase.functions.invoke("create-user", ...)` no método `createUser` (linha 210). O hook continua usando o padrão antigo de `useState` + `useEffect` + `fetchUsers` manual para o estado principal, quando deveria ter sido migrado para `useQuery`.

**Evidências do padrão antigo não migrado:**
```typescript
// useUsers.ts — useState manual ainda presente
const [users, setUsers] = useState<UserProfile[]>([]);
const [loading, setLoading] = useState(true);
const [totalCount, setTotalCount] = useState(0);

const fetchUsers = useCallback(async () => { ... }, [page, pageSize]);

useEffect(() => {
  fetchUsers();
}, [fetchUsers]);
```

**Impacto:** Não há invalidação automática de cache após `createUser`, `updateUser`, `suspendUser` ou `deleteUser`. Cada um desses métodos chama `await fetchUsers()` manualmente — padrão que o Sprint 2 pretendia eliminar. Além disso, erros de listagem não são capturados pelo mecanismo de retry do TanStack Query.

**Nota:** A STORY-013 pode ter sido interpretada como "apenas substituir fetch() nativo pelo invoke()", mas o escopo declarado era "refatorado". Precisa de alinhamento com o PM/Dev sobre o escopo real, ou a task precisa ser reaberta.

---

## Checklist Completo

### STORY-008 — QueryKey Factory

- [x] Chaves são `as const` para inferência de tipo correta — todas as chaves e funções usam `as const`
- [x] Sem colisões de prefixo entre domínios — cada domínio tem prefixo único (`lots`, `wallet`, `categories`, etc.)
- [x] Invalidação hierárquica funciona — `queryKeys.lots.all = ["lots"]` é prefixo válido para `["lots", "list", ...]` e `["lots", "detail", ...]`

**Observação técnica:** `promotions.active` é definido como `["promotions", "active"] as const` (valor direto, não função). Isso é correto, mas diferente dos outros domínios que usam apenas `.all`. A consistência seria melhor com uma função ou mantendo o padrão `.all` + `.active`, mas não é um bug.

### STORY-009 — N+1 fix + TanStack Query

- [x] `useLotDetail` usa `useQuery` — confirmado, linhas 79–84
- [x] Join PostgREST é válido — `lots` → `lot_items` → `assets` e `lots` → `bids` são relações plausíveis pelo schema
- [x] Interface de retorno `LotWithDetails` é compatível com consumidores — mantém `bids: Bid[]` e adiciona `assets: Asset[]`
- [x] Realtime subscription ainda funciona — 3 canais com cleanup correto no return do useEffect (linhas 159–163)
- [ ] **FALHA:** useWallet com Promise.all — erro de `profileResult` silenciado (ver BUG-002)

### STORY-010 — formatCurrency centralizado

- [x] `src/lib/format.ts` existe com 4 funções: `formatCurrency`, `formatDate`, `formatDateOnly`, `formatDateTime`
- [x] Nenhuma definição local de `formatCurrency` encontrada fora de `format.ts` (grep confirmou apenas 1 arquivo com a definição)
- [x] Formato canônico é `pt-BR` / `BRL` — confirmado em `format.ts` linha 11-14
- [x] Arquivos amostrados usam `import { formatCurrency } from "@/lib/format"` — confirmado em `BidPanel.tsx`, `LotCard.tsx`, `Wallet.tsx`, `Purchases.tsx`

**Observação:** `Notifications.tsx` possui uma função local `formatDate` (linhas 40–49) que retorna formato relativo ("Agora", "5m atrás"). Isso é intencional e diferente do `formatDate` canônico (que retorna data absoluta). Não é regressão — são casos de uso distintos.

### STORY-011 — Toast unificado (Sonner)

- [x] `App.tsx` tem `<Sonner />` (importado como `Toaster as Sonner` de `@/components/ui/sonner`)
- [x] `App.tsx` não contém `<Toaster />` do pacote `@/components/ui/toaster`
- [x] Nenhum arquivo de feature importa de `use-toast` — grep confirmou que apenas `src/hooks/use-toast.ts` e `src/components/ui/use-toast.ts` e `src/components/ui/toaster.tsx` referem o módulo antigo (são os próprios arquivos do componente shadcn, não consumidores)
- [x] Arquivos migrados usam `import { toast } from "sonner"` — confirmado em `Login.tsx`, `BidPanel.tsx`, `useAdminLots.ts`, `useAppSettings.ts`, `useWithdraw.ts`
- [x] Padrão de conversão correto: `toast.success(...)`, `toast.error(...)` com objeto `{ description }` — todos os arquivos amostrados seguem o padrão correto
- [x] Nenhum arquivo importa de `use-toast` E de `sonner` simultaneamente

### STORY-012 — Hooks para páginas

- [ ] **FALHA:** `useNotifications` — channel name fixo (ver BUG-001)
- [x] `usePurchases` tem `enabled: !!user?.id` — linha 51
- [x] `useAppSettings` — mutação invalida o cache após sucesso (`invalidateQueries` na linha 53)
- [x] `Purchases.tsx` — sem `useState`/`useEffect` de fetch, usa `usePurchases()` diretamente
- [x] `Notifications.tsx` — sem `useState`/`useEffect` de fetch, usa `useNotifications()` diretamente
- [x] `AdminSettings.tsx` — usa `useAppSettings()`, mantém apenas `useState` para formulário controlado (correto, não é fetch state)

### STORY-013 — fetch() → supabase.functions.invoke

- [x] `useWithdraw.ts` — usa `supabase.functions.invoke("request-withdrawal", ...)` na linha 20, sem `fetch()` nativo
- [x] `useWithdraw.ts` — tratamento de erro correto: verifica `error` retornado pelo invoke (`if (error) throw error`)
- [ ] **PARCIAL:** `useUsers.ts` — `createUser` usa `invoke("create-user")`, mas o hook principal de listagem/paginação não foi migrado para `useQuery` (ver BUG-003)
- [x] `useAnalytics.ts` — fire-and-forget implementado corretamente com `.catch()` na linha 41-43, sem await que bloqueie a UI

---

## Resultado do Lint

`npm run lint` retornou **28 erros e 13 warnings**.

### Erros introduzidos pelo Sprint 2 (novos arquivos/arquivos refatorados)

| Arquivo | Linha | Erro | Classificação |
|---------|-------|------|---------------|
| `src/hooks/useAppSettings.ts` | 58 | `@typescript-eslint/no-explicit-any` em `onError: (error: any)` | Novo do Sprint 2 |
| `src/hooks/useUsers.ts` | 102, 112, 141, 166, 202, 228 | `@typescript-eslint/no-explicit-any` — múltiplas ocorrências em catch blocks | Novo do Sprint 2 |
| `src/hooks/useWithdraw.ts` | 35 | `@typescript-eslint/no-explicit-any` em catch block | Novo do Sprint 2 |
| `src/pages/Notifications.tsx` | 13, 125 | `@typescript-eslint/no-explicit-any` — tipagem `icon: any` e cast `as any` | Novo do Sprint 2 |

### Erros pré-existentes (não introduzidos pelo Sprint 2)

Os seguintes erros existiam antes do Sprint 2 e não são responsabilidade desta sprint:
- `src/components/ui/command.tsx:24` — empty interface
- `src/components/ui/textarea.tsx:5` — empty interface
- `src/hooks/useBuyNow.ts`, `useLots.ts`, `useMarketplaceFilters.ts`, `useRequestReturn.ts`, `useTopUp.ts`, `useTransferBalance.ts`, `useTransfers.ts` — `no-explicit-any`
- `src/hooks/usePromotions.ts:107` — `react-hooks/rules-of-hooks` (useQuery dentro de função regular, não é hook)
- `src/pages/auth/Login.tsx:51`, `Signup.tsx:61` — `no-explicit-any`
- `src/pages/admin/AdminLots.tsx` — múltiplos `no-explicit-any`
- `tailwind.config.ts:90` — `no-require-imports`
- `supabase/functions/stripe-webhook/index.ts:187` — `no-explicit-any`

**Nota sobre `usePromotions.ts`:** O erro `react-hooks/rules-of-hooks` na linha 107 (`promotionDetailsQuery` chama `useQuery` dentro de uma função regular) é **pré-existente** mas é um bug real de regra de hooks que pode causar comportamento imprevisível. Recomendo registrar no backlog mesmo não sendo do Sprint 2.

---

## Issues Adicionais Observados (Não Bloqueadores)

### Observação 1 — BidPanel: formatCurrency como valor de input
**Arquivo:** `src/components/auction/BidPanel.tsx`, linhas 305–336
**Descrição:** Os botões de incremento rápido usam `formatCurrency(minIncrement)` como valor do input via `setBidIncrement(formatCurrency(...))`. A string "R$ 100,00" é depois parseada por `parseCurrencyInput()`. Funciona, mas gera dependência de que o parser seja exatamente inverso ao formatter. Se `Intl.NumberFormat` mudar o formato por locale do OS, o parser pode falhar.
**Severidade:** Baixa — o parser parece robusto, mas é frágil por design.

### Observação 2 — useNotifications: `markAsRead.mutate` sem feedback de erro
**Arquivo:** `src/hooks/useNotifications.ts`, linhas 57–69
**Descrição:** `markAsRead` não possui `onError` handler. Se a mutation falhar, o usuário não recebe feedback.
**Severidade:** Baixa.

### Observação 3 — Wallet: keys de queryKey divergentes
**Arquivo:** `src/hooks/useWallet.ts`, linha 55–57
**Descrição:** O hook usa `queryKeys.wallet.balance(user.id)` como queryKey, mas `queryKeys.wallet` tem também `.transactions`. A query única retorna ambos (wallet + transactions) sob a chave `balance`. Semanticamente correto para TanStack Query (uma query pode retornar múltiplos dados), mas pode confundir futuros devs que tentarem invalidar `queryKeys.wallet.transactions` separadamente — nada aconteceria, pois essa chave nunca é usada.
**Severidade:** Baixa — documentar no hook seria suficiente.

---

## Ações Requeridas

### Bloqueadores para merge (devem ser corrigidos)

1. **BUG-001** — `useNotifications.ts:37`: Renomear canal para `user-notifications-${user.id}`
2. **BUG-002** — `useWallet.ts:38`: Adicionar `if (profileResult.error) throw profileResult.error`
3. **BUG-003** — `useUsers.ts`: Alinhar com PM/Dev o escopo real da STORY-013. Se a intenção era migrar para `useQuery`, a task precisa ser reaberta.

### Melhorias recomendadas (não bloqueadoras)

4. `useAppSettings.ts:58`, `useWithdraw.ts:35`: Substituir `error: any` por `error: Error` nos catch blocks
5. `useUsers.ts`: Os 6 `error: any` em catch blocks devem ser tipados como `Error`
6. `Notifications.tsx:13`: Tipar `icon` no `typeConfig` como `React.ComponentType<{ className?: string }>` ao invés de `any`
7. Registrar no backlog o bug pré-existente de `usePromotions.ts:107` (rules-of-hooks)

---

## Conclusão

O Sprint 2 alcançou seus objetivos principais de padronização. A QueryKey factory está bem estruturada, o formatCurrency foi 100% centralizado, e a migração para Sonner foi completa e correta. O refactoring do `useLotDetail` é particularmente bem executado — join único, realtime preservado, interface pública compatível.

Os 3 bugs identificados são corrigíveis rapidamente (BUG-001 e BUG-002 são one-liners). BUG-003 requer decisão de escopo. Após as correções, o Sprint 2 pode ser aprovado para merge.

---

*Quinn — QA Engineer | OxyBroker Sprint 2 Review*
