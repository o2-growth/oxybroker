import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Protege rotas exclusivas de administradores.
 * - Estende a logica do ProtectedRoute: primeiro verifica autenticacao,
 *   depois verifica se o profile tem role 'admin'.
 * - Enquanto loading, exibe spinner (sem flash de conteudo admin).
 * - Nao autenticado   => redireciona para /auth/login
 * - Autenticado, sem role admin => redireciona para /marketplace
 * - Profile ainda nao carregado (loading = false, user presente) =>
 *   exibe spinner ate o profile chegar.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Profile ainda carregando apos o user estar disponivel
  if (!profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profile.role !== "admin") {
    return <Navigate to="/marketplace" replace />;
  }

  return <>{children}</>;
}
