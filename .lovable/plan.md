
# Plano: Permitir Lances por Incremento

## Problema Identificado

O sistema atual espera que o usuário digite o **valor total do lance** (ex: R$ 6.051,00), mas o usuário está digitando o **incremento** que deseja adicionar (ex: R$ 51,00).

**Exemplo do bug:**
- Preço atual: R$ 6.000
- Usuário digita: `51` (querendo dar R$ 6.051)
- Sistema interpreta: lance de R$ 51 (inválido)
- Resultado: "Lance inválido. O lance mínimo é R$ 6.000,01"

## Solucao Proposta

Modificar o `BidPanel` para permitir que o usuario digite o **incremento** que deseja adicionar, e o sistema calcula o valor total automaticamente.

## Mudancas na Interface

```text
ANTES:
┌─────────────────────────────────────────┐
│  Lance mínimo: R$ 6.000,01              │
│  [ R$ 6.051,00        ] [Dar Lance]     │
└─────────────────────────────────────────┘

DEPOIS:
┌─────────────────────────────────────────┐
│  Valor atual: R$ 6.000,00               │
│                                         │
│  Adicionar: [ R$ 51,00    ]             │
│  Seu lance: R$ 6.051,00   [Dar Lance]   │
│                                         │
│  (+R$ 100) (+R$ 200) (+R$ 500)          │
└─────────────────────────────────────────┘
```

## Detalhes Tecnicos

### Alteracoes no BidPanel.tsx

1. **Novo estado para incremento**:
   - `bidIncrement` em vez de `bidAmount` (valor que o usuario digita)
   - `calculatedTotal` = `current_price + bidIncrement` (valor final do lance)

2. **Novo calculo de lance minimo**:
   - Para usuarios com lances anteriores: minimo = `R$ 0,01` (qualquer incremento)
   - Para primeiro lance: minimo = `min_bid_increment` do lote

3. **Validacao atualizada**:
   - Verifica se `calculatedTotal > current_price`
   - Verifica se `calculatedTotal <= balance`

4. **Botoes rapidos atualizados**:
   - Mostram incrementos fixos: +R$ 100, +R$ 200, +R$ 500, etc.
   - Baseados no `min_bid_increment` do lote

### Codigo Principal

```typescript
// Estado
const [bidIncrement, setBidIncrement] = useState("");
const incrementValue = parseCurrencyInput(bidIncrement);
const calculatedTotal = Number(lot.current_price) + incrementValue;

// Calculo do incremento minimo
const minIncrement = effectiveUserHasBids 
  ? 0.01  // Qualquer valor acima de zero
  : Number(lot.min_bid_increment);

// Validacao
const isValidBid = incrementValue >= minIncrement && calculatedTotal <= balance;

// Ao dar lance, envia calculatedTotal para a API
await placeBid(lot.id, calculatedTotal);
```

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/auction/BidPanel.tsx` | Mudar logica para incremento |

## Fluxo do Usuario

```text
1. Usuario ve preco atual: R$ 6.000
2. Usuario digita incremento: 51
3. Sistema mostra: "Seu lance: R$ 6.051,00"
4. Usuario clica "Dar Lance"
5. Sistema envia R$ 6.051,00 para API
6. Lance aceito!
```

## Validacao

Apos implementar:
1. Digitar "100" deve resultar em lance de (preco_atual + 100)
2. Botoes rapidos devem funcionar corretamente
3. Usuario com lance anterior pode digitar qualquer valor > 0
4. Primeiro lance deve respeitar incremento minimo do lote
