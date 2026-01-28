
# Plano: Tela de Leiloes em Participacao e Resumo no Marketplace

## Resumo

Criar uma nova pagina `/my-auctions` para usuarios acompanharem todos os leiloes em que estao participando, e adicionar um painel lateral no Marketplace com um resumo dessas participacoes.

---

## Novas Funcionalidades

### 1. Pagina "Meus Leiloes" (`/my-auctions`)

| Elemento | Descricao |
|----------|-----------|
| Lista de leiloes ativos | Lotes onde o usuario deu pelo menos 1 lance |
| Status por lote | Badge "Ganhando" ou "Perdendo" |
| Valor do maior lance do usuario | Exibido por lote |
| Tempo restante | Countdown timer para lotes live |
| Acoes | Link para ver detalhes do lote |
| Separacao por status | Lotes ativos primeiro, encerrados abaixo |

### 2. Painel de Resumo no Marketplace

| Elemento | Descricao |
|----------|-----------|
| Posicao | Sidebar direita (desktop) / Card colapsavel (mobile) |
| Conteudo | Ate 5 leiloes com participacao ativa |
| Informacoes por lote | Nome, status (ganhando/perdendo), preco atual |
| Link "Ver todos" | Direciona para `/my-auctions` |
| Visibilidade | Apenas para usuarios autenticados |

---

## Arquitetura

```text
+----------------------------------------------------------+
|  Marketplace Header                     [ViewToggle]      |
+----------------------------------------------------------+
|              Stats Cards                                  |
+----------------------------------------------------------+
|  Filters (horizontal)                                     |
+----------------------------------------------------------+
|                              |                            |
|   Lotes Grid/List           |   Minhas Participacoes     |
|   (conteudo principal)       |   (sidebar direita)        |
|                              |   - Lote 1 [Ganhando]      |
|                              |   - Lote 2 [Perdendo]      |
|                              |   [Ver todos ->]           |
|                              |                            |
+----------------------------------------------------------+
```

---

## Arquivos a Criar

### `src/pages/MyAuctions.tsx`

Pagina completa para visualizar todos os leiloes com participacao:

- Buscar bids do usuario autenticado
- Agrupar por lot_id
- Para cada lote, determinar status (ganhando/perdendo)
- Separar entre ativos (live) e encerrados (ended)
- Exibir em lista com detalhes

### `src/hooks/useMyAuctions.ts`

Hook para buscar leiloes com participacao:

```text
1. Buscar todos os bids do usuario
2. Extrair lot_ids unicos
3. Buscar dados dos lotes correspondentes
4. Para cada lote, buscar o maior bid geral
5. Determinar se usuario esta ganhando ou perdendo
6. Retornar dados enriquecidos
```

Interface de retorno:
```text
interface MyAuctionItem {
  lot: Lot;
  myHighestBid: Bid;
  lotHighestBid: Bid;
  status: 'winning' | 'losing';
  isActive: boolean;
}
```

### `src/components/marketplace/MyAuctionsSummary.tsx`

Painel lateral para o Marketplace:

- Exibir ate 5 participacoes ativas
- Badge colorido de status
- Preco atual do lote
- Timer de encerramento (se live)
- Botao "Ver todos" -> `/my-auctions`

---

## Arquivos a Modificar

### `src/App.tsx`

Adicionar nova rota:
```text
<Route path="/my-auctions" element={<MyAuctions />} />
```

### `src/components/layout/Sidebar.tsx`

Adicionar item de menu:
```text
{ title: "Meus Leilões", url: "/my-auctions", icon: Target }
```

Posicao: Logo abaixo de "Marketplace"

### `src/pages/Marketplace.tsx`

Adicionar layout com sidebar direita:

Desktop:
```text
<div className="flex gap-6">
  <div className="flex-1">
    {/* Lotes existentes */}
  </div>
  <aside className="w-80 shrink-0 hidden lg:block">
    <MyAuctionsSummary />
  </aside>
</div>
```

Mobile:
- Card colapsavel acima dos lotes ou
- Omitir (usuario acessa via menu)

---

## Detalhes Tecnicos

### Query para buscar participacoes

```text
1. SELECT DISTINCT lot_id FROM bids WHERE user_id = auth.uid()

2. Para cada lot_id:
   - SELECT * FROM lots WHERE id = lot_id
   - SELECT * FROM bids WHERE lot_id = lot_id ORDER BY amount DESC LIMIT 1
   - SELECT * FROM bids WHERE lot_id = lot_id AND user_id = auth.uid() 
     ORDER BY amount DESC LIMIT 1
```

Otimizacao: Fazer em queries batch para evitar N+1

### Realtime Updates

Subscrever em `bids` para atualizar status automaticamente quando:
- Novo lance e feito no lote
- Lote muda de status (live -> ended)

### RLS

As queries usarao as policies existentes:
- `bids_select_authenticated`: Usuario pode ver todos os bids
- `lots` SELECT: Usuario pode ver lotes nao-draft

---

## Componentes UI

### Card de Participacao

```text
+----------------------------------------+
| [Ganhando] Lote Premium Tech           |
| Lance: R$ 6.000,00    Encerra: 1d 12h  |
| [Ver detalhes ->]                      |
+----------------------------------------+
```

### Painel do Marketplace

```text
+------------------------------------+
|  Minhas Participacoes (3)          |
+------------------------------------+
|  [V] Lote Tech - R$ 6.000          |
|  [X] Lote Industria - R$ 10.000    |
|  [V] Lote Saude - R$ 3.500         |
|                                    |
|  [Ver todos os leiloes ->]         |
+------------------------------------+
```

Legenda: [V] = Ganhando (verde), [X] = Perdendo (amarelo/vermelho)

---

## Estados Vazios

### Pagina `/my-auctions`

Se usuario nao tem participacoes:
```text
"Voce ainda nao participou de nenhum leilao.
Visite o Marketplace para dar seus primeiros lances."
[Ir para Marketplace]
```

### Painel do Marketplace

Se usuario nao tem participacoes:
- Nao exibir o painel (para nao poluir a interface)
- Ou exibir com mensagem: "Participe de leiloes para acompanhar aqui"

---

## Mobile

- Pagina `/my-auctions`: Lista vertical responsiva
- Painel no Marketplace: Omitido por padrao, usuario acessa via menu lateral

---

## Resumo de Implementacao

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/pages/MyAuctions.tsx` | Criar | Pagina completa de participacoes |
| `src/hooks/useMyAuctions.ts` | Criar | Hook para buscar dados |
| `src/components/marketplace/MyAuctionsSummary.tsx` | Criar | Painel lateral |
| `src/App.tsx` | Editar | Adicionar rota |
| `src/components/layout/Sidebar.tsx` | Editar | Adicionar item de menu |
| `src/pages/Marketplace.tsx` | Editar | Adicionar sidebar direita |

---

## Fluxo do Usuario

1. Usuario da lance em um lote
2. No Marketplace, painel lateral mostra participacao
3. Usuario ve badge "Ganhando" ou "Perdendo"
4. Clica em "Ver todos" para ir a `/my-auctions`
5. Na pagina dedicada, ve historico completo com lotes ativos e encerrados
6. Recebe atualizacoes em tempo real quando outro usuario da lance
