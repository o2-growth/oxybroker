

# Plano: Funcionalidade de Saque com Controle Admin

## Resumo

Adicionar funcionalidade de saque de saldo da carteira, com controle individual por usuario feito pelo administrador. A opcao vem desativada por padrao para novos usuarios.

---

## Arquitetura da Solucao

```text
+------------------+                +------------------+
|  Wallet Page     |                |  Admin Users     |
|  [Sacar Saldo]   |                |  [x] Pode sacar  |
+--------+---------+                +--------+---------+
         |                                   |
         v                                   v
+------------------+                +------------------+
|  WithdrawModal   |                |  profiles table  |
|  - Valor         |                |  can_withdraw    |
|  - Dados bancarios               |  (boolean)       |
+--------+---------+                +------------------+
         |
         v
+------------------+
|  Edge Function   |
|  request-        |
|  withdrawal      |
+--------+---------+
         |
         v
+------------------+
|  withdrawals     |
|  table           |
|  (status pending)|
+------------------+
         |
         v
+------------------+
|  Admin aprova    |
|  ou processa     |
|  manualmente     |
+------------------+
```

---

## 1. Alteracoes no Banco de Dados

### 1.1 Adicionar coluna na tabela `profiles`

| Coluna | Tipo | Default | Descricao |
|--------|------|---------|-----------|
| `can_withdraw` | boolean | false | Controla se usuario pode solicitar saque |

### 1.2 Adicionar tipo de transacao ao enum

Adicionar `withdrawal` ao enum `wallet_transaction_type`:
- `withdrawal` - Saque de saldo

### 1.3 Criar tabela `withdrawals`

Nova tabela para rastrear solicitacoes de saque:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | Usuario solicitante |
| amount | numeric | Valor do saque |
| status | enum | pending, approved, rejected, completed |
| bank_info | jsonb | Dados bancarios (banco, agencia, conta, pix) |
| requested_at | timestamptz | Data da solicitacao |
| processed_at | timestamptz | Data do processamento |
| processed_by | uuid | Admin que processou |
| notes | text | Observacoes do admin |

### 1.4 RLS para tabela `withdrawals`

- Usuario pode SELECT/INSERT suas proprias solicitacoes
- Admin pode SELECT/UPDATE todas
- Oxy_hacker pode SELECT todas (auditoria)

---

## 2. Atualizar Trigger de Novo Usuario

Modificar `handle_new_user()` para incluir `can_withdraw = false` no profile.

---

## 3. Criar Edge Function `request-withdrawal`

| Aspecto | Detalhe |
|---------|---------|
| Endpoint | `POST /functions/v1/request-withdrawal` |
| Autenticacao | JWT obrigatorio |
| Body | `{ amount, bank_info }` |
| Validacoes | `can_withdraw = true`, saldo suficiente, valor minimo |

### Logica

```text
1. Verificar autenticacao
2. Verificar se usuario pode sacar (can_withdraw = true)
3. Verificar saldo suficiente
4. Validar valor minimo (R$ 50)
5. Criar registro em withdrawals (status: pending)
6. Debitar saldo da carteira
7. Registrar transacao tipo "withdrawal"
8. Notificar admins (opcional)
```

---

## 4. Novos Componentes Frontend

### 4.1 `WithdrawModal.tsx`

Modal similar ao TopUpModal:
- Exibir saldo disponivel
- Input para valor do saque
- Campos para dados bancarios (PIX ou conta)
- Botao de confirmar

### 4.2 `useWithdraw.ts`

Hook para gerenciar saque:
- `requestWithdrawal(amount, bankInfo)`
- `loading` state
- Tratamento de erros

---

## 5. Modificar Pagina Wallet

Adicionar botao "Sacar" ao lado de "Transferir":
- Verificar se `can_withdraw = true` antes de exibir botao
- Ou exibir botao desabilitado com tooltip "Saque nao habilitado"

---

## 6. Modificar Gestao de Usuarios (Admin)

### 6.1 Atualizar interface `UserProfile`

Adicionar campo `can_withdraw: boolean`

### 6.2 Atualizar interface `UpdateUserData`

Adicionar campo opcional `can_withdraw?: boolean`

### 6.3 Modificar dialogs de criacao/edicao

Adicionar Switch para "Permitir saque":
- Label: "Permitir Saque"
- Descricao: "Habilita o usuario a solicitar saque do saldo"
- Default: desabilitado

### 6.4 Atualizar fetch e update de usuarios

Incluir campo `can_withdraw` nas queries

---

## 7. Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/request-withdrawal/index.ts` | Edge function para solicitar saque |
| `src/hooks/useWithdraw.ts` | Hook para gerenciar saque |
| `src/components/wallet/WithdrawModal.tsx` | Modal de solicitacao de saque |

---

## 8. Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Wallet.tsx` | Adicionar botao e modal de saque |
| `src/pages/admin/AdminUsers.tsx` | Adicionar switch de permissao de saque |
| `src/hooks/useUsers.ts` | Incluir can_withdraw no fetch/update |
| `src/hooks/useWallet.ts` | Incluir can_withdraw do profile |
| `supabase/functions/create-user/index.ts` | Garantir can_withdraw = false |
| `supabase/config.toml` | Registrar nova edge function |

---

## 9. Detalhes Tecnicos

### Fluxo de Saque

```text
1. Usuario acessa Wallet
           |
           v
2. Sistema verifica can_withdraw via useWallet
           |
    +------+------+
    |             |
    v             v
  false         true
    |             |
    v             v
 Botao         Botao
 oculto        "Sacar"
 ou tooltip      |
                 v
           3. Abre WithdrawModal
                 |
                 v
           4. Usuario preenche:
              - Valor
              - Chave PIX ou dados bancarios
                 |
                 v
           5. Chama request-withdrawal
                 |
                 v
           6. Edge Function:
              - Valida permissao
              - Valida saldo
              - Debita carteira
              - Cria registro pending
                 |
                 v
           7. Retorna sucesso
                 |
                 v
           8. Toast: "Solicitacao enviada"
```

### Estrutura do bank_info (JSONB)

```text
{
  "type": "pix" | "bank_account",
  "pix_key": "email@exemplo.com",  // se type = pix
  "bank_code": "001",              // se type = bank_account
  "agency": "1234",
  "account": "12345-6",
  "account_type": "corrente" | "poupanca"
}
```

### Validacoes

| Validacao | Valor |
|-----------|-------|
| Valor minimo | R$ 50,00 |
| Valor maximo | Saldo disponivel |
| Permissao | can_withdraw = true |
| Autenticacao | JWT valido |

---

## 10. Seguranca

- Verificacao dupla de `can_withdraw` (frontend + backend)
- Validacao de JWT na edge function
- Debito atomico do saldo
- RLS para proteger dados de saque
- Admin pode ver/aprovar/rejeitar solicitacoes

---

## 11. Migracao SQL

```sql
-- 1. Adicionar coluna can_withdraw
ALTER TABLE public.profiles 
ADD COLUMN can_withdraw boolean NOT NULL DEFAULT false;

-- 2. Adicionar valor ao enum
ALTER TYPE public.wallet_transaction_type ADD VALUE 'withdrawal';

-- 3. Criar enum de status de saque
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending', 
  'approved', 
  'rejected', 
  'completed'
);

-- 4. Criar tabela withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  amount numeric NOT NULL CHECK (amount >= 50),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  bank_info jsonb NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  notes text
);

-- 5. Habilitar RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 6. Politicas RLS
CREATE POLICY "withdrawals_select_own" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "withdrawals_select_admin" ON public.withdrawals
  FOR SELECT USING (is_admin());

CREATE POLICY "withdrawals_update_admin" ON public.withdrawals
  FOR UPDATE USING (is_admin());

CREATE POLICY "withdrawals_select_oxy_hacker" ON public.withdrawals
  FOR SELECT USING (is_oxy_hacker());
```

---

## 12. Ordem de Implementacao

1. Executar migracao SQL (schema)
2. Criar edge function `request-withdrawal`
3. Criar hook `useWithdraw`
4. Criar componente `WithdrawModal`
5. Atualizar `useWallet` para incluir `can_withdraw`
6. Atualizar `Wallet.tsx` com botao e modal
7. Atualizar `useUsers.ts` para incluir `can_withdraw`
8. Atualizar `AdminUsers.tsx` com switch de permissao
9. Atualizar `create-user` edge function
10. Testar fluxo completo

