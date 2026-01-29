
# Plano: Corrigir Recursão Infinita na Política RLS de Bids

## Problema Identificado

Ao acessar um lote pela tela de marketplace, o sistema exibe o erro:
> "infinite recursion detected in policy for relation bids"

### Causa Raiz
A política RLS `bids_select_lot_participants` contém uma subconsulta que referencia a própria tabela `bids`:

```sql
lot_id IN (SELECT b.lot_id FROM public.bids b WHERE b.user_id = auth.uid())
```

Isso cria um loop infinito: para verificar se o usuário pode ver um lance, o PostgreSQL precisa consultar a tabela `bids`, que por sua vez dispara a mesma verificação de política.

---

## Solução

Criar uma função `SECURITY DEFINER` que contorna o RLS para verificar se o usuário já deu lance em um determinado lote, e usar essa função na política.

---

## Etapas de Implementação

### 1. Criar Função `user_has_bid_on_lot`

Uma nova função SQL com `SECURITY DEFINER` que verifica, sem passar pelo RLS, se o usuário atual possui lances em um determinado lote.

```text
┌─────────────────────────────────────────────────────────────┐
│  public.user_has_bid_on_lot(_lot_id UUID)                   │
│  ─────────────────────────────────────────────────          │
│  • SECURITY DEFINER (bypass RLS)                            │
│  • Retorna TRUE se auth.uid() tem lance no lote             │
│  • Segura: apenas verifica existência, sem expor dados      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Recriar Política RLS `bids_select_lot_participants`

Substituir a política atual por uma versão que usa a nova função:

```text
ANTES (recursivo):
  lot_id IN (SELECT b.lot_id FROM bids b WHERE b.user_id = auth.uid())

DEPOIS (seguro):
  public.user_has_bid_on_lot(lot_id)
```

### 3. Testar Acesso

Após a migração, usuários poderão:
- Ver lances de lotes nos quais já participaram
- Administradores e oxy_hackers continuam com acesso total
- Usuários sem lances no lote não verão os lances (comportamento esperado de "sealed-bid")

---

## Detalhes Técnicos

### Migração SQL

```sql
-- 1. Criar função SECURITY DEFINER para verificar participação
CREATE OR REPLACE FUNCTION public.user_has_bid_on_lot(_lot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bids
    WHERE lot_id = _lot_id
      AND user_id = auth.uid()
  )
$$;

-- 2. Recriar política sem recursão
DROP POLICY IF EXISTS "bids_select_lot_participants" ON public.bids;

CREATE POLICY "bids_select_lot_participants"
ON public.bids
FOR SELECT
USING (
  public.user_has_bid_on_lot(lot_id)
  OR public.is_admin()
  OR public.is_oxy_hacker()
);
```

### Por que isso funciona?

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Consulta interna | SELECT na mesma tabela → recursão | Função SECURITY DEFINER → bypass RLS |
| Performance | Falha | Execução normal |
| Segurança | Não funcional | Mantém restrição de visibilidade |

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/[nova].sql` | Criar função e recriar política |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |

---

## Validação

Após aplicar:
1. Acessar `/marketplace` e clicar em qualquer lote
2. A página de detalhes do lote deve carregar sem erro
3. Os lances devem aparecer apenas se o usuário logado tiver participado daquele lote
