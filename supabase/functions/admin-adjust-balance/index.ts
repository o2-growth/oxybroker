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

    // Validate JWT and get claims using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    console.log("Claims result:", { 
      hasData: !!claimsData, 
      hasClaims: !!claimsData?.claims,
      error: claimsError?.message 
    });
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Claims error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminId = claimsData.claims.sub as string;
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

    // Get target user's wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    if (walletError) {
      console.error("Error fetching wallet:", walletError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar carteira do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!wallet) {
      return new Response(
        JSON.stringify({ error: "Carteira do usuário não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = Number(wallet.balance) + amount;

    // Update wallet balance
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Error updating wallet:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar saldo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert wallet transaction
    const { error: txError } = await supabaseAdmin.from("wallet_transactions").insert({
      user_id: user_id,
      type: "admin_adjust",
      amount: amount,
      description: reason.trim(),
      reference_type: "admin_adjustment",
      reference_id: adminId,
    });

    if (txError) {
      console.error("Error inserting transaction:", txError);
      // Try to rollback the balance update
      await supabaseAdmin
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("user_id", user_id);
      
      return new Response(
        JSON.stringify({ error: "Erro ao registrar transação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${adminId} added ${amount} to user ${user_id}. Reason: ${reason}`);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        message: `R$ ${amount.toFixed(2)} adicionado com sucesso`,
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
