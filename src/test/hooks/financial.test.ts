/**
 * STORY-015 — Unit tests para hooks financeiros críticos
 *
 * Cobre: useWallet, useWithdraw, useTopUp
 * Ambiente: jsdom / Vitest / globals:true
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks globais
// ---------------------------------------------------------------------------

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn(),
    },
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-123", email: "test@test.com" },
    profile: { id: "user-123", role: "franquia", can_withdraw: true },
    loading: false,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// ---------------------------------------------------------------------------
// useWallet
// ---------------------------------------------------------------------------

describe("useWallet", () => {
  let queryClient: QueryClient;
  let supabaseMock: typeof import("@/integrations/supabase/client")["supabase"];
  let useAuthMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryClient = makeQueryClient();

    const mod = await import("@/integrations/supabase/client");
    supabaseMock = mod.supabase;

    const authMod = await import("@/hooks/useAuth");
    useAuthMock = authMod.useAuth as ReturnType<typeof vi.fn>;
  });

  it("retorna wallet e transações do usuário autenticado", async () => {
    const fakeWallet = { id: "w-1", user_id: "user-123", balance: 500 };
    const fakeTxs = [{ id: "tx-1", amount: 100 }];
    const fakeProfile = { can_withdraw: true };

    // Promise.all resolve na ordem: wallet, transactions, profile
    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    single
      .mockResolvedValueOnce({ data: fakeWallet, error: null }) // wallets
      .mockResolvedValueOnce({ data: fakeProfile, error: null }); // profiles

    // limit() é chamado na query de transactions e retorna a promise
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;
    limit.mockResolvedValueOnce({ data: fakeTxs, error: null });

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.wallet).toEqual(fakeWallet);
    expect(result.current.transactions).toEqual(fakeTxs);
    expect(result.current.canWithdraw).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("retorna loading=true durante o fetch", async () => {
    // Nunca resolve — mantém loading=true
    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    single.mockReturnValue(new Promise(() => {}));
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;
    limit.mockReturnValue(new Promise(() => {}));

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    // Antes de qualquer resolução, loading deve ser true
    expect(result.current.loading).toBe(true);
  });

  it("propaga erro quando walletResult.error existe", async () => {
    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;

    single
      .mockResolvedValueOnce({ data: null, error: new Error("wallet error") })
      .mockResolvedValueOnce({ data: { can_withdraw: true }, error: null });
    limit.mockResolvedValueOnce({ data: [], error: null });

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("wallet error");
    expect(result.current.wallet).toBeNull();
  });

  it("propaga erro quando profileResult.error existe (BUG corrigido no Sprint 2)", async () => {
    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;

    single
      .mockResolvedValueOnce({ data: { id: "w-1", balance: 0 }, error: null }) // wallet ok
      .mockResolvedValueOnce({
        data: null,
        error: new Error("profile error"),
      }); // profile error
    limit.mockResolvedValueOnce({ data: [], error: null });

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("profile error");
    expect(result.current.wallet).toBeNull();
  });

  it("retorna canWithdraw=false quando profile.can_withdraw=false", async () => {
    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;

    single
      .mockResolvedValueOnce({ data: { id: "w-1", balance: 200 }, error: null })
      .mockResolvedValueOnce({ data: { can_withdraw: false }, error: null });
    limit.mockResolvedValueOnce({ data: [], error: null });

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canWithdraw).toBe(false);
  });

  it("não executa query quando usuário não está autenticado (enabled: false)", async () => {
    // Sem usuário autenticado
    useAuthMock.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    });

    const single = supabaseMock.single as ReturnType<typeof vi.fn>;
    const limit = supabaseMock.limit as ReturnType<typeof vi.fn>;

    const { useWallet } = await import("@/hooks/useWallet");
    const { result } = renderHook(() => useWallet(), {
      wrapper: createWrapper(queryClient),
    });

    // Query desabilitada => nunca carrega
    expect(result.current.loading).toBe(false);
    expect(result.current.wallet).toBeNull();
    expect(result.current.transactions).toEqual([]);

    // Supabase não deve ter sido chamado
    expect(single).not.toHaveBeenCalled();
    expect(limit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// useWithdraw
// ---------------------------------------------------------------------------

describe("useWithdraw", () => {
  let supabaseMock: typeof import("@/integrations/supabase/client")["supabase"];
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import("@/integrations/supabase/client");
    supabaseMock = mod.supabase;

    const sonnerMod = await import("sonner");
    toastMock = sonnerMod.toast as unknown as typeof toastMock;
  });

  const bankInfo = {
    type: "pix" as const,
    pix_key: "test@pix.com",
  };

  it("chama supabase.functions.invoke com os parâmetros corretos", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { useWithdraw } = await import("@/hooks/useWithdraw");
    const { result } = renderHook(() => useWithdraw());

    await result.current.requestWithdrawal(250, bankInfo);

    expect(invoke).toHaveBeenCalledWith("request-withdrawal", {
      body: {
        amount: 250,
        bank_info: bankInfo,
      },
    });
  });

  it("retorna true em caso de sucesso", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { useWithdraw } = await import("@/hooks/useWithdraw");
    const { result } = renderHook(() => useWithdraw());

    const returned = await result.current.requestWithdrawal(100, bankInfo);

    expect(returned).toBe(true);
  });

  it("retorna false e não lança exceção em caso de erro", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("network failure"),
    });

    const { useWithdraw } = await import("@/hooks/useWithdraw");
    const { result } = renderHook(() => useWithdraw());

    // act garante que as atualizações de estado do hook sejam processadas
    let returned: boolean | undefined;
    await waitFor(async () => {
      returned = await result.current.requestWithdrawal(100, bankInfo);
    });

    expect(returned).toBe(false);
  });

  it("mostra toast de sucesso após saque bem-sucedido", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });

    const { useWithdraw } = await import("@/hooks/useWithdraw");
    const { result } = renderHook(() => useWithdraw());

    await result.current.requestWithdrawal(100, bankInfo);

    expect(toastMock.success).toHaveBeenCalledWith(
      "Solicitação enviada!",
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it("mostra toast de erro após falha", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("saldo insuficiente"),
    });

    const { useWithdraw } = await import("@/hooks/useWithdraw");
    const { result } = renderHook(() => useWithdraw());

    await result.current.requestWithdrawal(99999, bankInfo);

    expect(toastMock.error).toHaveBeenCalledWith(
      "Erro ao solicitar saque",
      expect.objectContaining({ description: "saldo insuficiente" })
    );
  });
});

// ---------------------------------------------------------------------------
// useTopUp
// ---------------------------------------------------------------------------

describe("useTopUp", () => {
  let supabaseMock: typeof import("@/integrations/supabase/client")["supabase"];
  let toastMock: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import("@/integrations/supabase/client");
    supabaseMock = mod.supabase;

    const sonnerMod = await import("sonner");
    toastMock = sonnerMod.toast as unknown as typeof toastMock;

    // Mock window.open para evitar JSDOM navigation errors
    windowOpenSpy = vi.spyOn(window, "open").mockReturnValue({
      closed: false,
    } as Window);
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
  });

  it("chama supabase.functions.invoke com o amount correto", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({
      data: { url: "https://checkout.example.com" },
      error: null,
    });

    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(500);

    expect(invoke).toHaveBeenCalledWith("create-checkout", {
      body: { amount: 500 },
    });
  });

  it("abre nova aba com a URL de checkout retornada", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({
      data: { url: "https://checkout.example.com" },
      error: null,
    });

    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(100);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://checkout.example.com",
      "_blank"
    );
  });

  it("exibe toast de erro quando amount < 10", async () => {
    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(5);

    expect(toastMock.error).toHaveBeenCalledWith(
      "Valor inválido",
      expect.objectContaining({ description: expect.stringContaining("R$") })
    );

    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    expect(invoke).not.toHaveBeenCalled();
  });

  it("exibe toast de erro quando amount > 10000", async () => {
    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(99999);

    expect(toastMock.error).toHaveBeenCalledWith(
      "Valor inválido",
      expect.objectContaining({ description: expect.any(String) })
    );

    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    expect(invoke).not.toHaveBeenCalled();
  });

  it("exibe toast de erro quando supabase retorna error", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: "payment service unavailable" },
    });

    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(200);

    expect(toastMock.error).toHaveBeenCalledWith(
      "Erro ao iniciar recarga",
      expect.objectContaining({
        description: "payment service unavailable",
      })
    );
  });

  it("exibe toast de erro quando data.url não é retornada", async () => {
    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({ data: {}, error: null });

    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    await result.current.createCheckout(300);

    expect(toastMock.error).toHaveBeenCalledWith(
      "Erro ao iniciar recarga",
      expect.objectContaining({
        description: "URL de checkout não retornada",
      })
    );
  });

  it("loading é true durante o invoke e false após resolução", async () => {
    let resolveInvoke!: (value: unknown) => void;
    const invokePromise = new Promise((res) => {
      resolveInvoke = res;
    });

    const invoke = supabaseMock.functions.invoke as ReturnType<typeof vi.fn>;
    invoke.mockReturnValueOnce(invokePromise);

    const { useTopUp } = await import("@/hooks/useTopUp");
    const { result } = renderHook(() => useTopUp());

    // Inicia o checkout dentro de act para sincronizar a atualização de estado
    let checkoutPromise: Promise<void>;
    act(() => {
      checkoutPromise = result.current.createCheckout(100);
    });

    // Após o setLoading(true) síncrono, deve estar loading
    expect(result.current.loading).toBe(true);

    // Resolve a promise do invoke e aguarda o estado ser atualizado
    await act(async () => {
      resolveInvoke({ data: { url: "https://checkout.example.com" }, error: null });
      await checkoutPromise!;
    });

    expect(result.current.loading).toBe(false);
  });
});
