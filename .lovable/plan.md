

# Plano: Flexibilizar Lances Adicionais

## Resumo

Modificar a regra de lances para que, depois que um usuario ja tenha dado pelo menos um lance no leilao, ele possa dar lances de qualquer valor (desde que seja maior que o preco atual). O lance minimo com incremento obrigatorio so se aplica ao primeiro lance do usuario.

---

## Regra Atual vs Nova Regra

| Cenario | Regra Atual | Nova Regra |
|---------|-------------|------------|
| Primeiro lance do usuario no lote | >= current_price + min_bid_increment | >= current_price + min_bid_increment |
| Lances subsequentes do mesmo usuario | >= current_price + min_bid_increment | > current_price (qualquer valor) |

---

## Arquivos a Modificar

### 1. Funcao SQL `place_bid_atomic`

Alterar a validacao do valor minimo para verificar se o usuario ja deu lances anteriores:

```text
Logica atual:
  IF p_amount < (current_price + min_bid_increment) THEN
    RETURN erro

Nova logica:
  1. Verificar se usuario ja tem bids neste lote
  2. Se NAO tem bids anteriores:
     - Exigir p_amount >= current_price + min_bid_increment
  3. Se JA tem bids anteriores:
     - Exigir apenas p_amount > current_price
```

### 2. Frontend `BidPanel.tsx`

Alterar a logica de `minBid` para considerar se usuario ja deu lances:

```text
Logica atual:
  const minBid = current_price + min_bid_increment

Nova logica:
  1. Verificar se usuario ja tem bids neste lote (via prop ou query)
  2. Se JA tem bids: minBid = current_price + 0.01 (qualquer valor acima)
  3. Se NAO tem bids: minBid = current_price + min_bid_increment
```

### 3. Hook ou prop para status de participacao

Precisamos saber se o usuario ja tem bids no lote. Opcoes:

**Opcao A**: Passar via prop do `LotDetail.tsx` (ja busca bids)
**Opcao B**: Criar query simples no `BidPanel` para verificar

Recomendacao: **Opcao A** - reutilizar dados ja carregados

---

## Detalhes Tecnicos

### Migracao SQL

```sql
CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_lot_id uuid, 
  p_user_id uuid, 
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lot RECORD;
  v_user_has_previous_bids boolean;
  v_min_required_amount numeric;
  -- ... outras variaveis existentes
BEGIN
  -- ... validacoes existentes (lot exists, is live, not ended)

  -- NOVO: Verificar se usuario ja tem lances neste lote
  SELECT EXISTS (
    SELECT 1 FROM public.bids 
    WHERE lot_id = p_lot_id AND user_id = p_user_id
  ) INTO v_user_has_previous_bids;

  -- MODIFICADO: Calcular valor minimo baseado em participacao anterior
  IF v_user_has_previous_bids THEN
    -- Usuario ja participa: pode dar qualquer valor acima do atual
    v_min_required_amount := v_lot.current_price + 0.01;
    
    IF p_amount <= v_lot.current_price THEN
      RETURN jsonb_build_object(
        'error_code', 'BID_TOO_LOW',
        'error_message', format('Seu lance deve ser maior que %s', 
          to_char(v_lot.current_price, 'FM999G999G999D00'))
      );
    END IF;
  ELSE
    -- Primeiro lance: exigir incremento minimo
    v_min_required_amount := v_lot.current_price + v_lot.min_bid_increment;
    
    IF p_amount < v_min_required_amount THEN
      RETURN jsonb_build_object(
        'error_code', 'BID_TOO_LOW',
        'error_message', format('Lance mínimo é %s', 
          to_char(v_min_required_amount, 'FM999G999G999D00'))
      );
    END IF;
  END IF;

  -- ... resto da funcao permanece igual
END;
$$;
```

### Alteracoes no Frontend

**LotDetail.tsx** - Passar info de participacao:

```typescript
// Verificar se usuario atual ja tem bids
const userHasBids = bids?.some(bid => bid.user_id === user?.id) ?? false;

// Passar para BidPanel
<BidPanel 
  lot={lot} 
  userHasBids={userHasBids} 
  onBidPlaced={refetch} 
/>
```

**BidPanel.tsx** - Ajustar calculo do minBid:

```typescript
interface BidPanelProps {
  lot: Lot;
  userHasBids?: boolean; // NOVO
  onBidPlaced?: () => void;
}

// MODIFICADO: Calcular lance minimo
const minBid = userHasBids 
  ? Number(lot.current_price) + 0.01  // Qualquer valor acima
  : Number(lot.current_price) + Number(lot.min_bid_increment);  // Primeiro lance

// Ajustar label exibido
const minBidLabel = userHasBids 
  ? "Mínimo: qualquer valor acima do atual"
  : `Lance mínimo: ${formatCurrency(minBid)}`;
```

---

## UX Considerations

### Para usuarios que ja deram lance

1. Mostrar label diferente: "Voce ja participa deste leilao"
2. Placeholder do input: Mostrar preco atual + R$ 0,01
3. Botoes de incremento rapido: Manter, mas com base no preco atual

### Para primeiro lance

1. Manter comportamento atual
2. Exigir incremento minimo

---

## Resumo das Alteracoes

| Arquivo | Tipo | Alteracao |
|---------|------|-----------|
| Migracao SQL | Criar | Atualizar funcao `place_bid_atomic` |
| `src/pages/LotDetail.tsx` | Editar | Passar `userHasBids` para BidPanel |
| `src/components/auction/BidPanel.tsx` | Editar | Calcular minBid dinamico |

---

## Testes Necessarios

1. Primeiro lance de usuario novo: deve exigir incremento minimo
2. Segundo lance do mesmo usuario: aceitar qualquer valor > preco atual
3. Lance muito baixo (abaixo do preco atual): rejeitar
4. Validacao funciona tanto no frontend quanto no backend

