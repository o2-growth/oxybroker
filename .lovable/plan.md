
# Plano: Sistema de Descontos e Cashback Configuravel

## Visao Geral

Sistema completo de promocoes onde o admin pode configurar descontos e cashback para recargas, lances e compras. Suporta elegibilidade global, por categoria e por usuario individual, com agendamento pontual e recorrente.

---

## Estrutura de Dados

### Nova Tabela: `promotions`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Identificador |
| name | text | Nome da promocao (ex: "Black Friday") |
| description | text | Descricao opcional |
| type | enum | `discount` ou `cashback` |
| applies_to | enum | `topup`, `bid`, `purchase` |
| benefit_type | enum | `percentage` ou `fixed` |
| benefit_value | numeric | Valor (ex: 10 para 10% ou 50 para R$50) |
| min_amount | numeric | Valor minimo para aplicar (opcional) |
| max_benefit | numeric | Limite maximo do beneficio (opcional) |
| eligibility | enum | `global`, `category`, `individual` |
| is_active | boolean | Se esta habilitada |
| created_by | uuid | Admin que criou |
| created_at | timestamp | Data criacao |

### Nova Tabela: `promotion_schedules`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Identificador |
| promotion_id | uuid | FK para promotions |
| schedule_type | enum | `one_time` ou `recurring` |
| starts_at | timestamp | Inicio (para one_time) |
| ends_at | timestamp | Fim (para one_time) |
| days_of_week | integer[] | Dias da semana (0=dom, 1=seg...) |
| start_time | time | Hora de inicio (para recorrente) |
| end_time | time | Hora de fim (para recorrente) |

### Nova Tabela: `promotion_eligibility`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Identificador |
| promotion_id | uuid | FK para promotions |
| category_id | uuid | FK para franchise_categories (null = individual) |
| user_id | uuid | FK para profiles (null = categoria) |

### Nova Tabela: `promotion_usage`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | Identificador |
| promotion_id | uuid | FK para promotions |
| user_id | uuid | Usuario que usou |
| original_amount | numeric | Valor original |
| benefit_amount | numeric | Valor do beneficio aplicado |
| reference_type | text | Tipo (topup, bid, purchase) |
| reference_id | text | ID da transacao |
| created_at | timestamp | Data de uso |

---

## Fluxo de Aplicacao

### 1. Recargas (Top-up)

```text
Usuario recarrega R$ 100
  ├─ Sistema verifica promocoes ativas para 'topup'
  ├─ Encontra: "Bonus 15% nas recargas"
  ├─ Calcula: R$ 100 + R$ 15 (bonus) = R$ 115
  └─ Credita R$ 115 na carteira
```

**Alteracoes:**
- `stripe-webhook`: Verificar promocoes antes de creditar
- Criar funcao `calculate_promotion_benefit(user_id, amount, applies_to)`

### 2. Lances (Bid)

```text
Usuario da lance de R$ 1.000
  ├─ Sistema verifica promocoes ativas para 'bid'
  ├─ Encontra: "10% de desconto em lances"
  ├─ Calcula: Debita apenas R$ 900 (R$ 1.000 - 10%)
  └─ Lance registrado como R$ 1.000
```

**Alteracoes:**
- `place_bid_atomic`: Aplicar desconto no debito do saldo

### 3. Cashback Pos-Compra

```text
Usuario vence leilao de R$ 5.000
  ├─ Sistema verifica promocoes ativas para 'purchase'
  ├─ Encontra: "5% cashback"
  ├─ Calcula: R$ 250 de cashback
  └─ Credita R$ 250 na carteira apos confirmacao
```

**Alteracoes:**
- `close_auction_atomic`: Creditar cashback apos debito
- `buy_now_atomic`: Creditar cashback apos compra

---

## Interface do Admin

### Nova Pagina: `/admin/promotions`

```text
┌─────────────────────────────────────────────────────────────┐
│  🎁 Promocoes                           [+ Nova Promocao]   │
├─────────────────────────────────────────────────────────────┤
│  Filtros: [Tipo ▼] [Aplicacao ▼] [Status ▼]                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟢 Black Friday                                         ││
│  │    Cashback 10% em compras                              ││
│  │    Global • 25/11 00:00 ate 30/11 23:59                 ││
│  │    Uso: 47 vezes • R$ 2.350 concedidos                  ││
│  │    [Editar] [Pausar] [Excluir]                          ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🟢 Happy Hour Recarga                                   ││
│  │    Bonus 15% fixo nas recargas                          ││
│  │    Categoria: Premium • Sex 18h-22h                     ││
│  │    Uso: 12 vezes • R$ 180 concedidos                    ││
│  │    [Editar] [Pausar] [Excluir]                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Modal: Criar/Editar Promocao

```text
┌─────────────────────────────────────────────────────────────┐
│  Nova Promocao                                     [X]      │
├─────────────────────────────────────────────────────────────┤
│  Nome: [_______________________]                            │
│  Descricao: [______________________]                        │
│                                                             │
│  ┌─ Tipo do Beneficio ─────────────────────────────────────┐│
│  │ (●) Desconto    ( ) Cashback                            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Onde Aplicar ──────────────────────────────────────────┐│
│  │ [ ] Recargas (top-up)                                   ││
│  │ [ ] Lances                                              ││
│  │ [ ] Compras (encerramento/compra imediata)              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Valor ─────────────────────────────────────────────────┐│
│  │ (●) Percentual: [10] %                                  ││
│  │ ( ) Valor fixo: R$ [___]                                ││
│  │ Valor minimo: R$ [100]  Limite maximo: R$ [500]         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Elegibilidade ─────────────────────────────────────────┐│
│  │ (●) Global (todos os usuarios)                          ││
│  │ ( ) Por categoria: [Premium        ▼]                   ││
│  │ ( ) Usuarios especificos: [Selecionar...]               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Agendamento ───────────────────────────────────────────┐│
│  │ (●) Periodo unico                                       ││
│  │     Inicio: [01/02/2026 10:00]                          ││
│  │     Fim:    [05/02/2026 18:00]                          ││
│  │                                                         ││
│  │ ( ) Recorrente                                          ││
│  │     Dias: [ ] Seg [X] Sex [ ] Sab                       ││
│  │     Horario: [18:00] ate [22:00]                        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│                              [Cancelar] [Salvar Promocao]   │
└─────────────────────────────────────────────────────────────┘
```

---

## Visualizacao para Usuario

### Na Pagina de Recarga (TopUpModal)

```text
┌─────────────────────────────────────────────────────────────┐
│  Valor: R$ [100,00]                                         │
│                                                             │
│  🎁 Promocao ativa: Bonus 15%                               │
│     Voce recebera: R$ 115,00                                │
│                                                             │
│                                      [Continuar Recarga]    │
└─────────────────────────────────────────────────────────────┘
```

### No Painel de Lances (BidPanel)

```text
┌─────────────────────────────────────────────────────────────┐
│  Adicionar: [+ R$ 100]                                      │
│  Seu lance: R$ 6.100,00                                     │
│                                                             │
│  🎁 Desconto 10% aplicado!                                  │
│     Debito real: R$ 5.490,00 (economia de R$ 610)           │
│                                                             │
│                                            [Dar Lance]      │
└─────────────────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### Nova Funcao SQL: `get_active_promotion`

```sql
CREATE FUNCTION get_active_promotion(
  p_user_id uuid,
  p_applies_to text,
  p_amount numeric
) RETURNS TABLE (
  promotion_id uuid,
  name text,
  benefit_type text,
  benefit_value numeric,
  max_benefit numeric
) AS $$
  -- Verifica promocoes ativas
  -- Considera elegibilidade (global, categoria, individual)
  -- Verifica agendamento (one_time ou recurring)
  -- Retorna a melhor promocao aplicavel
$$ LANGUAGE sql SECURITY DEFINER;
```

### Nova Funcao SQL: `calculate_benefit`

```sql
CREATE FUNCTION calculate_benefit(
  p_promotion_id uuid,
  p_original_amount numeric
) RETURNS numeric AS $$
  -- Calcula o valor do beneficio
  -- Respeita min_amount e max_benefit
$$ LANGUAGE sql SECURITY DEFINER;
```

### Alteracoes em Funcoes Existentes

1. **stripe-webhook** (Edge Function)
   - Chamar `get_active_promotion` para 'topup'
   - Calcular bonus e creditar valor total

2. **place_bid_atomic** (SQL)
   - Verificar promocao para 'bid'
   - Aplicar desconto no calculo de saldo necessario

3. **close_auction_atomic** (SQL)
   - Verificar promocao para 'purchase'
   - Creditar cashback apos debito

4. **buy_now_atomic** (SQL)
   - Verificar promocao para 'purchase'
   - Creditar cashback apos compra

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas promotions, schedules, eligibility, usage |
| Migration SQL | Criar funcoes get_active_promotion, calculate_benefit |
| Migration SQL | Atualizar place_bid_atomic, close_auction_atomic, buy_now_atomic |
| `supabase/functions/stripe-webhook/index.ts` | Aplicar bonus em recargas |
| `src/pages/admin/AdminPromotions.tsx` | Nova pagina de gestao |
| `src/hooks/usePromotions.ts` | CRUD de promocoes |
| `src/hooks/useActivePromotion.ts` | Verificar promocao ativa para usuario |
| `src/components/wallet/TopUpModal.tsx` | Mostrar bonus ativo |
| `src/components/auction/BidPanel.tsx` | Mostrar desconto ativo |
| `src/components/layout/Sidebar.tsx` | Adicionar link para promocoes |

---

## Politicas RLS

```sql
-- Admins podem gerenciar promocoes
CREATE POLICY promotions_admin ON promotions
  FOR ALL USING (is_admin());

-- Usuarios podem ver promocoes ativas
CREATE POLICY promotions_select ON promotions
  FOR SELECT USING (is_active = true);

-- Historico de uso restrito ao proprio usuario
CREATE POLICY usage_select_own ON promotion_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Admins veem todo o historico
CREATE POLICY usage_select_admin ON promotion_usage
  FOR SELECT USING (is_admin());
```

---

## Validacao

Apos implementar:
1. Admin cria promocao global de 10% bonus em recargas
2. Usuario recarrega R$ 100 e recebe R$ 110
3. Admin cria promocao recorrente (sex 18h-22h) com 5% desconto em lances
4. Usuario da lance na sexta e ve desconto aplicado
5. Admin cria cashback 5% para categoria Premium
6. Usuario Premium vence leilao e recebe cashback
7. Historico de uso registra todas as aplicacoes
