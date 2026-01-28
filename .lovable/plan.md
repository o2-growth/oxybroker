

# Plano: Saldo Sempre Visivel no Topo

## Resumo

Adicionar a exibicao do saldo da carteira no componente TopBar, garantindo que o usuario sempre veja seu saldo disponivel independente da pagina que esta navegando.

---

## Arquitetura da Solucao

```text
+------------------+
|     TopBar       |
+------------------+
|  Menu | R$ 500 | Notif | Theme |
+------------------+
         |
         v
+------------------+
|   useWallet()    |
|   (já existe)    |
+------------------+
         |
         v
+------------------+
|   wallets table  |
|   (RLS ok)       |
+------------------+
```

---

## Modificacoes no TopBar

### Layout Proposto

```text
Desktop:
+-----------------------------------------------+
| [Logo mobile] | Saldo: R$ 500,00 | [Bell][Theme] |
+-----------------------------------------------+

Mobile:
+-----------------------------------------------+
| [Menu] [Logo] | R$ 500 | [Bell][Theme] |
+-----------------------------------------------+
```

### Elementos a Adicionar

| Elemento | Descricao |
|----------|-----------|
| Saldo | Badge/Pill clicavel mostrando saldo formatado |
| Link | Ao clicar, navega para /wallet |
| Loading | Skeleton enquanto carrega |
| Icone | Wallet icon ao lado do valor |

---

## Fluxo de Dados

```text
1. TopBar renderiza
        |
        v
2. useWallet() busca dados
        |
        v
3. Exibe saldo formatado
        |
        v
4. Realtime updates via
   refetch quando necessario
```

---

## Detalhes Tecnicos

### Importar useWallet

O hook `useWallet` ja existe e retorna:
- `wallet.balance` - saldo atual
- `loading` - estado de carregamento
- `error` - erro se houver

### Formatacao

Usar `Intl.NumberFormat` para formatar moeda:
```text
R$ 1.234,56
```

### Estados Visuais

| Estado | Exibicao |
|--------|----------|
| Loading | Skeleton pequeno (w-20) |
| Logado | Badge com saldo + icone Wallet |
| Nao logado | Nao exibir nada |
| Erro | Exibir "---" |

---

## Codigo Proposto

```text
Componente: BalanceBadge (interno ao TopBar)

- Se !user: nao renderiza
- Se loading: Skeleton
- Se wallet: Link para /wallet com:
  - Icone Wallet (h-4 w-4)
  - Saldo formatado
  - Estilo: bg-muted/50 rounded-full px-3 py-1
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/TopBar.tsx` | Adicionar exibicao do saldo |

---

## Consideracoes de UX

### Posicionamento

O saldo ficara entre o logo mobile e os botoes de acao (notificacao/tema), garantindo visibilidade em qualquer dispositivo.

### Interatividade

Ao clicar no saldo, o usuario e redirecionado para a pagina da Carteira, permitindo acesso rapido a mais detalhes.

### Acessibilidade

- Tooltip mostrando "Ver carteira"
- Aria-label adequado no link
- Contraste de cores adequado

---

## Estilo Visual

Seguindo a estetica "Oxy Hacker":
- Fundo sutil (bg-muted/50)
- Bordas arredondadas (rounded-full)
- Tipografia compacta (text-sm font-mono)
- Cor primaria para o icone
- Hover state suave

---

## Ordem de Implementacao

1. Importar useWallet e Link no TopBar
2. Criar componente interno BalanceBadge
3. Posicionar entre logo mobile e botoes de acao
4. Adicionar Skeleton para loading
5. Adicionar Tooltip para acessibilidade
6. Testar em mobile e desktop

