

# Plano: Paginacao para Usuarios, Categorias, Ativos e Lotes

## Resumo

Implementar paginacao server-side (Supabase) para as quatro entidades administrativas, permitindo lidar com grandes volumes de dados de forma eficiente.

---

## Arquitetura da Paginacao

```text
+------------------+     +------------------+     +------------------+
|   Admin Page     |     |   Custom Hook    |     |   Supabase       |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  page = 1        |---->|  .range(from,to) |---->|  LIMIT + OFFSET  |
|  pageSize = 10   |     |  .count("exact") |     |  + COUNT(*)      |
|                  |<----|  totalCount      |<----|                  |
|                  |     |  items[]         |     |                  |
+------------------+     +------------------+     +------------------+
         |                       |
         v                       v
+------------------+     +------------------+
|  PaginationBar   |     |  "1-10 de 150"   |
|  < 1 2 ... 15 >  |     |  registros       |
+------------------+     +------------------+
```

---

## Componente Reutilizavel

### `DataTablePagination`

Criar um componente generico que pode ser usado em todas as tabelas:

| Prop | Tipo | Descricao |
|------|------|-----------|
| `currentPage` | number | Pagina atual (1-indexed) |
| `totalPages` | number | Total de paginas |
| `totalItems` | number | Total de registros |
| `pageSize` | number | Itens por pagina |
| `onPageChange` | (page) => void | Callback de mudanca de pagina |

### Funcionalidades
- Botoes Anterior/Proximo
- Numeros de pagina (com ellipsis para ranges longos)
- Indicador "1-10 de 150 registros"
- Desabilitar botoes nas bordas

---

## 1. Usuarios

### Modificar `useUsers.ts`

| Parametro | Tipo | Default |
|-----------|------|---------|
| `page` | number | 1 |
| `pageSize` | number | 10 |

Query Supabase:
```text
.range((page - 1) * pageSize, page * pageSize - 1)
.select(..., { count: "exact" })
```

Retorno adicional:
- `totalCount: number`
- `totalPages: number`

### Modificar `AdminUsers.tsx`

- Adicionar estado `page` e `pageSize`
- Exibir componente `DataTablePagination` abaixo da tabela
- Atualizar contagem de registros

---

## 2. Categorias

### Modificar `useCategories.ts`

Adicionar paginacao via parametros:

| Parametro | Tipo | Default |
|-----------|------|---------|
| `page` | number | 1 |
| `pageSize` | number | 12 |

Retorno adicional:
- `totalCount`
- `totalPages`

### Modificar `AdminCategories.tsx`

- Adicionar estado de paginacao
- Exibir paginacao abaixo do grid de cards
- Mostrar contagem total

---

## 3. Ativos

### Modificar `useAssets.ts`

| Parametro | Tipo | Default |
|-----------|------|---------|
| `page` | number | 1 |
| `pageSize` | number | 10 |

### Modificar `AdminAssets.tsx`

- Adicionar estado de paginacao
- Resetar pagina ao mudar filtros
- Exibir paginacao na tabela

---

## 4. Lotes

### Modificar `useAdminLots.ts`

| Parametro | Tipo | Default |
|-----------|------|---------|
| `page` | number | 1 |
| `pageSize` | number | 10 |

### Modificar `AdminLots.tsx`

- Adicionar estado de paginacao
- Resetar pagina ao mudar filtros/busca
- Exibir paginacao na tabela

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/ui/data-table-pagination.tsx` | Componente de paginacao reutilizavel |

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `src/hooks/useUsers.ts` | Adicionar paginacao server-side |
| `src/hooks/useCategories.ts` | Adicionar paginacao server-side |
| `src/hooks/useAssets.ts` | Adicionar paginacao server-side |
| `src/hooks/useAdminLots.ts` | Adicionar paginacao server-side |
| `src/pages/admin/AdminUsers.tsx` | Integrar paginacao + reset ao filtrar |
| `src/pages/admin/AdminCategories.tsx` | Integrar paginacao |
| `src/pages/admin/AdminAssets.tsx` | Integrar paginacao + reset ao filtrar |
| `src/pages/admin/AdminLots.tsx` | Integrar paginacao + reset ao filtrar |

---

## Detalhes Tecnicos

### Query Supabase com Paginacao

Para cada hook, a query sera modificada para usar `.range()`:

```text
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

const { data, error, count } = await supabase
  .from("table")
  .select("*", { count: "exact" })  // IMPORTANTE: count retorna total
  .order("created_at", { ascending: false })
  .range(from, to);

// count = total de registros que correspondem aos filtros
// totalPages = Math.ceil(count / pageSize)
```

### Componente DataTablePagination

```text
Estrutura Visual:

Mostrando 1-10 de 150        < Anterior | 1 | 2 | ... | 15 | Proximo >

- Links com cursor pointer
- Pagina atual destacada
- Anterior/Proximo desabilitados nas bordas
- Ellipsis para gaps grandes
```

### Reset de Pagina

Quando o usuario muda filtros ou busca, a pagina deve voltar para 1:

```text
useEffect(() => {
  setPage(1);
}, [search, statusFilter, typeFilter]);
```

---

## Ordem de Implementacao

1. Criar componente `DataTablePagination`
2. Modificar hooks (todos em paralelo)
3. Modificar paginas administrativas (todas em paralelo)
4. Testar navegacao e reset de filtros

