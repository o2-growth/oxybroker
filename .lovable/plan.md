
# Plano: Simplificar Filtros do Marketplace

## Resumo

Remover a busca por texto e manter apenas 3 filtros essenciais (tipo de ativo, localizacao e setores), reposicionando-os no topo da pagina em vez da sidebar lateral.

---

## Alteracoes Principais

### 1. Remover do Marketplace

| Elemento | Arquivo | Acao |
|----------|---------|------|
| Input de busca "Buscar lotes..." | `Marketplace.tsx` | Remover linhas 128-137 |
| Sidebar de filtros (desktop) | `Marketplace.tsx` | Substituir por barra horizontal no topo |
| Ordenacao (sort) | Filtros | Remover |
| Status (live/ended/all) | Filtros | Remover |
| Faixa de preco | Filtros | Remover |
| Faixa de score | Filtros | Remover |

### 2. Manter nos Filtros

| Filtro | Descricao |
|--------|-----------|
| Tipo de Ativo | Multi-select: Lead, MQL, Meeting, Cliente |
| Localizacao | Estados disponiveis |
| Setores | Lista de setores |

---

## Nova Estrutura Visual

```text
+----------------------------------------------------------+
|  [Header: Marketplace]                    [ViewToggle]   |
+----------------------------------------------------------+
|                     Stats Cards                          |
+----------------------------------------------------------+
|  FILTROS (horizontal, inline):                           |
|  [Tipo: Lead, MQL...] [Estado: SP, RJ...] [Setor: Tech..]|
|  [Limpar filtros - se ativos]                            |
+----------------------------------------------------------+
|                                                          |
|  Lista/Grid de Lotes                                     |
|                                                          |
+----------------------------------------------------------+
```

---

## Arquivos a Modificar

### `src/components/marketplace/MarketplaceFilters.tsx`

**Remover:**
- Secao Sort (ordenar por)
- Secao Status (live/ended/all)
- Secao Price Range (faixa de preco)
- Secao Score Range (faixa de score)
- Collapsibles desnecessarios

**Manter:**
- Tipo de Ativo (checkboxes)
- Localizacao/Estados (badges)
- Setores (badges)
- Botao limpar filtros

**Novo layout:**
- Desktop: Barra horizontal com filtros inline usando dropdowns/popovers
- Mobile: Manter Sheet/Drawer simplificado

### `src/pages/Marketplace.tsx`

**Remover:**
- Input de busca (linhas 128-137)
- Import do Search icon
- Import do Input

**Alterar:**
- Mover filtros para area entre stats e lista de lotes
- Remover estrutura de sidebar (flex gap-6)
- Filtros sempre visiveis no topo (desktop e mobile)

### `src/hooks/useMarketplaceFilters.ts`

**Simplificar interface `MarketplaceFilters`:**
```text
Manter:
- assetTypes: AssetType[]
- sectors: string[]
- states: string[]

Remover:
- cities: string[]
- minScore: number | null
- maxScore: number | null
- minPrice: number | null
- maxPrice: number | null
- status: LotStatus | "all"
- search: string
- sortBy: ...
```

**Atualizar query:**
- Remover filtros de status (buscar apenas live por padrao)
- Remover filtros de preco e score
- Remover busca por texto
- Manter ordenacao fixa (time_remaining)

---

## Detalhes Tecnicos

### Interface Simplificada

```text
interface MarketplaceFilters {
  assetTypes: AssetType[];
  sectors: string[];
  states: string[];
}
```

### Query Simplificada

```text
1. Buscar lots com status = 'live'
2. Ordenar por ends_at ASC
3. Juntar com assets via lot_items
4. Filtrar client-side por assetTypes, sectors, states
```

### Layout Desktop dos Filtros

```text
<div className="flex flex-wrap gap-3 items-center">
  <Popover> Tipo de Ativo (multi-select) </Popover>
  <Popover> Estado (multi-select) </Popover>
  <Popover> Setor (multi-select) </Popover>
  {hasActiveFilters && <Button>Limpar</Button>}
</div>
```

### Layout Mobile

- Botao "Filtros" abre Sheet com os 3 filtros em lista vertical
- Mesmo conteudo, apenas layout diferente

---

## Componentes UI Necessarios

| Componente | Uso |
|------------|-----|
| Popover | Container para filtros dropdown no desktop |
| Checkbox | Selecao multipla de tipos |
| Badge | Tags clicaveis para estados/setores |
| Button | Limpar filtros |
| Sheet | Drawer mobile |

---

## Resumo das Mudancas por Arquivo

| Arquivo | Alteracoes |
|---------|------------|
| `MarketplaceFilters.tsx` | Remover 5 secoes, simplificar para 3 filtros, novo layout horizontal |
| `Marketplace.tsx` | Remover busca, remover sidebar, filtros no topo |
| `useMarketplaceFilters.ts` | Simplificar interface, remover props nao usadas, query mais simples |
