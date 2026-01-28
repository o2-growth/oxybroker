
# Plano: CRUD Completo para Categorias, Ativos e Lotes

## Resumo

Implementar operacoes completas de Create, Read, Update e Delete para as tres entidades principais do sistema de leilao:

| Entidade | Tabela | Funcionalidades |
|----------|--------|-----------------|
| Categorias | `franchise_categories` | Criar, listar, editar nome/limites, excluir |
| Ativos | `assets` | Criar, listar, editar, mudar status, excluir |
| Lotes | `lots` | Criar, listar, editar, gerenciar ativos, publicar, cancelar |

---

## Arquitetura

```text
+-------------------+     +------------------+     +------------------+
|   AdminCategories |     |   AdminAssets    |     |   AdminLots      |
|   (Pagina)        |     |   (Pagina)       |     |   (Pagina)       |
+--------+----------+     +--------+---------+     +--------+---------+
         |                         |                        |
         v                         v                        v
+--------+----------+     +--------+---------+     +--------+---------+
|  useCategories    |     |  useAssets       |     |  useAdminLots    |
|  (Hook)           |     |  (Hook)          |     |  (Hook)          |
+--------+----------+     +--------+---------+     +--------+---------+
         |                         |                        |
         +-------------------------+------------------------+
                                   |
                                   v
                          +--------+---------+
                          |   Supabase       |
                          |   (Client SDK)   |
                          +------------------+
```

---

## 1. Categorias (franchise_categories)

### 1.1 Criar Hook `useCategories`

| Funcao | Descricao |
|--------|-----------|
| `fetchCategories()` | Listar todas as categorias |
| `createCategory(name, limits_json)` | Criar nova categoria |
| `updateCategory(id, data)` | Editar categoria existente |
| `deleteCategory(id)` | Excluir categoria (com validacao) |

### 1.2 Atualizar `AdminCategories.tsx`

- Adicionar botao de editar em cada card
- Adicionar botao de excluir em cada card
- Dialog para edicao (nome e limites JSON)
- Confirmacao antes de excluir
- Validacao: nao permitir excluir categoria com usuarios vinculados

### Campos do Formulario
- Nome (obrigatorio)
- Limites JSON (opcional, editor simples)

---

## 2. Ativos (assets)

### 2.1 Criar Hook `useAssets`

| Funcao | Descricao |
|--------|-----------|
| `fetchAssets(filters)` | Listar com filtros (status, tipo, busca) |
| `createAsset(data)` | Criar novo ativo |
| `updateAsset(id, data)` | Editar ativo existente |
| `updateAssetStatus(id, status)` | Mudar status do ativo |
| `deleteAsset(id)` | Excluir ativo (apenas draft) |

### 2.2 Atualizar `AdminAssets.tsx`

- Conectar botao "Novo Ativo" a dialog de criacao
- Adicionar coluna de acoes na tabela
- Dialog para criar/editar ativo
- Filtros por status e tipo
- Acoes: Editar, Mudar Status, Excluir

### Campos do Formulario
| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| `title` | texto | Sim |
| `asset_type` | select (lead, mlq, meeting) | Sim |
| `status` | select | Sim |
| `sector` | texto | Nao |
| `revenue_range` | texto | Nao |
| `location_city` | texto | Nao |
| `location_state` | texto | Nao |
| `employees_count` | numero | Nao |
| `base_score` | numero | Nao |

### Status Disponiveis
- `draft` - Rascunho
- `available` - Disponivel para leilao
- `in_auction` - Em leilao (nao editavel)
- `sold` - Vendido
- `returned` - Devolvido
- `disabled` - Desativado

---

## 3. Lotes (lots)

### 3.1 Criar Hook `useAdminLots`

| Funcao | Descricao |
|--------|-----------|
| `fetchLots(filters)` | Listar com filtros |
| `createLot(data)` | Criar novo lote |
| `updateLot(id, data)` | Editar lote (apenas draft) |
| `addAssetToLot(lotId, assetId)` | Vincular ativo ao lote |
| `removeAssetFromLot(lotId, assetId)` | Desvincular ativo |
| `publishLot(id)` | Mudar status para live |
| `cancelLot(id)` | Cancelar lote |
| `deleteLot(id)` | Excluir lote (apenas draft) |

### 3.2 Atualizar `AdminLots.tsx`

- Dialog para criar/editar lote
- Selecao de ativos disponiveis para vincular
- Lista de ativos vinculados ao lote
- Filtros por status
- Acoes por status:

| Status | Acoes Permitidas |
|--------|------------------|
| `draft` | Editar, Publicar, Excluir |
| `live` | Cancelar, Ver detalhes |
| `ended` | Ver detalhes |
| `cancelled` | Excluir |

### Campos do Formulario
| Campo | Tipo | Obrigatorio |
|-------|------|-------------|
| `title` | texto | Sim |
| `description` | textarea | Nao |
| `starting_price` | moeda | Sim |
| `min_bid_increment` | moeda | Sim (default 100) |
| `starts_at` | datetime | Nao (publica imediatamente) |
| `ends_at` | datetime | Sim |

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useCategories.ts` | Hook CRUD categorias |
| `src/hooks/useAssets.ts` | Hook CRUD ativos |
| `src/hooks/useAdminLots.ts` | Hook CRUD lotes |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/admin/AdminCategories.tsx` | Adicionar editar, excluir, dialog completo |
| `src/pages/admin/AdminAssets.tsx` | Adicionar criar, editar, excluir, filtros, acoes |
| `src/pages/admin/AdminLots.tsx` | Adicionar criar, editar, vincular ativos, publicar, cancelar |

---

## Detalhes Tecnicos

### Validacoes de Negocio

```text
CATEGORIAS
  Excluir:
    - Verificar se ha usuarios vinculados
    - Se sim, exibir erro: "Categoria possui usuarios vinculados"

ATIVOS
  Excluir:
    - Apenas status = 'draft'
    - Verificar se esta em algum lote

  Editar:
    - Status in_auction ou sold = somente leitura

LOTES
  Publicar:
    - Verificar se ha ativos vinculados (minimo 1)
    - Verificar se ends_at > now()
    - Atualizar status dos ativos para 'in_auction'

  Cancelar:
    - Reverter status dos ativos para 'available'
    - Atualizar status do lote para 'cancelled'

  Excluir:
    - Apenas status = 'draft' ou 'cancelled'
```

### Componentes Reutilizaveis

Serao utilizados os componentes existentes do shadcn/ui:
- `Dialog` para modais
- `AlertDialog` para confirmacoes
- `Select` para dropdowns
- `Input` para campos de texto
- `Textarea` para descricoes
- `Badge` para status
- `Button` para acoes
- `Table` para listagens
- `DropdownMenu` para menu de acoes

### Formatacao

- Datas: `dd/MM/yyyy HH:mm` (formato brasileiro)
- Moeda: `R$ 1.000,00` (BRL)
- Status: Labels em portugues com cores semanticas

---

## Fluxo de Publicacao de Lote

```text
1. Admin cria lote (status: draft)
         |
         v
2. Admin vincula ativos disponiveis ao lote
         |
         v
3. Admin define datas e precos
         |
         v
4. Admin clica "Publicar"
         |
         v
5. Sistema valida:
   - Ha ativos vinculados?
   - ends_at > now?
         |
         v
6. Sistema atualiza:
   - lot.status = 'live'
   - lot.starts_at = now() (se nao definido)
   - assets.status = 'in_auction' (para cada ativo vinculado)
         |
         v
7. Lote aparece no Marketplace para franqueados
```

---

## Ordem de Implementacao

1. Hooks (base da logica)
2. AdminCategories (mais simples, apenas nome)
3. AdminAssets (complexidade media)
4. AdminLots (mais complexo, depende de ativos)

