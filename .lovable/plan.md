

# Plano: Corrigir Criação de Usuários (Admin)

## Problema Identificado

O código atual usa `supabase.auth.signUp()` no cliente para criar usuários. Isso causa dois problemas:

1. **Login automático**: O `signUp()` automaticamente faz login com o novo usuário, substituindo a sessão do admin
2. **Usuário não aparece**: Após o reload, o admin foi deslogado e o novo usuário (sem permissão admin) é redirecionado

## Solução

Criar uma **Edge Function** que usa a **Admin API** do Supabase para criar usuários sem afetar a sessão do admin.

```text
Cliente (Admin)                   Edge Function                    Supabase Auth
      |                                 |                                |
      |-- POST /create-user ----------->|                                |
      |   {email, password, name, role} |                                |
      |                                 |-- admin.auth.createUser() ---->|
      |                                 |<-- user created ---------------|
      |                                 |                                |
      |                                 |-- INSERT profiles ------------->
      |                                 |-- INSERT user_roles ----------->
      |                                 |-- INSERT wallets -------------->
      |<-- {success: true, user} -------|                                |
      |                                 |                                |
   (sessão admin mantida)               
```

---

## Arquivos a Criar/Modificar

### Novo Arquivo
| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/create-user/index.ts` | Edge Function para criar usuário via Admin API |

### Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/AdminUsers.tsx` | Substituir `signUp()` por chamada à Edge Function |
| `src/hooks/useUsers.ts` | Adicionar função `createUser` que chama a Edge Function |

---

## Detalhes Técnicos

### Edge Function `create-user`

A função irá:
1. Verificar se o chamador é admin (via JWT)
2. Usar `supabaseAdmin.auth.admin.createUser()` para criar o usuário
3. Configurar `email_confirm: true` para auto-confirmar o email
4. Atualizar `profiles`, `user_roles` e `wallets` com os dados corretos

### Atualização do Hook `useUsers.ts`

Adicionar função:
```text
createUser(data: CreateUserData)
├── Chamar Edge Function /create-user
├── Verificar resposta
├── Exibir toast de sucesso/erro
└── Chamar fetchUsers() para atualizar lista
```

### Atualização do `AdminUsers.tsx`

Alterar `handleCreate`:
```text
handleCreate()
├── Validar campos
├── Chamar createUser() do hook (não mais signUp)
├── Fechar modal
├── Lista atualiza automaticamente (sem reload)
```

---

## Segurança

### Proteção da Edge Function
- Verificar token JWT do chamador
- Validar que o chamador possui role `admin`
- Usar `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor

### Validações
- Email obrigatório e formato válido
- Senha com mínimo de 6 caracteres
- Nome obrigatório
- Role deve ser um valor válido do enum

---

## Benefícios

1. **Sessão preservada**: Admin continua logado após criar usuário
2. **Usuário confirmado**: Email já confirmado, pode fazer login imediatamente
3. **Lista atualizada**: Sem reload, lista atualiza via `fetchUsers()`
4. **Segurança**: Criação apenas via Edge Function autenticada

