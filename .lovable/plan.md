

# Plano: Corrigir Validação de Lances Adicionais

## Problema Identificado

O usuário reporta que não consegue dar um lance adicional em um lote onde já participou. De acordo com a regra de negócio:
- **Primeiro lance**: deve respeitar o incremento mínimo (`current_price + min_bid_increment`)
- **Lances subsequentes**: só precisam ser maiores que o preço atual

## Análise da Situação Atual

### Backend (Correto)
A função `place_bid_atomic` no banco de dados JÁ implementa corretamente essa lógica:

```text
┌─────────────────────────────────────────────────────────────┐
│  place_bid_atomic                                           │
│  ─────────────────────────────────────────────────          │
│  1. Verifica se usuário tem lances anteriores               │
│  2. Se SIM: aceita amount > current_price                   │
│  3. Se NÃO: exige amount >= current_price + min_increment   │
└─────────────────────────────────────────────────────────────┘
```

### Frontend (Correto)
O `BidPanel.tsx` também implementa corretamente:

```typescript
const minBid = userHasBids 
  ? Number(lot.current_price) + 0.01  // Qualquer valor acima do atual
  : Number(lot.current_price) + Number(lot.min_bid_increment);
```

### Problema Real

Analisando os dados:
- **Saldo do usuário**: R$ 500
- **Preço atual do lote**: R$ 6.000
- **Lance mínimo válido**: R$ 6.000,01 (para quem já tem lances)

O usuário está tentando valores como "51" e "07", que são interpretados como R$ 51 e R$ 7 - muito abaixo do lance mínimo.

**Mas o saldo é R$ 500** - mesmo se tentar R$ 6.001, seria rejeitado por saldo insuficiente!

## Bug Encontrado

O bug está na prop `userHasBids` sendo passada para o `BidPanel`. Ela depende de `lot.bids`, que pode estar:
1. Vazio se a política RLS não retornar os dados
2. Causando `userHasBids = false` mesmo quando o usuário tem lances

### Verificação do RLS

A política `bids_select_lot_participants` usa `user_has_bid_on_lot()`. Se esta função retorna `false` por algum motivo (timing, cache), o usuário não vê seus próprios lances.

## Solução Proposta

### 1. Verificação Direta no BidPanel

Em vez de confiar na prop `userHasBids`, fazer uma verificação direta:

```text
┌─────────────────────────────────────────────────────────────┐
│  BidPanel (atualizado)                                      │
│  ─────────────────────────────────────────────────          │
│  1. Receber userHasBids como prop                           │
│  2. Adicionar verificação local com useEffect               │
│  3. Usar estado combinado para determinar minBid            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Criar Hook de Verificação de Participação

Criar um novo hook `useUserHasBidOnLot` que faz uma RPC call direta para `user_has_bid_on_lot`:

```typescript
// hooks/useUserHasBidOnLot.ts
export function useUserHasBidOnLot(lotId: string) {
  const [hasBid, setHasBid] = useState<boolean | null>(null);
  
  useEffect(() => {
    supabase.rpc("user_has_bid_on_lot", { _lot_id: lotId })
      .then(({ data }) => setHasBid(!!data));
  }, [lotId]);
  
  return hasBid;
}
```

### 3. Atualizar BidPanel

```typescript
// BidPanel.tsx
const userHasBidsViaRPC = useUserHasBidOnLot(lot.id);
const effectiveUserHasBids = userHasBids || userHasBidsViaRPC;

const minBid = effectiveUserHasBids 
  ? Number(lot.current_price) + 0.01 
  : Number(lot.current_price) + Number(lot.min_bid_increment);
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useUserHasBidOnLot.ts` | Criar hook para verificar participação via RPC |
| `src/components/auction/BidPanel.tsx` | Usar o novo hook como fallback |
| `src/pages/LotDetail.tsx` | Manter passagem da prop como otimização |

---

## Fluxo Atualizado

```text
┌───────────────────────────────────────────────────────────────────┐
│                       Fluxo de Validação de Lance                  │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Usuário acessa lote                                           │
│     └──> useLotDetail carrega bids (pode falhar RLS)              │
│                                                                    │
│  2. BidPanel renderiza                                            │
│     ├──> Recebe userHasBids da prop (lot.bids.some)               │
│     └──> useUserHasBidOnLot faz RPC direto (garantido)            │
│                                                                    │
│  3. Cálculo de minBid                                             │
│     └──> Usa effectiveUserHasBids (prop OU rpc)                   │
│                                                                    │
│  4. Validação frontend                                            │
│     ├──> amount >= minBid                                         │
│     └──> amount <= balance                                        │
│                                                                    │
│  5. place-bid Edge Function                                       │
│     └──> place_bid_atomic (validação final)                       │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Validação

Após implementar:
1. Usuário com lance anterior pode dar qualquer valor > preço atual
2. Usuário sem lance anterior precisa respeitar incremento mínimo
3. Validação funciona mesmo se RLS não retornar bids na lista

