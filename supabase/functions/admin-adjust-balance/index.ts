import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to get their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get authenticated user (pass token explicitly for server-side validation)
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);

    console.log("Auth result:", {
      hasUser: !!userData?.user,
      userId: userData?.user?.id,
      error: userError?.message,
    });

    if (userError || !userData?.user?.id) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminId = userData.user.id;
    console.log("Authenticated user:", adminId);

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin using has_role function
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: adminId,
      _role: "admin",
    });

    console.log("Admin check:", { adminId, hasAdminRole, roleError: roleError?.message });

    if (roleError || !hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem ajustar saldo." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_id, amount, reason } = await req.json();

    // Validate inputs
    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor deve ser maior que zero" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amount > 100000) {
      return new Response(
        JSON.stringify({ error: "Valor máximo é R$ 100.000,00" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Motivo é obrigatório (mínimo 5 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (reason.length > 500) {
      return new Response(
        JSON.stringify({ error: "Motivo muito longo (máximo 500 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Executar ajuste de saldo de forma atômica via função SQL.
    // A função admin_adjust_balance_atomic usa FOR UPDATE para serializar
    // acessos concorrentes à mesma wallet, eliminando a race condition
    // do fluxo anterior (SELECT → UPDATE → INSERT sem transação).
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "admin_adjust_balance_atomic",
      {
        p_user_id:  user_id,
        p_amount:   amount,
        p_reason:   reason.trim(),
        p_admin_id: adminId,
      }
    );

    if (rpcError) {
      console.error("Error in admin_adjust_balance_atomic:", rpcError);

      // Traduzir erros conhecidos do PostgreSQL para mensagens amigáveis
      const pgMessage = rpcError.message ?? "";
      if (pgMessage.includes("Wallet not found")) {
        return new Response(
          JSON.stringify({ error: "Carteira do usuário não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (pgMessage.includes("Insufficient balance")) {
        return new Response(
          JSON.stringify({ error: "Saldo insuficiente para este ajuste" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Erro ao ajustar saldo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = (result as { new_balance: number }).new_balance;
    console.log(`Admin ${adminId} added ${amount} to user ${user_id}. Reason: ${reason}`);

    // Mesma assinatura de resposta do endpoint original para não quebrar o frontend
    return new Response(
      JSON.stringify({
        success:     true,
        new_balance: newBalance,
        message:     `R$ ${amount.toFixed(2)} adicionado com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
