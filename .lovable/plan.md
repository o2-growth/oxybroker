

# Plano: Implementar Botão de Adicionar Saldo com Stripe Checkout

## Problema Identificado

O botão "Adicionar Saldo" na página da Carteira não possui nenhuma funcionalidade - falta o handler `onClick` e a edge function para criar a sessão de checkout do Stripe.

```text
SITUACAO ATUAL                          OBJETIVO
                                        
+------------------+                    +------------------+
|  Botão Adicionar |                    |  Botão Adicionar |
|  Saldo           |                    |  Saldo           |
|  (sem onClick)   |                    |  onClick ---------+
+------------------+                    +------------------+  |
                                                              v
                                        +------------------+  
                     FALTA              |  Edge Function   |
                     ----->             |  create-checkout |
                                        +--------+---------+
                                                 |
                                                 v
                                        +------------------+
                     JA EXISTE          |  Stripe Checkout |
                     ----->             |  (pagina Stripe) |
                                        +--------+---------+
                                                 |
                                                 v
                                        +------------------+
                     JA EXISTE          |  stripe-webhook  |
                     ----->             |  (credita saldo) |
                                        +------------------+
```

---

## Arquitetura da Solucao

```text
1. Usuario clica "Adicionar Saldo"
            |
            v
2. Modal abre para escolher valor
   [R$ 100] [R$ 250] [R$ 500] [Outro]
            |
            v
3. Frontend chama create-checkout
   POST /functions/v1/create-checkout
   { amount: 250 }
            |
            v
4. Edge Function cria sessao Stripe
   stripe.checkout.sessions.create({
     mode: 'payment',
     metadata: { type: 'wallet_topup', user_id: '...' }
   })
            |
            v
5. Retorna checkout URL
   { url: 'https://checkout.stripe.com/...' }
            |
            v
6. Frontend redireciona para Stripe
   window.location.href = url
            |
            v
7. Usuario paga no Stripe
            |
            v
8. Stripe envia webhook (ja existe)
            |
            v
9. Webhook credita saldo (ja existe)
```

---

## 1. Criar Edge Function `create-checkout`

| Aspecto | Detalhe |
|---------|---------|
| Endpoint | `POST /functions/v1/create-checkout` |
| Autenticacao | Requer JWT valido |
| Body | `{ amount: number }` (em BRL, nao centavos) |
| Retorno | `{ url: string }` |

### Logica

```text
1. Validar autenticacao (Authorization header)
2. Validar amount >= 10 e <= 10000
3. Criar sessao Stripe Checkout:
   - mode: 'payment'
   - line_items: produto dinamico com valor
   - success_url: /wallet?success=true
   - cancel_url: /wallet?cancelled=true
   - metadata: { type: 'wallet_topup', user_id: ... }
4. Retornar URL do checkout
```

---

## 2. Criar Hook `useTopUp`

| Funcao | Descricao |
|--------|-----------|
| `createCheckout(amount)` | Chama edge function e redireciona |
| `loading` | Estado de carregamento |

---

## 3. Criar Modal de Recarga

Componente com opcoes pre-definidas e campo personalizado:

| Valor | Botao |
|-------|-------|
| R$ 100 | Selecao rapida |
| R$ 250 | Selecao rapida |
| R$ 500 | Selecao rapida |
| R$ 1.000 | Selecao rapida |
| Outro | Input numerico |

---

## 4. Atualizar Pagina Wallet

- Conectar botao ao modal
- Exibir toast de sucesso/erro apos retorno
- Detectar query params `?success=true` ou `?cancelled=true`

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/create-checkout/index.ts` | Edge function para criar sessao Stripe |
| `src/hooks/useTopUp.ts` | Hook para gerenciar recarga |
| `src/components/wallet/TopUpModal.tsx` | Modal de selecao de valor |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Wallet.tsx` | Adicionar modal, handler do botao, detectar retorno |

---

## Detalhes Tecnicos

### Edge Function create-checkout

```text
Validacoes:
- amount >= 10 (minimo R$ 10)
- amount <= 10000 (maximo R$ 10.000)
- Usuario autenticado

Stripe Checkout Session:
- mode: 'payment'
- payment_method_types: ['card', 'boleto', 'pix']
- currency: 'brl'
- line_items: [{ price_data: {...}, quantity: 1 }]
- metadata: { type: 'wallet_topup', user_id: '...' }
- success_url: URL do app + /wallet?topup=success
- cancel_url: URL do app + /wallet?topup=cancelled
```

### Tratamento de Retorno

Quando usuario voltar do Stripe, detectar query params:

```text
?topup=success  -> Toast "Pagamento processado! Saldo sera atualizado em instantes"
?topup=cancelled -> Toast "Recarga cancelada"
```

---

## Seguranca

- JWT obrigatorio na edge function
- Validacao de valores minimo/maximo
- Metadata com user_id do JWT (nao do request body)
- Webhook ja tem idempotencia implementada

---

## Ordem de Implementacao

1. Criar edge function `create-checkout`
2. Criar hook `useTopUp`
3. Criar componente `TopUpModal`
4. Integrar na pagina Wallet
5. Testar fluxo completo

