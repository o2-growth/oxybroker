# OxyBroker — Brownfield Assessment
*Gerado por Atlas (Business Analyst) em 2026-02-26*

---

## 1. Visao Geral do Sistema

**OxyBroker** (ou "Oxy Broker") e uma plataforma de leiloes de ativos comerciais B2B, operada pela O2 Inc. O dominio central e a compra e venda de **ativos de pipeline de vendas** — leads qualificados, MQLs, reunioes agendadas, clientes ativos — agrupados em **lotes** que vao a leilao em tempo real.

### Modelo de Negocio
O sistema opera como um marketplace de leiloes fechado (acesso por autenticacao), com hierarquia de papeis:
- **Admin**: gestao total da plataforma
- **Master Franquia**: franqueado master com privilegios elevados
- **Franquia**: usuario comprador padrao (participa de leiloes)
- **Oxy Hacker**: acesso especial de auditoria

O fluxo economico central e:
1. Admin cria **ativos** (leads, MQLs, clientes, etc.)
2. Admin agrupa ativos em **lotes**
3. Admin publica lotes no marketplace (status: `live`)
4. Franquias dao **lances** com saldo da carteira
5. Ao encerrar, o vencedor compra o lote via **Buy Now** ou via vitoria no leilao
6. Sistema gerencia **reembolsos**, **devolucoes** e **transferencias** de saldo

### Dominio de Dados (tabelas identificadas via types.ts)
- `lots` + `lot_items` + `assets` — core do marketplace
- `bids` — historico de lances
- `wallets` + `wallet_transactions` — saldo e extrato
- `purchases` + `returns` — pos-compra
- `profiles` + `user_roles` + `franchise_categories` — usuarios
- `notifications` — alertas em tempo real
- `transfers` — transferencias P2P
- `promotions` + `promotion_schedules` + `promotion_eligibility` + `promotion_usage` — sistema de descontos
- `analytics_events` — telemetria de uso
- `app_settings` — configuracoes globais

---

## 2. Stack & Dependencias

### Frontend (aplicacao principal)
| Tecnologia | Versao | Observacao |
|------------|--------|------------|
| React | 18.3.1 | Atual — nao e React 19 |
| TypeScript | 5.8.3 | Atual |
| Vite | 5.4.19 | Build tool |
| React Router DOM | 6.30.1 | SPA routing |
| TanStack Query | 5.83.0 | Server state — uso **hibrido** (misturado com useState+useEffect manual) |
| React Hook Form | 7.61.1 | Apenas nas paginas de auth (Login/Signup) |
| Zod | 3.25.76 | Validacao de schema — apenas nas paginas de auth |
| shadcn/ui | componentes | New York style + Radix UI primitives |
| Tailwind CSS | 3.4.17 | v3 (nao v4) |
| Supabase JS | 2.93.2 | BaaS: auth, banco, realtime, edge functions |
| date-fns | 3.6.0 | Formatacao de datas |
| lucide-react | 0.462.0 | Iconografia |
| Recharts | 2.15.4 | Graficos no analytics |
| Sonner | 1.7.4 | Toast alternativo (duplica com shadcn/toast) |
| next-themes | 0.3.0 | Instalado mas **nao usado** — ThemeContext e proprio |
| Vitest | 3.2.4 | Testes (estrutura presente, sem testes reais) |

### Backend (Supabase)
| Componente | Uso |
|------------|-----|
| PostgreSQL | Banco de dados principal |
| Supabase Auth | Autenticacao JWT |
| Supabase Realtime | Subscricoes postgres_changes + broadcast |
| Edge Functions | `place-bid`, `create-checkout`, `admin-adjust-balance`, `create-user`, `create-transfer`, `request-withdrawal`, `log-event`, `buy_now_atomic` (RPC) |
| Stripe | Pagamentos para recarga de carteira (`create-checkout`) |

### Ferramentas de Desenvolvimento
| Ferramenta | Observacao |
|------------|------------|
| ESLint 9.32 | Configurado |
| lovable-tagger 1.1.13 | Artefato gerado pela plataforma Lovable |
| vitest + @testing-library | Configurado mas sem testes uteis |

---

## 3. Arquitetura Atual

### Organizacao de Diretórios
```
src/
├── App.tsx                     # Root: providers + roteamento plano
├── main.tsx                    # Entry point
├── index.css                   # Design system: variaveis CSS + utility classes
├── pages/
│   ├── Marketplace.tsx         # Listagem de lotes
│   ├── LotDetail.tsx           # Pagina de lance
│   ├── MyAuctions.tsx          # Leiloes do usuario
│   ├── Wallet.tsx              # Carteira + extrato
│   ├── Transfers.tsx           # Transferencias P2P
│   ├── Purchases.tsx           # Compras realizadas
│   ├── Notifications.tsx       # Notificacoes
│   ├── auth/Login.tsx          # Login
│   ├── auth/Signup.tsx         # Cadastro
│   └── admin/                  # 7 paginas admin
├── components/
│   ├── layout/                 # AppShell, Sidebar, TopBar, MobileDrawer
│   ├── auction/                # BidPanel, BuyNowButton, CountdownTimer, LotCard, AuctionStatusBadge
│   ├── marketplace/            # LotListItem, MarketplaceFilters, MyAuctionsSummary, ViewToggle
│   ├── wallet/                 # TopUpModal, WithdrawModal
│   ├── admin/                  # AdminAdjustBalanceModal, PromotionFormModal
│   ├── analytics/              # 6 componentes de analytics
│   ├── providers/              # OutbidNotificationProvider
│   └── ui/                     # ~35 componentes shadcn/ui
├── hooks/                      # 25 custom hooks
├── contexts/
│   └── ThemeContext.tsx         # Tema dark/light via localStorage
└── integrations/supabase/
    ├── client.ts               # createClient
    └── types.ts                # Tipos gerados do schema
```

### Padroes Arquiteturais Identificados

**1. Hibrido de gerenciamento de estado:**
A maior inconsistencia arquitetural e o uso paralelo de dois padroes incompativeis:
- **TanStack Query**: usado em `useMyAuctions`, `useAdminLots`, `useAssets`, `useCategories`, `usePromotions`, `useActivePromotion`, `useAnalyticsData` (todos os hooks de analytics) — com cache, invalidation e mutations bem estruturados
- **useState + useEffect manual**: usado em `useLotDetail`, `useMarketplaceFilters`, `useWallet`, `useUsers`, `useLots`, `useTransfers` — sem cache, sem deduplicacao de requests

**2. Acesso ao Supabase direto em paginas:**
`Purchases.tsx`, `Notifications.tsx`, `AdminSettings.tsx` fazem chamadas diretas ao `supabase` sem hooks customizados, criando dificuldade de manutencao e reutilizacao.

**3. Layout via AppShell:**
Todas as paginas autenticadas usam `<AppShell>` que inclui `Sidebar` + `TopBar` — padrao consistente e bem executado.

**4. Providers Aninhados:**
`QueryClientProvider` > `ThemeProvider` > `TooltipProvider` > `BrowserRouter` > `OutbidNotificationProvider` — ordem logica, mas `TooltipProvider` e duplicado (tambem usado dentro de `AppShell`).

**5. Realtime via Supabase Channels:**
Sistema de realtime robusto com tres camadas:
- Broadcast channels (bid_placed, outbid) — eventos de alta frequencia
- postgres_changes (bids, lots, notifications) — fallback e sincronizacao
- Subscricoes gerenciadas com cleanup em `useEffect` return

---

## 4. Inventario de Features

### Features de Usuario Final (Franquia)
| Feature | Status | Localizacao |
|---------|--------|-------------|
| Autenticacao email/senha | Completo | `pages/auth/Login`, `pages/auth/Signup` |
| Visualizacao do marketplace (lista/grid) | Completo | `pages/Marketplace` |
| Filtros de marketplace (tipo ativo, setor, estado) | Completo | `hooks/useMarketplaceFilters` |
| Detalhes do lote com historico de lances | Completo | `pages/LotDetail` |
| Dar lance em leilao | Completo | `components/auction/BidPanel` |
| Buy Now (compra imediata) | Completo | `components/auction/BuyNowButton` |
| Countdown timer com anti-sniping | Completo | `components/auction/CountdownTimer` |
| Status do meu lance (ganhando/perdendo) | Completo | `hooks/useAuctionStatus`, `components/auction/AuctionStatusBadge` |
| Meus leiloes (acompanhamento) | Completo | `pages/MyAuctions` |
| Notificacao em tempo real de outbid | Completo | `hooks/useOutbidNotifications` |
| Carteira (saldo + extrato) | Completo | `pages/Wallet` |
| Recarga via Stripe | Completo | `hooks/useTopUp`, Edge Function `create-checkout` |
| Saque de saldo | Completo (restrito) | `hooks/useWithdraw`, `can_withdraw` flag |
| Transferencia P2P de saldo | Completo | `pages/Transfers`, Edge Function `create-transfer` |
| Minhas compras | Completo | `pages/Purchases` |
| Solicitar devolucao | Completo | `hooks/useRequestReturn` |
| Notificacoes | Completo | `pages/Notifications` |
| Promocoes em lances/compras | Completo | `hooks/useActivePromotion` |
| Tema dark/light | Completo | `contexts/ThemeContext` |
| Resumo de leiloes na sidebar | Completo | `components/marketplace/MyAuctionsSummary` |

### Features de Admin
| Feature | Status | Localizacao |
|---------|--------|-------------|
| Gestao de usuarios (CRUD + suspensao) | Completo | `pages/admin/AdminUsers` |
| Criacao de usuarios via Edge Function | Completo | Edge Function `create-user` |
| Ajuste de saldo de usuario | Completo | `components/admin/AdminAdjustBalanceModal` |
| Gestao de categorias de franquia | Completo | `pages/admin/AdminCategories` |
| Gestao de ativos (CRUD + status) | Completo | `pages/admin/AdminAssets` |
| Gestao de lotes (CRUD + publish/cancel) | Completo | `pages/admin/AdminLots` |
| Gerenciar ativos de um lote | Completo | Modal dentro de `AdminLots` |
| Gestao de promocoes | Completo | `pages/admin/AdminPromotions` |
| Promocoes com agendamento e elegibilidade | Completo | `hooks/usePromotions` |
| Analytics (overview, telas, funcoes, usuarios, funil, auditoria) | Completo | `pages/admin/AdminAnalytics` + 6 componentes |
| Configuracoes do sistema (janela de retorno, extensao de lances, scoring weights) | Completo | `pages/admin/AdminSettings` |
| Protecao de rotas admin (role guard) | Completo | `hooks/useRoleGuard` |

---

## 5. Tech Debt Identificado

### TD-01 [ALTO] — Gerenciamento de estado hibrido e inconsistente
**Impacto:** Alto | **Esforco de resolucao:** Alto

Metade dos hooks usa TanStack Query (`useAdminLots`, `useMyAuctions`, `usePromotions`, `useAnalyticsData`) e a outra metade usa `useState + useEffect` manual (`useLotDetail`, `useMarketplaceFilters`, `useWallet`, `useUsers`, `useTransfers`). Isso gera:
- Sem deduplicacao de requests duplicados
- Cache inconsistente (alguns dados ficam obsoletos enquanto outros sao automaticamente invalidados)
- Padrao de refetch manual (`refetch()`) vs `queryClient.invalidateQueries()`
- Dificuldade de onboarding para novos devs

```typescript
// Exemplo do problema — useWallet usa useState manual:
const [wallet, setWallet] = useState<Wallet | null>(null);
// enquanto useMyAuctions usa TanStack Query:
return useQuery({ queryKey: ["my-auctions", user?.id], queryFn: ... });
```

### TD-02 [ALTO] — Acesso direto ao Supabase em paginas (sem hook)
**Impacto:** Alto | **Esforco de resolucao:** Medio

Tres paginas fazem fetch diretamente dentro do componente, quebrando o principio de separacao de responsabilidades:
- `Purchases.tsx` — linhas 41-72: fetch de `purchases` + `returns` com `useState/useEffect`
- `Notifications.tsx` — linhas 34-51: fetch de `notifications` + subscricao realtime
- `AdminSettings.tsx` — linhas 26-48: fetch de `app_settings`

Consequencia: logica duplicada, impossibilidade de reutilizacao, dificuldade de teste.

### TD-03 [ALTO] — useAuth instanciado multiplas vezes sem contexto compartilhado
**Impacto:** Alto | **Esforco de resolucao:** Alto

`useAuth` e um hook puro (`useState + useEffect`) instanciado em cada componente que o chama. Isso significa que `Sidebar`, `TopBar`, `BidPanel`, `LotDetail`, `Wallet`, etc. — cada um faz sua propria subscricao ao `supabase.auth.onAuthStateChange` e sua propria query de `profiles`. Em uma sessao tipica, existem 8-12 subscricoes de auth simultaneas.

```typescript
// useAuth.ts — linha 24-50: CADA chamada cria nova subscricao
const { data: { subscription } } = supabase.auth.onAuthStateChange(...)
// Multiplica por ~8 componentes simultaneos
```

**Solucao correta:** Converter para `AuthContext` com Provider unico.

### TD-04 [MEDIO] — useWallet chamado multiplas vezes sem compartilhamento de estado
**Impacto:** Medio | **Esforco de resolucao:** Medio

`useWallet` e chamado em: `TopBar.tsx` (via `BalanceBadge`), `Wallet.tsx`, `BidPanel.tsx`, `LotDetail.tsx`, `Transfers.tsx`. Cada instancia faz 3 queries separadas (wallets, wallet_transactions, profiles.can_withdraw). Em LotDetail, isso soma requests desnecessarios ao banco.

### TD-05 [MEDIO] — Filtros do AdminUsers sao client-side apesar de dados paginados
**Impacto:** Medio | **Esforco de resolucao:** Medio

```typescript
// AdminUsers.tsx — linha 143-159
const filteredUsers = useMemo(() => {
  return users.filter((u) => { /* filtra apenas a pagina atual */ });
}, [users, searchTerm, roleFilter, statusFilter]);
```

`useUsers` retorna dados paginados (10 por pagina), mas os filtros de busca, role e status sao aplicados client-side sobre essa pagina. A busca por nome/email nao funciona em usuarios fora da pagina atual.

### TD-06 [MEDIO] — setTimeout(0) como workaround para race condition na auth
**Impacto:** Medio | **Esforco de resolucao:** Medio

```typescript
// useAuth.ts — linha 33-38
setTimeout(async () => {
  const { data } = await supabase.from("profiles").select("*")...
  if (data) setProfile(data as Profile);
}, 0);
```

`setTimeout(0)` e um anti-pattern para resolver race conditions. Indica que a logica de hydratacao do perfil nao esta adequadamente sequenciada. Pode causar flash de estado errado ou renders desnecessarios.

### TD-07 [MEDIO] — `useLots.ts` e hook nao utilizado (dead code)
**Impacto:** Baixo | **Esforco de resolucao:** Baixo

`useLots.ts` define um hook generico de listagem de lotes, mas nenhuma pagina o usa. O marketplace usa `useMarketplaceFilters`, o admin usa `useAdminLots`. O arquivo e dead code que pode confundir novos desenvolvedores.

### TD-08 [MEDIO] — `next-themes` instalado mas nao usado
**Impacto:** Baixo | **Esforco de resolucao:** Baixo

`next-themes` esta listado como dependencia (`package.json`) e nunca importado. O sistema de tema e implementado via `ThemeContext` proprio. Bundle size desnecessaria.

### TD-09 [BAIXO] — `useAuctionStatus` tem logica de comparacao fragil para determinar lideranca
**Impacto:** Medio | **Esforco de resolucao:** Medio

```typescript
// useAuctionStatus.ts — linha 52-54
const isWinning =
  Number(myLastBid.amount) === Number(highestBid.amount) &&
  myLastBid.created_at === highestBid.created_at; // string comparison de timestamps
```

Comparar strings ISO de timestamps para determinar se dois bids sao o mesmo e fragil. Se houver arredondamento ou diferenca de microsegundos, o status pode ser incorretamente exibido como "perdendo" para o lider.

### TD-10 [BAIXO] — `lovable-tagger` em devDependencies
**Impacto:** Baixo | **Esforco de resolucao:** Baixo

Artefato da plataforma Lovable (gerador de codigo AI). Deve ser removido se o projeto for mantido em repositorio proprio, pois nao agrega valor ao processo de build.

---

## 6. Inconsistencias de Codigo

### IC-01 — Dois sistemas de toast coexistindo
O projeto possui **dois sistemas de notificacao toast distintos** ativos simultaneamente:
- `@/hooks/use-toast` (Radix-based, `useToast()`) — usado na maioria dos hooks e paginas
- `sonner` (`<Sonner />` em App.tsx, `toast` de `@/hooks/use-toast` — importado como `toast` direto em `useTopUp.ts`)

```typescript
// useTopUp.ts — importa toast function do hook
import { toast } from "@/hooks/use-toast";
// mas App.tsx renderiza <Sonner /> do pacote sonner
import { Toaster as Sonner } from "@/components/ui/sonner";
```

Resultado: dois "toasters" diferentes no DOM, comportamentos visuais distintos.

### IC-02 — Duplicacao massiva de `formatCurrency` e `formatDate`
A funcao `formatCurrency` com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` esta duplicada em pelo menos **9 arquivos diferentes**:
`LotDetail.tsx`, `Wallet.tsx`, `Transfers.tsx`, `Purchases.tsx`, `AdminLots.tsx`, `AdminPromotions.tsx`, `BidPanel.tsx`, `TopBar.tsx`, `MyAuctions.tsx`.

Idem para `formatDate` com `toLocaleString("pt-BR")`.

### IC-03 — `useAnalytics` instanciado em todas as paginas sem necessidade
`useAnalytics` e chamado em todas as paginas para tracking de eventos, mas o tracking de `page_view` e feito automaticamente via `useLocation` dentro do proprio hook. Paginas que apenas usam `trackAction` poderiam receber o hook diretamente sem precisar instancia-lo explicitamente.

### IC-04 — Inconsistencia no sistema de badge: classes customizadas vs variantes shadcn
Algumas badges usam classes CSS customizadas do design system (`oxy-badge-danger`, `oxy-badge-success`, `oxy-badge-warning`, `oxy-badge-info`), outras usam variantes do shadcn (`variant="destructive"`, `variant="default"`), e outras usam classes Tailwind inline arbitrarias:

```typescript
// MyAuctions.tsx
className="bg-green-500/10 text-green-600 border-green-500/30"
// vs AdminUsers.tsx
className={roleColors[userProfile.role]} // "bg-destructive/10 text-destructive..."
// vs LotDetail.tsx
className="oxy-badge-danger"
```

### IC-05 — Mistura de componentes HTML nativos e shadcn para tabelas
`AdminLots.tsx` e `AdminAssets.tsx` usam `<table>` nativo com classe `.oxy-table`, enquanto `AdminUsers.tsx` usa o componente `<Table>` do shadcn/ui. Sem consistencia.

### IC-06 — `useRoleGuard` chamado com `"admin"` (string) e com `["admin"]` (array) sem padrao
```typescript
// AdminPromotions.tsx
useRoleGuard(["admin"]); // array com um elemento
// AdminLots.tsx
useRoleGuard("admin"); // string direta
// AdminUsers.tsx
useRoleGuard("admin"); // string direta
```

### IC-07 — Emojis hardcoded no codigo de producao
```typescript
// LotDetail.tsx — linha 271
<span className="text-[hsl(var(--oxy-success))]">👑</span>
// BidPanel.tsx — linha 126
title: result.data?.was_extended ? "🚀 Lance aceito + tempo estendido!" : "✅ Lance aceito!",
// useOutbidNotifications.ts — linha 33
title: "🔔 Você foi ultrapassado!",
```
Emojis em codigo (nao em assets) criam problemas de acessibilidade e inconsistencia visual entre plataformas.

### IC-08 — `promotionDetailsQuery` definida como funcao dentro do hook (viola Rules of Hooks)
```typescript
// usePromotions.ts — linha 108
const promotionDetailsQuery = (promotionId: string) => useQuery({...});
```
`useQuery` chamado dentro de uma funcao regular (nao um hook) e uma violacao das Rules of Hooks. Embora possa funcionar em alguns cenarios, e formalmente incorreto e pode causar bugs em modo strict.

### IC-09 — Dados de usuario duplicados: `profile.email` vs `user.email`
`useAuth` carrega `user` (do Supabase Auth) que ja possui `user.email`, e tambem carrega `profile` que tem `profile.email`. Ambos sao usados em diferentes lugares, criando confusao sobre qual e a fonte de verdade.

### IC-10 — `Index.tsx` existe mas e vazia/nao-usada
`src/pages/Index.tsx` e listada na estrutura de arquivos mas o App.tsx faz redirect direto de `/` para `/marketplace` sem usar o componente Index.

---

## 7. Gaps de Seguranca (Frontend)

### SEC-01 [CRITICO] — Rotas admin sem protecao no roteador
Todas as rotas `/admin/*` em `App.tsx` nao possuem wrapper de protecao. O `useRoleGuard` e chamado **dentro** de cada pagina admin, causando:
1. Flash de conteudo admin antes do redirect (Loading state visivel)
2. Se o componente renderizar algo antes do guard verificar, informacoes podem ser expostas brevemente

```typescript
// App.tsx — nenhuma protecao na rota:
<Route path="/admin/settings" element={<AdminSettings />} />
// A protecao so acontece DENTRO do componente, apos render inicial
```

**Risco real:** Em ambientes com RLS (Row Level Security) no Supabase, o dado em si e protegido no banco, mas a UI pode renderizar skeletons ou states intermediarios de paginas admin para usuarios nao-autorizados.

### SEC-02 [ALTO] — Chave de API exposta no codigo frontend
```typescript
// useAnalytics.ts — linha 36
apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
```
A variavel `VITE_SUPABASE_PUBLISHABLE_KEY` e intencionalmente publica (anon key), mas o nome "PUBLISHABLE_KEY" e incomum e pode induzir confusao. O uso direto em fetch manual (em vez de usar o cliente Supabase configurado) e desnecessario e cria dois caminhos de autenticacao.

### SEC-03 [ALTO] — Ausencia de protecao de rotas autenticadas no roteador
Paginas como `Wallet`, `MyAuctions`, `Transfers`, `Purchases` nao possuem protecao no roteador. A autenticacao e verificada via `useAuth` internamente, mas usuarios nao autenticados podem navegar para essas rotas e ver estados de loading antes de serem redirecionados.

### SEC-04 [MEDIO] — `deleteUser` nao remove do `auth.users` (Supabase)
```typescript
// useUsers.ts — linha 199-207
// Note: We cannot delete from auth.users via client SDK
// The profile will remain but user cannot login
```
Ao "excluir" um usuario, apenas o perfil e removido das tabelas publicas. O registro em `auth.users` permanece. O usuario pode potencialmente criar novo perfil com o mesmo email ou o registro fantasma permanece no sistema de auth, criando inconsistencias.

### SEC-05 [MEDIO] — Validacao de formulario apenas no Login/Signup (Zod)
Apenas as paginas de auth usam `react-hook-form + zod` para validacao. Todos os outros formularios (criacao de lote, ativo, categoria, transferencia, saque) dependem apenas de validacoes manuais ad-hoc no handler, sem esquema formal.

### SEC-06 [BAIXO] — `localStorage` como storage de sessao Supabase
```typescript
// client.ts
auth: { storage: localStorage, persistSession: true }
```
`localStorage` e acessivel via XSS. Em um aplicativo financeiro (que movimenta dinheiro real via Stripe), `sessionStorage` ou `httpOnly cookies` seriam mais seguros para tokens de sessao.

### SEC-07 [BAIXO] — Logica de pagamento no cliente sem confirmacao server-side
A recarga via Stripe e iniciada no frontend (`useTopUp.ts`) e confirmada via query param (`?topup=success`) ao retornar. Embora o webhook do Stripe deveria processar o credito no servidor, o frontend usa `setTimeout(() => refetch(), 2000)` como fallback, sugerindo que o fluxo pode nao ser totalmente confiavel.

---

## 8. Gaps de UX

### UX-01 — Nenhuma paginacao ou scroll infinito no marketplace
O marketplace carrega **todos os lotes ativos** de uma vez:
```typescript
// useMarketplaceFilters.ts — sem limit/offset
const query = supabase.from("lots").select("*").eq("status", "live")
```
Com volume alto de lotes, a pagina ficara lenta e o usuario precisara fazer scroll extensivo.

### UX-02 — Ausencia de busca textual no marketplace
`MarketplaceFilters` permite filtrar por tipo de ativo, setor e estado, mas **nao possui campo de busca por texto** (titulo do lote). O componente `useMarketplaceFilters` nao suporta busca por titulo.

### UX-03 — Sidebar ausente em mobile (acesso via drawer unico)
Em mobile, a navegacao e feita pelo `MobileDrawer` acionado pelo botao hamburguer. Para um usuario mobile ativo que muda frequentemente de secao, o fluxo e: tap hamburger > selecionar > fechar drawer. Nao ha bottom navigation bar que seria mais natural em mobile.

### UX-04 — Estado de "vitoria" ou "derrota" em leiloes encerrados nao e claro
Em `MyAuctions.tsx`, lotes encerrados mostram o badge "ganhando"/"perdendo" como se o leilao ainda estivesse ativo. Apos encerrar, o status deveria ser "Vencedor"/"Perdedor" ou "Comprado"/"Nao adquirido".

### UX-05 — Ausencia de confirmacao visual apos dar lance
O `BidPanel` mostra um toast de sucesso, mas a UI do painel nao tem feedback visual imediato (ex: animacao de "lance confirmado"). O usuario precisa confiar no toast.

### UX-06 — Formulario de transferencia sem confirmar identidade do destinatario antes de enviar
```typescript
// Transfers.tsx — sem preview do nome do destinatario
// Usuario digita email e clica "Confirmar" — sem step intermediario
```
Em um sistema financeiro, enviar dinheiro sem confirmar "Voce esta enviando para [Nome do Destinatario]?" e risco de erro do usuario.

### UX-07 — Notificacoes nao possuem link para a entidade relacionada
Em `Notifications.tsx`, cada notificacao e apenas texto. Nao ha link direto para o lote mencionado na notificacao de outbid, por exemplo. O usuario precisa navegar manualmente.

### UX-08 — Extrato da carteira limitado a 50 transacoes sem paginacao
```typescript
// useWallet.ts — linha 37
.limit(50)
```
Usuarios com historico longo nao tem acesso a transacoes mais antigas.

### UX-09 — Contagem de notificacoes nao e sincronizada entre TopBar e pagina Notifications
`TopBar` tem sua propria subscricao para contar notificacoes nao lidas. Quando o usuario marca como lido na pagina `Notifications.tsx`, o counter do `TopBar` so atualiza via realtime — sem garantia de consistencia imediata visual.

### UX-10 — `window.location.href` em vez de `useNavigate` na pagina MyAuctions
```typescript
// MyAuctions.tsx — linha 205
onClick: () => window.location.href = "/marketplace"
```
Causa full page reload desnecessario em uma SPA, perdendo o estado da aplicacao.

---

## 9. Gaps de Performance

### PERF-01 — `useMarketplaceFilters` faz N+2 queries ao banco por render
O hook faz 4 queries separadas sequencialmente:
1. Todos os lotes `live`
2. Todos os `lot_items` desses lotes
3. Todos os `assets` relacionados
4. Todos os `bids` desses lotes

Estas poderiam ser uma unica query com joins no Supabase (usando `.select` com relacionamentos aninhados).

### PERF-02 — `useLotDetail` faz 4 queries sequenciais e tem 3 canais realtime simultaneos
O hook de detalhe do lote abre 3 subscricoes Supabase simultaneas (`broadcastChannel`, `bidsChannel`, `lotChannel`) e qualquer mudanca em qualquer uma delas dispara um `fetchLot()` completo (4 queries). Um lance recebido pode disparar: broadcast + postgres_changes em bids + postgres_changes em lots = 3 refetches simultaneos.

### PERF-03 — `useMyAuctions` tem polling de 30 segundos desnecessario com realtime disponivel
```typescript
// useMyAuctions.ts — linha 99
refetchInterval: 30000, // Refetch every 30 seconds
```
O sistema ja tem realtime via Supabase channels. Polling adicional consome banda e recursos.

### PERF-04 — `useActivePromotion` e chamado em cada render do BidPanel com `amount` como chave
```typescript
// BidPanel.tsx
const { promotion: bidPromotion, calculateBenefit } = useActivePromotion("bid", calculatedTotal);
```
`calculatedTotal` muda a cada keystroke no input de lance. Isso dispara uma nova query RPC `get_active_promotion` a cada mudanca de valor, com `staleTime` de apenas 30s. Para um usuario digitando "1234", isso gera 4 queries em < 1 segundo.

### PERF-05 — TopBar faz query ao banco para contar notificacoes a cada render
```typescript
// TopBar.tsx — fetchUnread() faz SELECT COUNT(*) a cada mudanca
```
Combinado com a subscricao realtime, qualquer nova notificacao dispara um re-render do TopBar + nova query COUNT. Com muitas notificacoes em sequencia, pode criar gargalo.

### PERF-06 — `useWallet` recarrega 3 queries sempre que o usuario muda
Toda vez que `user` muda (login/logout/session refresh), `useWallet` refaz 3 queries. Como `useWallet` e instanciado em multiplos lugares, isso se multiplica.

### PERF-07 — Analytics faz processamento de dados em JavaScript no cliente
`useAnalyticsData.ts` busca centenas/milhares de eventos brutos e agrupa/calcula metricas em JS do cliente (loops, Sets, Maps). Para volumes maiores, isso sera lento e consumira memoria no browser. O ideal seria aggregations no banco (views materializadas ou funcoes SQL).

### PERF-08 — Fontes externas sem `font-display: swap`
```css
/* index.css — linha 6 */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:...');
```
Fontes do Google Fonts importadas sem `font-display: swap` podem causar FOIT (Flash of Invisible Text) em conexoes lentas.

---

## 10. Oportunidades de Melhoria

Ordenadas por impacto (maior primeiro):

### OP-01 — Migrar `useAuth` para `AuthContext` (AuthProvider)
**Impacto: Muito Alto** | Elimina N subscricoes duplicadas ao Supabase Auth, reduz requests ao banco de profiles, elimina o `setTimeout(0)` workaround, e e o pre-requisito para todas as outras melhorias de estado.

**Abordagem:** Criar `AuthContext.tsx` com um unico Provider no topo da arvore. Todos os componentes usam `useContext(AuthContext)` sem fazer suas proprias queries.

### OP-02 — Padronizar gerenciamento de estado com TanStack Query (migrar hooks manuais)
**Impacto: Alto** | Eliminar a inconsistencia entre hooks TanStack Query e hooks useState manual. Migrar `useWallet`, `useLotDetail`, `useMarketplaceFilters`, `useTransfers`, `useUsers` para TanStack Query com cache, deduplicacao e invalidacao automatica.

**Beneficio imediato:** `useWallet` com TanStack Query seria compartilhado entre todos os consumidores sem queries duplicadas.

### OP-03 — Criar hook/utils compartilhados: `formatCurrency`, `formatDate`
**Impacto: Medio-Alto** | Extrair para `src/lib/format.ts` e eliminar as 9+ copias duplicadas. Simples de executar, alto retorno em manutencibilidade.

```typescript
// src/lib/format.ts
export const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {...}).format(value);
```

### OP-04 — Implementar protecao de rotas no roteador (ProtectedRoute + AdminRoute)
**Impacto: Alto (Seguranca)** | Criar componentes `<ProtectedRoute>` e `<AdminRoute>` que encapsulam a logica de redirect no `App.tsx`, antes de renderizar qualquer componente filho.

```typescript
// App.tsx — padrao correto:
<Route element={<AdminRoute />}>
  <Route path="/admin/settings" element={<AdminSettings />} />
</Route>
```

### OP-05 — Otimizar queries do marketplace com joins do Supabase
**Impacto: Alto (Performance)** | Consolidar as 4 queries sequenciais de `useMarketplaceFilters` em 1-2 queries com relacionamentos aninhados do Supabase. Adicionar paginacao e busca textual server-side.

### OP-06 — Migrar Purchases e Notifications para hooks customizados
**Impacto: Medio** | Criar `usePurchases.ts` e `useNotifications.ts` para extrair a logica de fetch de dentro das paginas, seguindo o padrao ja estabelecido no resto do codebase.

### OP-07 — Adicionar validacao de formulario com Zod em todos os formularios
**Impacto: Medio (Seguranca + UX)** | Expandir o uso de `react-hook-form + zod` (atualmente so em auth) para: formulario de transferencia (validar email + valor minimo), formulario de saque (validar dados bancarios), formulario de criacao de lote (validar datas futura e preco positivo).

### OP-08 — Implementar WalletContext para compartilhar estado da carteira
**Impacto: Medio (Performance)** | Com TanStack Query, criar uma query compartilhada `["wallet", user?.id]` que todos os consumidores (`TopBar`, `BidPanel`, `Wallet`, `Transfers`) usam sem queries duplicadas. Elimina o PERF-06.

### OP-09 — Adicionar confirmacao de destinatario no formulario de transferencia
**Impacto: Medio (UX + Seguranca)** | Adicionar um step de preview antes de confirmar transferencia: "Voce esta enviando R$ X para [Nome do Usuario]. Confirmar?" Previne erros de envio para email errado.

### OP-10 — Adicionar links contextuais nas notificacoes
**Impacto: Medio (UX)** | Notificacoes de `bid_outbid` e `bid_won` deveriam incluir `lot_id` no payload para gerar um link direto ao lote. O schema de `notifications` tem campo `payload` (JSONB) que ja pode conter esta informacao.

---

## 11. Conclusao & Recomendacoes

### Resumo Executivo

O **OxyBroker** e uma aplicacao funcional e bem concebida para seu dominio — leiloes de ativos B2B em tempo real. A experiencia do usuario final esta bem coberta: o fluxo de lance funciona, o anti-sniping e countdown estao implementados, o realtime e robusto, e o painel de analytics e surpreendentemente completo.

**Pontos fortes:**
- Design system consistente e proprio (variaveis CSS `--oxy-*`, classes `.oxy-card`, `.oxy-badge-*`)
- Realtime bem implementado com cleanup correto de channels
- Sistema de promocoes completo e flexivel
- Cobertura funcional ampla para MVP
- TypeScript bem utilizado (tipos gerados do Supabase)
- TanStack Query usado corretamente nas features mais recentes

**Riscos principais (imediatos):**

1. **Multiplas instancias de `useAuth`** e o problema mais urgente. Em producao com usuarios ativos, cada pagina cria subscricoes e queries de profile independentes. Resolver isso com um `AuthContext` e a fundacao para todas as outras melhorias.

2. **Rotas admin sem protecao no roteador** e um gap de seguranca que deve ser corrigido antes de escalar. Mesmo que o RLS do Supabase proteja os dados, a UI expoe estados intermediarios de paginas admin para usuarios nao autorizados.

3. **Inconsistencia de estado (useState vs TanStack Query)** aumenta o custo de manutencao exponencialmente a cada nova feature. Definir um padrao e migrar os hooks manuais e trabalho que paga dividendos a longo prazo.

**Roadmap de melhorias sugerido:**

| Prioridade | Item | Estimativa |
|------------|------|-----------|
| 1 - Critico | AuthContext (OP-01) | 2-3 dias |
| 2 - Alto | ProtectedRoute + AdminRoute (OP-04) | 1 dia |
| 3 - Alto | formatCurrency/formatDate utils (OP-03) | 2 horas |
| 4 - Alto | Migrar Purchases + Notifications para hooks (OP-06) | 1 dia |
| 5 - Medio | Padronizar hooks com TanStack Query (OP-02) | 3-5 dias |
| 6 - Medio | WalletContext compartilhado (OP-08) | 1 dia |
| 7 - Medio | Validacao Zod em formularios admin (OP-07) | 2 dias |
| 8 - Medio | Otimizar queries do marketplace (OP-05) | 2-3 dias |
| 9 - Medio | Confirmacao de destinatario em transferencias (OP-09) | 0.5 dia |
| 10 - Baixo | Links nas notificacoes (OP-10) | 1 dia |

**Status geral do projeto:** Apto para operacao como MVP/beta. Nao recomendado para escala sem resolver TD-01 (estado hibrido), TD-03 (useAuth multiplo) e SEC-01 (rotas sem protecao).

---
*Analise conduzida por Atlas (Business Analyst) — AIOS-MASTER*
*Projeto: OxyBroker | Data: 2026-02-26*
