# QA Review — Sprint 3
**Reviewer:** Quinn (QA Engineer)
**Date:** 2026-02-26
**Branch:** `feat/sprint3-typescript-tests`
**Project:** OxyBroker

---

## Veredicto Final

**REQUEST CHANGES**

Os testes passam e o type check está limpo, mas o ESLint reporta **16 erros** que devem ser resolvidos antes do merge. Dois desses erros estão em arquivos cobertos por este sprint (`useTopUp.ts`). Os demais são dívida técnica preexistente que precisa ser endereçada ou documentada. Detalhes abaixo.

---

## 1. TypeScript — STORY-014

| Item | Status | Detalhe |
|------|--------|---------|
| `strict: true` habilitado | PASS | `tsconfig.app.json` linha 19 |
| `noImplicitAny: true` habilitado | PASS | `tsconfig.app.json` linha 22 |
| `noFallthroughCasesInSwitch: true` habilitado | PASS | `tsconfig.app.json` linha 23 |
| `npx tsc --noEmit` — zero erros | PASS | Saída limpa, sem erros |

**Observacao positiva:** `noUnusedLocals` e `noUnusedParameters` foram mantidos como `false`, o que é pragmático para um projeto em andamento. Aceitavel.

---

## 2. Testes Unitarios Financeiros — STORY-015

**Resultado:** 18/18 testes PASSANDO

### useWallet (6 testes)

| Teste | Status |
|-------|--------|
| retorna wallet e transacoes do usuario autenticado | PASS |
| retorna loading=true durante o fetch | PASS |
| propaga erro quando walletResult.error existe | PASS |
| propaga erro quando profileResult.error existe (BUG corrigido no Sprint 2) | PASS |
| retorna canWithdraw=false quando profile.can_withdraw=false | PASS |
| nao executa query quando usuario nao esta autenticado (enabled: false) | PASS |

### useWithdraw (5 testes)

| Teste | Status | Observacao |
|-------|--------|------------|
| chama supabase.functions.invoke com os parametros corretos | PASS | act() warning (ver secao de issues) |
| retorna true em caso de sucesso | PASS | act() warning |
| retorna false e nao lanca excecao em caso de erro | PASS | Usa waitFor corretamente |
| mostra toast de sucesso apos saque bem-sucedido | PASS | act() warning |
| mostra toast de erro apos falha | PASS | act() warning |

### useTopUp (7 testes)

| Teste | Status | Observacao |
|-------|--------|------------|
| chama supabase.functions.invoke com o amount correto | PASS | act() warning |
| abre nova aba com a URL de checkout retornada | PASS | act() warning |
| exibe toast de erro quando amount < 10 | PASS | |
| exibe toast de erro quando amount > 10000 | PASS | |
| exibe toast de erro quando supabase retorna error | PASS | Console.error exposto (ver issues) |
| exibe toast de erro quando data.url nao e retornada | PASS | Console.error exposto (ver issues) |
| loading e true durante o invoke e false apos resolucao | PASS | Uso correto de act() duplo |

**Checklist STORY-015:**
- [x] Todos os testes do useWallet passam
- [x] Todos os testes do useWithdraw passam
- [x] Todos os testes do useTopUp passam
- [x] Mocks sao limpos entre testes (`vi.clearAllMocks()` em todos os `beforeEach`)
- [x] Testes verificam comportamento observavel (retornos, chamadas de funcao, estado do hook)
- [x] O teste que cobre o bug do Sprint 2 (`profileResult.error` silenciado) esta presente na linha 158

---

## 3. Testes de Autenticacao — STORY-016

**Resultado:** 10/11 testes estruturados passam. Contagem real: 10 testes no arquivo (nao 11 como documentado).

### ProtectedRoute (3 testes)

| Teste | Status |
|-------|--------|
| exibe loading spinner enquanto auth carrega | PASS |
| redireciona para /auth/login quando usuario nao autenticado | PASS |
| renderiza children quando usuario autenticado | PASS |

### AdminRoute (4 testes)

| Teste | Status |
|-------|--------|
| exibe loading spinner enquanto auth carrega | PASS |
| redireciona para /auth/login quando usuario nao autenticado | PASS |
| redireciona para /marketplace quando usuario autenticado mas nao e admin | PASS |
| renderiza children quando usuario e admin | PASS |

### AuthContext (3 testes)

| Teste | Status |
|-------|--------|
| inicia com loading=true e user=null | PASS |
| atualiza user apos getSession retornar sessao valida | PASS |
| busca profile do usuario apos autenticacao | PASS |

**Checklist STORY-016:**
- [x] ProtectedRoute: 3 cenarios cobertos (loading, sem auth, com auth)
- [x] AdminRoute: 4 cenarios cobertos (loading, sem auth, nao-admin, admin)
- [x] AuthContext: estado inicial e transicoes cobertos
- [x] Cleanup correto das subscriptions mocadas (`unsubscribe: vi.fn()` configurado em cada helper)

**Discrepancia de contagem:** O PR menciona 11 testes de integracao, mas o arquivo contem 10 (`it()` contados: 3 ProtectedRoute + 4 AdminRoute + 3 AuthContext = 10). Nao e um bug funcional, mas a documentacao do sprint deve ser corrigida.

---

## 4. Qualidade Geral dos Testes

| Criterio | Status |
|----------|--------|
| Sem testes que apenas testam mocks | PASS |
| Sem `it.only` ou `describe.only` esquecidos | PASS |
| Assertions especificas (nao apenas toBeTruthy) | PASS |
| `vi.hoisted()` usado corretamente no auth-flow.test.tsx | PASS |

---

## 5. ESLint — BLOCKER

**16 erros, 13 warnings**

O lint falha com exit code 1. Isso bloqueia o merge conforme convenção CI do projeto.

### Erros em arquivos do Sprint 3

| Arquivo | Linha | Regra | Descricao |
|---------|-------|-------|-----------|
| `src/hooks/useTopUp.ts` | 45 | `@typescript-eslint/no-explicit-any` | Tipo `any` explicito no catch |

Este erro esta diretamente no hook coberto pelos testes do Sprint 3 e deve ser corrigido antes do merge.

### Erros em dívida técnica preexistente (nao do sprint, mas bloqueantes)

| Arquivo | Linha | Regra | Descricao |
|---------|-------|-------|-----------|
| `src/hooks/useBuyNow.ts` | 71 | `no-explicit-any` | Tipo `any` no catch |
| `src/hooks/useLots.ts` | 40 | `no-explicit-any` | Tipo `any` no catch |
| `src/hooks/useMarketplaceFilters.ts` | 225 | `no-explicit-any` | Tipo `any` no catch |
| `src/hooks/usePromotions.ts` | 107 | `react-hooks/rules-of-hooks` | Hook `useQuery` em funcao que nao e componente nem hook |
| `src/hooks/useRequestReturn.ts` | 45 | `no-explicit-any` | Tipo `any` no catch |
| `src/hooks/useTransferBalance.ts` | 49 | `no-explicit-any` | Tipo `any` no catch |
| `src/hooks/useTransfers.ts` | 62 | `no-explicit-any` | Tipo `any` no catch |
| `src/pages/admin/AdminLots.tsx` | 229, 234, 581 | `no-explicit-any` | Tipos `any` multiplos |
| `src/components/ui/command.tsx` | 24 | `no-empty-object-type` | Interface vazia equivalente ao supertipo |
| `src/components/ui/textarea.tsx` | 5 | `no-empty-object-type` | Interface vazia equivalente ao supertipo |
| `supabase/functions/stripe-webhook/index.ts` | 187 | `no-explicit-any` | Tipo `any` |
| `tailwind.config.ts` | 90 | `no-require-imports` | `require()` style import proibido |

### Warnings (nao bloqueantes, mas a monitorar)

- 9 ocorrencias de `react-refresh/only-export-components` em arquivos de UI shadcn (gerados automaticamente — considerar desabilitar a regra para `src/components/ui/`)
- 3 ocorrencias de `react-hooks/exhaustive-deps` em `CountdownTimer.tsx`, `useLots.ts`, `useTransfers.ts`

---

## 6. Warnings de act() nos Testes de useWithdraw

**Nao sao falhas, mas sao ruido no CI.**

Os testes `chama supabase.functions.invoke`, `retorna true em caso de sucesso`, `mostra toast de sucesso` e `mostra toast de erro` do `useWithdraw` produzem warnings de `act()` porque chamam `result.current.requestWithdrawal()` diretamente sem envolver em `act()` ou `waitFor()`.

O teste `retorna false e nao lanca excecao` ja usa `waitFor()` corretamente e nao produz warning.

O padrao correto seria envolver as chamadas em `act(async () => { ... })`, como feito no teste de `loading` do `useTopUp`.

**Severidade:** Baixa — os testes passam e as assertions estao corretas. Mas o ruido no stderr pode mascarar erros reais futuros.

---

## 7. Console.error Exposto em Testes de useTopUp

Os testes `exibe toast de erro quando supabase retorna error` e `exibe toast de erro quando data.url nao e retornada` imprimem erros no console:

```
Error creating checkout: Error: payment service unavailable
Error creating checkout: Error: URL de checkout não retornada
```

Isso indica que `useTopUp.ts` usa `console.error` internamente no caminho de erro. O comportamento e correto (o hook trata o erro e chama toast), mas o console poluido no CI e um sinal de que o hook nao silencia o log em ambiente de teste.

**Recomendacao:** Mockar `console.error` no `beforeEach` do describe `useTopUp` ou remover o `console.error` do hook de producao caso o toast ja informe o usuario.

---

## 8. React Router Future Flag Warnings

Os testes de auth produzem warnings sobre flags v7 do React Router:

```
React Router will begin wrapping state updates in React.startTransition in v7.
```

Nao afetam a corretude dos testes. Sao eliminados adicionando `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` ao `MemoryRouter` nos helpers de teste.

---

## Resumo Executivo

| Categoria | Status | Detalhes |
|-----------|--------|---------|
| TypeScript strict (STORY-014) | PASS | tsconfig correto, zero erros de compilacao |
| Testes financeiros (STORY-015) | PASS | 18/18 passando |
| Testes de auth (STORY-016) | PASS | 10/10 passando |
| ESLint | FAIL | 16 erros, incluindo 1 em arquivo do sprint |
| act() warnings | INFO | Nao bloqueante, mas deve ser corrigido |
| Console.error exposto | INFO | Ruido no CI, nao bloqueante |
| Contagem de testes documentada | INFO | 10 testes, nao 11 como documentado |

---

## Acoes Requeridas Antes do Merge

### Bloqueantes

1. **`src/hooks/useTopUp.ts:45`** — Substituir `any` por `unknown` no bloco catch e usar type narrowing. Exemplo:
   ```typescript
   } catch (error: unknown) {
     const message = error instanceof Error ? error.message : 'Erro desconhecido';
     // ...
   }
   ```

2. **Lint limpo** — Os 15 erros preexistentes devem ser corrigidos nesta PR ou deve ser criada uma story de dívida técnica dedicada com deadline definido, e o ESLint configurado com `// eslint-disable-next-line` documentado para cada caso aceito conscientemente.

### Recomendados (nao bloqueantes)

3. **Corrigir contagem na documentacao do sprint** — 10 testes de integracao, nao 11.

4. **Envolver chamadas de useWithdraw em `act()`** — Eliminar warnings de stderr nos 4 testes afetados.

5. **Mockar `console.error` no describe useTopUp** — Reduzir ruido no CI.

6. **Adicionar future flags ao MemoryRouter** — Eliminar warnings do React Router v7.

---

*Gerado por Quinn — QA Engineer | OxyBroker Sprint 3*
