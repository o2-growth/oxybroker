

## Plan: Adicionar R$ 80.000 ao saldo do Marco Aurelio

Marco Aurelio (`c86a2580-f58c-4c66-b6ef-137b4807646f`) tem saldo atual de **R$ 0,00**.

### Ação

1. **Atualizar saldo da carteira** — Definir balance para 80000.00 na tabela `wallets`
2. **Registrar transação** — Inserir registro na tabela `wallet_transactions` com tipo `admin_adjust`, valor 80000, e descrição "Crédito manual de R$ 80.000"

Ambas operações serão feitas via SQL direto no banco de dados usando o service role.

