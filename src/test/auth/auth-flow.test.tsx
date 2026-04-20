/**
 * STORY-016 — Integration tests para AuthContext e route guards
 *
 * Cobre: ProtectedRoute, AdminRoute, AuthContext
 * Ambiente: jsdom / Vitest / globals:true
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/routes/ProtectedRoute";
import { AdminRoute } from "@/components/routes/AdminRoute";

// ---------------------------------------------------------------------------
// vi.hoisted — garante que as refs de mock existam antes do factory de vi.mock
// ---------------------------------------------------------------------------

const { mockGetSession, mockOnAuthStateChange, mockSingle } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSingle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock do Supabase auth
// ---------------------------------------------------------------------------

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
    maybeSingle: mockSingle,
  },
}));

// ---------------------------------------------------------------------------
// Helper: renderWithProviders
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

/**
 * Renderiza a árvore completa com todos os providers necessários.
 * initialEntries permite simular uma URL específica.
 */
function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ["/"] }: { initialEntries?: string[] } = {}
) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Stub helpers para simplificar os cenários
// ---------------------------------------------------------------------------

/** Configura o Supabase para simular "nenhuma sessão ativa". */
function setupNoSession() {
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

/** Configura o Supabase para simular uma sessão válida com um usuário e perfil. */
function setupAuthenticatedSession(
  role: "admin" | "franquia" | "master_franquia" | "oxy_hacker" = "franquia"
) {
  const fakeUser = { id: "user-abc", email: "user@test.com" };
  const fakeSession = { user: fakeUser, access_token: "tok" };
  const fakeProfile = {
    id: "user-abc",
    full_name: "Test User",
    email: "user@test.com",
    role,
    franchise_category_id: null,
    avatar_url: null,
    can_withdraw: true,
    suspended_at: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  };

  mockGetSession.mockResolvedValue({
    data: { session: fakeSession },
    error: null,
  });

  // onAuthStateChange é registrado mas não dispara eventos adicionais
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  // fetchProfile usa .from("profiles").select("*").eq("id", userId).maybeSingle()
  mockSingle.mockResolvedValue({ data: fakeProfile, error: null });
}

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe loading spinner enquanto auth carrega", () => {
    // getSession nunca resolve — mantém loading=true
    mockGetSession.mockReturnValue(new Promise(() => {}));
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithProviders(
      <ProtectedRoute>
        <p>Conteúdo protegido</p>
      </ProtectedRoute>
    );

    // O conteúdo não deve aparecer enquanto loading
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
    // Spinner presente (animate-spin é a classe do div de loading)
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("redireciona para /auth/login quando usuário não autenticado", async () => {
    setupNoSession();

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <p>Área protegida</p>
            </ProtectedRoute>
          }
        />
        <Route path="/auth/login" element={<p>Página de login</p>} />
      </Routes>
    );

    await waitFor(() =>
      expect(screen.getByText("Página de login")).toBeInTheDocument()
    );
    expect(screen.queryByText("Área protegida")).not.toBeInTheDocument();
  });

  it("renderiza children quando usuário autenticado", async () => {
    setupAuthenticatedSession("franquia");

    renderWithProviders(
      <ProtectedRoute>
        <p>Conteúdo exclusivo</p>
      </ProtectedRoute>
    );

    await waitFor(() =>
      expect(screen.getByText("Conteúdo exclusivo")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// AdminRoute
// ---------------------------------------------------------------------------

describe("AdminRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe loading spinner enquanto auth carrega", () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithProviders(
      <AdminRoute>
        <p>Painel admin</p>
      </AdminRoute>
    );

    expect(screen.queryByText("Painel admin")).not.toBeInTheDocument();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("redireciona para /auth/login quando usuário não autenticado", async () => {
    setupNoSession();

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <AdminRoute>
              <p>Área admin</p>
            </AdminRoute>
          }
        />
        <Route path="/auth/login" element={<p>Login page</p>} />
        <Route path="/marketplace" element={<p>Marketplace page</p>} />
      </Routes>
    );

    await waitFor(() =>
      expect(screen.getByText("Login page")).toBeInTheDocument()
    );
    expect(screen.queryByText("Área admin")).not.toBeInTheDocument();
  });

  it("redireciona para /marketplace quando usuário autenticado mas não é admin", async () => {
    setupAuthenticatedSession("franquia"); // role != 'admin'

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <AdminRoute>
              <p>Área admin</p>
            </AdminRoute>
          }
        />
        <Route path="/auth/login" element={<p>Login page</p>} />
        <Route path="/marketplace" element={<p>Marketplace page</p>} />
      </Routes>
    );

    await waitFor(() =>
      expect(screen.getByText("Marketplace page")).toBeInTheDocument()
    );
    expect(screen.queryByText("Área admin")).not.toBeInTheDocument();
  });

  it("renderiza children quando usuário é admin", async () => {
    setupAuthenticatedSession("admin");

    renderWithProviders(
      <AdminRoute>
        <p>Painel de administração</p>
      </AdminRoute>
    );

    await waitFor(() =>
      expect(screen.getByText("Painel de administração")).toBeInTheDocument()
    );
  });
});

// ---------------------------------------------------------------------------
// AuthContext
// ---------------------------------------------------------------------------

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Componente auxiliar que expõe os valores do contexto via data-testid
   * para inspeção sem depender de texto visível específico.
   */
  function AuthStateDisplay() {
    const { user, loading, profile } = useAuth();
    return (
      <div>
        <span data-testid="loading">{String(loading)}</span>
        <span data-testid="user">{user ? user.id : "null"}</span>
        <span data-testid="profile">{profile ? profile.role : "null"}</span>
      </div>
    );
  }

  it("inicia com loading=true e user=null", () => {
    // getSession nunca resolve — preserva estado inicial do contexto
    mockGetSession.mockReturnValue(new Promise(() => {}));
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderWithProviders(<AuthStateDisplay />);

    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("null");
  });

  it("atualiza user após getSession retornar sessão válida", async () => {
    setupAuthenticatedSession("franquia");

    renderWithProviders(<AuthStateDisplay />);

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("user-abc")
    );
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("busca profile do usuário após autenticação", async () => {
    setupAuthenticatedSession("admin");

    renderWithProviders(<AuthStateDisplay />);

    await waitFor(() =>
      expect(screen.getByTestId("profile").textContent).toBe("admin")
    );
  });
});
