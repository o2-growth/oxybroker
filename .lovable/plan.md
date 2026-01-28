

# Plano: Corrigir Redirecionamento para Stripe Checkout

## Problema Identificado

O checkout do Stripe nao abre porque o `window.location.href` nao funciona corretamente quando a aplicacao esta rodando dentro de um iframe (preview do Lovable). O navegador bloqueia a navegacao para dominios externos por questoes de seguranca.

### Evidencia nos Logs
```text
POST /functions/v1/create-checkout -> Status 200
Response: { "url": "https://checkout.stripe.com/..." }

>> URL retornada corretamente, mas redirecionamento bloqueado pelo iframe
```

---

## Solucao

Modificar o hook `useTopUp.ts` para usar `window.open()` ao inves de `window.location.href`, abrindo o Stripe Checkout em uma nova aba.

### Vantagens desta abordagem

| Aspecto | window.location.href | window.open() |
|---------|---------------------|---------------|
| Iframe preview | Bloqueado | Funciona |
| Producao | Funciona | Funciona |
| UX | Mesma aba | Nova aba |
| Popups | Sem bloqueio | Pode ser bloqueado* |

*Nota: `window.open()` chamado dentro de um handler de clique do usuario geralmente nao e bloqueado.

---

## Modificacao no `useTopUp.ts`

**Antes (linha 38)**:
```typescript
window.location.href = data.url;
```

**Depois**:
```typescript
// Abre em nova aba para funcionar no iframe de preview
const checkoutWindow = window.open(data.url, "_blank");

// Fallback: se popup bloqueado, tenta redirecionamento direto
if (!checkoutWindow || checkoutWindow.closed) {
  window.location.href = data.url;
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useTopUp.ts` | Usar window.open() com fallback para location.href |

---

## Detalhes Tecnicos

### Por que window.open() funciona no iframe

Quando `window.open()` e chamado com `_blank`, o navegador abre uma nova aba que esta fora do contexto do iframe, permitindo navegar para qualquer dominio.

### Seguranca de Popups

Como a chamada `window.open()` acontece dentro de um handler de clique do usuario (botao "Continuar para pagamento"), o navegador reconhece como uma acao intencional e nao bloqueia.

```text
Usuario clica botao
        |
        v
handleSubmit() executa
        |
        v
createCheckout() chama API
        |
        v
window.open() dentro do mesmo stack de eventos
        |
        v
Navegador permite (nao e popup malicioso)
```

---

## Consideracoes de UX

Apos a mudanca, o fluxo sera:

```text
1. Usuario clica "Continuar para pagamento"
2. Nova aba abre com Stripe Checkout
3. Usuario completa pagamento
4. Stripe redireciona para /wallet?topup=success na nova aba
5. Toast de sucesso exibido
6. Usuario pode fechar a aba original do modal
```

O modal na aba original continuara mostrando "Processando..." ate o usuario voltar. Podemos melhorar isso futuramente com polling ou WebSocket, mas por ora o fluxo funciona.

---

## Ordem de Implementacao

1. Modificar `useTopUp.ts` para usar `window.open()`
2. Adicionar fallback para `window.location.href`
3. Resetar estado de loading apos abrir a aba (para UX melhor)
4. Testar no preview

