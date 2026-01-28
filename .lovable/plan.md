

# Plano: Adicionar Saldo Manual pelo Admin

## Resumo

Implementar funcionalidade para que administradores possam adicionar saldo na carteira de qualquer usuario sem necessidade de pagamento. O sistema ja possui o tipo de transacao `admin_adjust` no enum, facilitando a implementacao.

---

## Arquitetura da Solucao

```text
+------------------+                +------------------+
|  AdminUsers      |                |  Edge Function   |
|  [Adicionar      | -------------> |  admin-adjust-   |
|   Saldo]         |                |  balance         |
+--------+---------+                +--------+---------+
         |                                   |
         v                                   v
+------------------+                +------------------+
|  Modal com       |                |  Operacoes:      |
|  - Selecao user  |                |  1. Valida admin |
|  - Valor (+/-)   |                |  2. Atualiza     |
|  - Motivo        |                |     wallets      |
+------------------+                |  3. Insere tx    |
                                    +------------------+
```

---

## Fluxo de Uso

```text
1. Admin acessa Gestao de Usuarios
          |
          v
2. Clica no menu de acoes de um usuario
          |
          v
3. Seleciona "Adicionar Saldo"
          |
          v
4. Modal abre com:
   - Nome do usuario (readonly)
   - Campo de valor (aceita + ou -)
   - Campo de motivo/descricao
          |
          v
5. Admin confirma
          |
          v
6. Edge Function valida e executa:
   - Verifica se chamador e admin
   - Atualiza saldo na wallet
   - Registra transacao tipo admin_adjust
          |
          v
7. Toast de sucesso
```

---

## 1. Criar Edge Function `admin-adjust-balance`

| Aspecto | Detalhe |
|---------|---------|
| Endpoint | `POST /functions/v1/admin-adjust-balance` |
| Autenticacao | JWT obrigatorio + verificacao de role admin |
| Body | `{ user_id, amount, reason }` |

### Logica

```text
1. Verificar JWT e extrair admin_id
2. Verificar se chamador tem role admin (via has_role)
3. Validar user_id existe
4. Validar amount != 0
5. Buscar wallet do usuario alvo
6. Calcular novo saldo (pode ficar negativo? nao - validar)
7. Atualizar balance na tabela wallets
8. Inserir wallet_transaction com:
   - type: 'admin_adjust'
   - amount: valor absoluto
   - description: motivo informado
   - reference_type: 'admin_adjustment'
   - reference_id: admin_id (quem fez)
9. Retornar sucesso com novo saldo
```

---

## 2. Criar Hook `useAdminAdjustBalance`

```text
interface:
  adjustBalance(userId: string, amount: number, reason: string): Promise<Result>
  loading: boolean
```

---

## 3. Criar Modal `AdminAdjustBalanceModal`

Componente modal com:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Usuario | Texto readonly | Nome e email do usuario selecionado |
| Valor | Input numerico | Valor a adicionar (positivo) |
| Motivo | Textarea | Descricao obrigatoria do ajuste |

Regras:
- Valor minimo: R$ 1,00
- Valor maximo: R$ 100.000,00
- Motivo obrigatorio (min 5 caracteres)

---

## 4. Modificar AdminUsers

Adicionar nova opcao no menu dropdown de acoes:

```text
DropdownMenuContent:
  - Editar
  - Adicionar Saldo  <-- NOVO
  - Suspender/Reativar
  - Excluir
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/admin-adjust-balance/index.ts` | Edge function para ajuste |
| `src/hooks/useAdminAdjustBalance.ts` | Hook para chamar a edge function |
| `src/components/admin/AdminAdjustBalanceModal.tsx` | Modal de ajuste de saldo |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/admin/AdminUsers.tsx` | Adicionar opcao no menu e modal |
| `supabase/config.toml` | Registrar nova edge function |

---

## Detalhes Tecnicos

### Edge Function - Validacoes

```text
Seguranca:
- JWT obrigatorio
- Verificar has_role(caller_id, 'admin')
- Nao permitir ajuste em si mesmo (opcional)

Dados:
- user_id: UUID valido
- amount: numero > 0
- reason: string com 5-500 caracteres

Saldo:
- Novo saldo nao pode ficar negativo
- Se amount > saldo atual, retornar erro
```

### Estrutura da Transacao

```text
{
  user_id: "uuid-do-usuario-alvo",
  type: "admin_adjust",
  amount: 500.00,  // sempre positivo no registro
  description: "Bonus por indicacao",
  reference_type: "admin_adjustment",
  reference_id: "uuid-do-admin-que-fez"
}
```

### Modal - Validacao Frontend

```text
- Valor: required, min 1, max 100000
- Motivo: required, minLength 5, maxLength 500
- Botao desabilitado ate validacoes passarem
```

---

## Seguranca

| Camada | Protecao |
|--------|----------|
| Frontend | Pagina protegida por useRoleGuard("admin") |
| Edge Function | Valida JWT + has_role('admin') |
| RLS | Politicas ja permitem admin atualizar wallets |

---

## Tipo de Transacao Existente

O enum `wallet_transaction_type` ja possui o valor `admin_adjust`:

```text
wallet_transaction_type:
  - topup
  - debit_purchase
  - credit_refund
  - transfer_in
  - transfer_out
  - admin_adjust   <-- JA EXISTE
  - withdrawal
```

Nao precisa de migracao SQL.

---

## Registro de Auditoria

Cada ajuste fica registrado na tabela `wallet_transactions` com:
- Valor do ajuste
- Descricao/motivo
- ID do admin que realizou (em reference_id)
- Tipo `admin_adjust` para facil filtragem

---

## UI na Pagina Wallet

O tipo `admin_adjust` ja esta mapeado no frontend (Wallet.tsx):

```text
admin_adjust: {
  label: "Ajuste Admin",
  icon: RefreshCw,
  className: "text-oxy-info",
}
```

O usuario vera o ajuste no extrato automaticamente.

---

## Ordem de Implementacao

1. Criar edge function `admin-adjust-balance`
2. Registrar em `supabase/config.toml`
3. Criar hook `useAdminAdjustBalance`
4. Criar modal `AdminAdjustBalanceModal`
5. Integrar modal na pagina `AdminUsers`
6. Testar fluxo completo

