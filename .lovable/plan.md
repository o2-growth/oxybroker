
# Plano: Validar Saldo Antes de Dar Lance

## Resumo

Adicionar validacao para garantir que o usuario so possa dar lances que nao ultrapassem seu saldo disponivel na carteira. A validacao sera feita tanto no backend (seguranca) quanto no frontend (UX).

---

## Arquitetura da Solucao

```text
+------------------+                +------------------+
|   BidPanel       |                |  Edge Function   |
|   (frontend)     | -------------> |  place-bid       |
+--------+---------+                +--------+---------+
         |                                   |
         v                                   v
+------------------+                +------------------+
|  Validacao 1:    |                |  Validacao 2:    |
|  Saldo < Lance?  |                |  place_bid_atomic|
|  Mostrar erro    |                |  (SQL function)  |
+------------------+                +------------------+
                                             |
                                             v
                                    +------------------+
                                    |  Validacao 3:    |
                                    |  Saldo >= Lance? |
                                    |  Dentro da TX    |
                                    +------------------+
```

---

## 1. Modificar Funcao SQL `place_bid_atomic`

### Logica a Adicionar

Antes de inserir o lance, verificar se o usuario tem saldo suficiente:

```text
1. Buscar wallet do usuario (SELECT balance FROM wallets WHERE user_id)
2. Se balance < p_amount:
   - Retornar erro: INSUFFICIENT_BALANCE
   - Mensagem: "Saldo insuficiente. Seu saldo: R$ X"
3. Continuar com o fluxo normal se saldo OK
```

### Posicao no Codigo

Adicionar validacao APOS verificar que o lote esta ativo e ANTES de inserir o lance.

---

## 2. Modificar Frontend `BidPanel.tsx`

### Importar useWallet

Usar o hook existente para obter saldo do usuario.

### Validacao no Cliente

Antes de chamar a API:
```text
if (amount > wallet?.balance) {
  toast({
    title: "Saldo insuficiente",
    description: `Seu saldo é ${formatCurrency(balance)}. Recarregue sua carteira.`
  });
  return;
}
```

### Exibir Saldo no Painel

Mostrar o saldo disponivel no componente para que o usuario saiba quanto pode gastar.

---

## Fluxo de Validacao

```text
1. Usuario digita valor do lance
          |
          v
2. Frontend verifica: lance <= saldo?
          |
   +------+------+
   |             |
   v             v
  NAO           SIM
   |             |
   v             v
Toast erro   Envia para API
(nao chama     |
 API)          v
          3. Edge Function recebe
                    |
                    v
          4. place_bid_atomic verifica
             novamente (seguranca)
                    |
             +------+------+
             |             |
             v             v
            NAO           SIM
             |             |
             v             v
          Retorna      Insere lance
          erro         com sucesso
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Alterar funcao `place_bid_atomic` para validar saldo |
| `src/components/auction/BidPanel.tsx` | Adicionar validacao de saldo e exibicao |

---

## Detalhes Tecnicos

### Migracao SQL

A funcao `place_bid_atomic` precisa ser atualizada via migracao:

```text
Adicionar ANTES da insercao do lance:

-- Validar saldo do usuario
DECLARE v_wallet RECORD;

SELECT balance INTO v_wallet
FROM public.wallets
WHERE user_id = p_user_id
FOR UPDATE; -- Lock para evitar race condition

IF v_wallet.balance IS NULL OR v_wallet.balance < p_amount THEN
  RETURN jsonb_build_object(
    'error_code', 'INSUFFICIENT_BALANCE',
    'error_message', format('Saldo insuficiente. Seu saldo: R$ %s', 
      COALESCE(to_char(v_wallet.balance, 'FM999G999D00'), '0,00'))
  );
END IF;
```

### BidPanel - Adicoes

```text
Importar: useWallet

Componente:
- Exibir saldo atual do usuario
- Validar antes de chamar placeBid()
- Mostrar botao para recarregar se saldo insuficiente
```

---

## Mensagens de Erro

| Cenario | Mensagem |
|---------|----------|
| Frontend | "Saldo insuficiente. Seu saldo é R$ X. Recarregue sua carteira." |
| Backend | "Saldo insuficiente. Seu saldo: R$ X" |

---

## UI Adicional

### Exibicao de Saldo no BidPanel

```text
+----------------------------------------+
|  Seu saldo: R$ 500,00                  |
+----------------------------------------+
|  Lance mínimo: R$ 150,00               |
|  [__________________] [Dar Lance]      |
+----------------------------------------+
```

### Indicador Visual

Se lance > saldo:
- Input com borda vermelha
- Texto de aviso
- Botao "Recarregar Carteira" visivel

---

## Seguranca

| Camada | Protecao |
|--------|----------|
| Frontend | Previne tentativas obvias (UX) |
| SQL Function | Validacao atomica com lock no saldo |
| Race condition | FOR UPDATE na wallet evita corridas |

---

## Ordem de Implementacao

1. Criar migracao SQL para atualizar `place_bid_atomic`
2. Modificar `BidPanel.tsx`:
   - Importar `useWallet`
   - Adicionar exibicao de saldo
   - Adicionar validacao pre-envio
   - Adicionar link para recarregar
3. Testar fluxo completo
