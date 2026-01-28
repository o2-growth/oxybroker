

# Plano: Tela de Gestão de Usuários (Admin)

## Resumo
Criar uma nova página administrativa para gerenciamento de usuários, acessível apenas para administradores, seguindo o padrão visual "Oxy Hacker" e os padrões existentes nas páginas admin.

---

## Funcionalidades

### Listagem de Usuários
- Tabela com todos os usuários do sistema
- Colunas: Nome, Email, Papel (Role), Categoria, Data de Criação
- Indicador visual do papel do usuário (badge colorido)
- Ordenação por nome/data

### Edição de Usuário
- Modal para editar perfil do usuário
- Campos editáveis:
  - Nome completo
  - Papel (admin, master_franquia, franquia, oxy_hacker)
  - Categoria de Franquia (para franquias)
- Validação: Admin não pode rebaixar a si mesmo

### Busca e Filtros
- Campo de busca por nome/email
- Filtro por papel (role)

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/admin/AdminUsers.tsx` | Página principal de gestão de usuários |
| `src/hooks/useUsers.ts` | Hook para buscar e atualizar usuários |

### Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/admin/users` |
| `src/components/layout/Sidebar.tsx` | Adicionar link "Usuários" no menu admin |

---

## Detalhes Técnicos

### Estrutura do Hook `useUsers.ts`
```text
useUsers()
├── fetchUsers() -> SELECT profiles.*, franchise_categories.name
├── updateUser(id, data) -> UPDATE profiles SET role, franchise_category_id
└── Estados: users, loading, error
```

### Componente AdminUsers.tsx
- Usa `useRoleGuard("admin")` para proteção de rota
- Segue padrão de `AdminCategories.tsx` (Dialog para edição)
- Componentes utilizados:
  - `AppShell` (layout)
  - `Table` (listagem)
  - `Dialog` (edição)
  - `Select` (escolha de role e categoria)
  - `Badge` (indicador de papel)
  - `Input` (busca)

### Mapeamento de Cores por Papel
```text
admin        -> bg-red-500/10 text-red-500
master_franquia -> bg-purple-500/10 text-purple-500
franquia     -> bg-blue-500/10 text-blue-500
oxy_hacker   -> bg-green-500/10 text-green-500
```

### Atualização Sincronizada
Ao alterar o role de um usuário:
1. Atualizar `profiles.role`
2. Atualizar `user_roles.role` (manter consistência)

---

## Segurança

### Proteção de Rota
- `useRoleGuard("admin")` redireciona não-admins para `/marketplace`

### RLS Existente
As políticas já configuradas garantem:
- Apenas admins podem SELECT todos os profiles (`profiles_select_admin`)
- Apenas admins podem UPDATE profiles de outros usuários (`profiles_update_admin`)
- Apenas admins podem modificar `user_roles` (`user_roles_update_admin`)

### Validação no Cliente
- Admin não pode alterar seu próprio papel
- Exibir confirmação antes de promover/rebaixar usuários

---

## Fluxo de Navegação

```text
Sidebar (Admin)
├── Configurações (/admin/settings)
├── Usuários (/admin/users)      <- NOVO
├── Categorias (/admin/categories)
├── Ativos (/admin/assets)
└── Lotes (/admin/lots)
```

