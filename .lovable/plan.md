
# Plano: Validar Saldo Apenas pelo Incremento do Lance

## Problema

O sistema atualmente exige que o saldo cubra o **valor total** do lance. No exemplo do usuário:
- Preço atual: R$ 6.000
- Lance desejado: R$ 6.000,01
- Saldo: R$ 500
- **Erro**: "Saldo insuficiente" (porque 500 < 6.000,01)

O usuário quer que o sistema valide apenas o **incremento** (R$ 0,01), não o valor total.

---

## Nova Regra de Negocio

**Primeiro lance**: Saldo deve cobrir o valor total do lance (evita participantes sem capacidade)

**Lances subsequentes**: Saldo deve cobrir apenas a **diferenca** entre o novo lance e o maior lance anterior do usuario

```text
Exemplo (lance subsequente):
- Lance anterior do usuario: R$ 5.500
- Novo lance: R$ 6.000,01
- Diferenca: R$ 500,01
- Saldo necessario: R$ 500,01 (nao R$ 6.000,01)
```

---

## Mudancas no Backend (SQL)

### 1. Atualizar funcao `place_bid_atomic`

Calcular o lance anterior do usuario e validar apenas a diferenca:

```sql
-- Buscar maior lance anterior do usuario neste lote
SELECT MAX(amount) INTO v_user_previous_max_bid
FROM public.bids
WHERE lot_id = p_lot_id AND user_id = p_user_id;

-- Calcular incremento necessario
IF v_user_previous_max_bid IS NOT NULL THEN
  v_required_balance := p_amount - v_user_previous_max_bid;
  IF v_required_balance < 0 THEN v_required_balance := 0; END IF;
ELSE
  v_required_balance := p_amount; -- Primeiro lance: valor total
END IF;

-- Validar saldo pelo incremento
IF v_wallet.balance < v_required_balance THEN
  RETURN jsonb_build_object('error_code', 'INSUFFICIENT_BALANCE', ...);
END IF;
```

### 2. Atualizar funcao `close_auction_atomic`

Implementar fallback para proximo lance quando vencedor nao tem saldo:

```sql
-- Loop para tentar proximos lances
LOOP
  SELECT * INTO v_current_bid FROM public.bids
  WHERE lot_id = p_lot_id
  ORDER BY amount DESC LIMIT 1 OFFSET v_fallback_offset;

  IF v_current_bid IS NULL THEN EXIT; END IF;

  -- Calcular saldo necessario (diferenca)
  SELECT MAX(amount) INTO v_user_previous_max
  FROM public.bids
  WHERE lot_id = p_lot_id 
    AND user_id = v_current_bid.user_id 
    AND id != v_current_bid.id;

  v_required := COALESCE(v_current_bid.amount - v_user_previous_max, v_current_bid.amount);

  -- Verificar saldo
  SELECT balance INTO v_wallet FROM public.wallets
  WHERE user_id = v_current_bid.user_id FOR UPDATE;

  IF v_wallet.balance >= v_required THEN
    -- Processar como vencedor
    EXIT;
  END IF;

  -- Notificar usuario sem saldo e tentar proximo
  v_fallback_offset := v_fallback_offset + 1;
END LOOP;
```

---

## Mudancas no Frontend

### 1. Atualizar `BidPanel.tsx`

Calcular o saldo necessario considerando lances anteriores:

```typescript
// Buscar maior lance anterior do usuario (precisa de nova query)
const userPreviousMaxBid = ...; // via RPC ou prop

// Calcular saldo necessario
const requiredBalance = userPreviousMaxBid > 0
  ? Math.max(0, calculatedTotal - userPreviousMaxBid)
  : calculatedTotal;

// Validacao atualizada
const hasInsufficientBalance = requiredBalance > balance;
```

### 2. Criar nova funcao RPC

Buscar maior lance do usuario em um lote:

```sql
CREATE FUNCTION public.get_user_max_bid_on_lot(_lot_id uuid)
RETURNS numeric AS $$
  SELECT COALESCE(MAX(amount), 0)
  FROM public.bids
  WHERE lot_id = _lot_id AND user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;
```

### 3. Criar hook `useUserMaxBidOnLot`

```typescript
export function useUserMaxBidOnLot(lotId: string) {
  const [maxBid, setMaxBid] = useState<number>(0);
  
  useEffect(() => {
    supabase.rpc("get_user_max_bid_on_lot", { _lot_id: lotId })
      .then(({ data }) => setMaxBid(data ?? 0));
  }, [lotId]);

  return maxBid;
}
```

---

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| Nova migration SQL | Adicionar funcao `get_user_max_bid_on_lot` |
| Nova migration SQL | Atualizar `place_bid_atomic` |
| Nova migration SQL | Atualizar `close_auction_atomic` com fallback |
| `src/hooks/useUserMaxBidOnLot.ts` | Criar hook |
| `src/components/auction/BidPanel.tsx` | Atualizar validacao de saldo |

---

## Fluxo Atualizado

```text
PRIMEIRO LANCE:
  Usuario: saldo R$ 500, quer dar lance de R$ 500
  Validacao: 500 >= 500 -> OK

LANCE SUBSEQUENTE:
  Usuario: saldo R$ 500, lance anterior R$ 5.500, quer dar R$ 6.000
  Diferenca: 6.000 - 5.500 = R$ 500
  Validacao: 500 >= 500 -> OK

ENCERRAMENTO (fallback):
  Vencedor: lance R$ 6.000, saldo R$ 300, lance anterior R$ 5.500
  Diferenca: 500, saldo: 300 -> SEM SALDO
  Acao: Notificar, tentar proximo lance (R$ 5.900)
  Proximo: lance R$ 5.900, saldo R$ 600, lance anterior R$ 5.400
  Diferenca: 500, saldo: 600 -> OK, processar como vencedor
```

---

## Validacao

Apos implementar:
1. Usuario com R$ 500 pode aumentar lance de R$ 5.500 para R$ 6.000
2. Primeiro lance ainda exige saldo total
3. No encerramento, sistema tenta proximo lance se vencedor nao tem saldo
4. Notificacoes enviadas para usuarios sem saldo no encerramento
