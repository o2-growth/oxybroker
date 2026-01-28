
# Plano: Corrigir Redirecionamento da Carteira

## Problema Identificado

A pagina da Carteira esta redirecionando para login incorretamente por dois motivos:

1. **Violacao das regras do React Router**: O `navigate()` esta sendo chamado durante a renderizacao do componente, nao dentro de um `useEffect()`
2. **Race condition**: O redirecionamento acontece antes de verificar se existe uma sessao (enquanto `loading` ainda e `true`)

### Codigo Problematico (linhas 68-71)
```text
if (!user) {
  navigate("/auth/login");  // Chamado durante render - ERRADO
  return null;
}
```

### Erros do Console
- "You should call navigate() in a React.useEffect(), not when your component is first rendered"
- "Cannot update a component (BrowserRouter) while rendering a different component (WalletPage)"

---

## Solucao

Mover a logica de verificacao de autenticacao para um `useEffect()`, seguindo o mesmo padrao ja usado no `useRoleGuard.ts`.

### Modificacao no `Wallet.tsx`

**Antes (problematico)**:
```text
export default function WalletPage() {
  const { user } = useAuth();
  // ...
  
  if (!user) {
    navigate("/auth/login");
    return null;
  }
  
  return <AppShell>...</AppShell>;
}
```

**Depois (correto)**:
```text
export default function WalletPage() {
  const { user, loading } = useAuth();
  // ...
  
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth/login");
    }
  }, [user, loading, navigate]);

  // Mostrar loading enquanto verifica autenticacao
  if (loading) {
    return <AppShell><Skeleton /></AppShell>;
  }

  // Usuario nao autenticado - sera redirecionado pelo useEffect
  if (!user) {
    return null;
  }
  
  return <AppShell>...</AppShell>;
}
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Wallet.tsx` | Mover verificacao de auth para useEffect, adicionar estado loading |

---

## Detalhes Tecnicos

### Fluxo Correto de Autenticacao

```text
1. Componente monta
         |
         v
2. useAuth() inicia com loading=true, user=null
         |
         v
3. Componente renderiza estado de loading (Skeleton)
         |
         v
4. Supabase verifica sessao existente
         |
         v
5. loading=false, user=dados ou null
         |
         v
6. useEffect() executa:
   - Se user=null -> navigate("/auth/login")
   - Se user=dados -> continua renderizando pagina
```

### Por que o padrao atual falha

```text
1. Componente monta
         |
         v
2. useAuth() inicia com loading=true, user=null
         |
         v
3. if (!user) -> TRUE (porque ainda esta carregando!)
         |
         v
4. navigate() chamado DURANTE render -> ERRO
         |
         v
5. Redireciona antes de verificar sessao
```

---

## Ordem de Implementacao

1. Adicionar import de `useEffect` (ja existe no arquivo)
2. Extrair `loading` do hook `useAuth()`
3. Criar `useEffect` com logica de redirecionamento
4. Adicionar condicional de loading com Skeleton
5. Remover chamada de navigate durante render
