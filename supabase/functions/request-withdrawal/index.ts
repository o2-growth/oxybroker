import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  amount: number;
  bank_info: {
    type: "pix" | "bank_account";
    pix_key?: string;
    bank_code?: string;
    agency?: string;
    account?: string;
    account_type?: "corrente" | "poupanca";
  };
}

Deno.serve(async (req) => {
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

    // Client with user token for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse request body
    const body: RequestBody = await req.json();
    const { amount, bank_info } = body;

    // Validate amount
    if (!amount || amount < 50) {
      return new Response(
        JSON.stringify({ error: "Valor mínimo para saque é R$ 50,00" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate bank info
    if (!bank_info || !bank_info.type) {
      return new Response(
        JSON.stringify({ error: "Dados bancários são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bank_info.type === "pix" && !bank_info.pix_key) {
      return new Response(
        JSON.stringify({ error: "Chave PIX é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bank_info.type === "bank_account") {
      if (!bank_info.bank_code || !bank_info.agency || !bank_info.account) {
        return new Response(
          JSON.stringify({ error: "Dados bancários incompletos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Service client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user can withdraw
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("can_withdraw, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.can_withdraw) {
      return new Response(
        JSON.stringify({ error: "Saque não habilitado para sua conta. Entre em contato com o administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: "Carteira não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (Number(wallet.balance) < amount) {
      return new Response(
        JSON.stringify({ error: "Saldo insuficiente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Start transaction: debit wallet, create withdrawal record, create transaction

    // 1. Debit wallet
    const newBalance = Number(wallet.balance) - amount;
    const { error: updateWalletError } = await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateWalletError) {
      console.error("Error updating wallet:", updateWalletError);
      return new Response(
        JSON.stringify({ error: "Erro ao debitar carteira" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: userId,
        amount,
        status: "pending",
        bank_info,
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("Error creating withdrawal:", withdrawalError);
      // Try to rollback wallet
      await supabaseAdmin
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ error: "Erro ao criar solicitação de saque" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create wallet transaction
    const { error: txError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        type: "withdrawal",
        amount,
        description: "Solicitação de saque",
        reference_type: "withdrawal",
        reference_id: withdrawal.id,
      });

    if (txError) {
      console.error("Error creating transaction:", txError);
      // Continue anyway, the withdrawal was created
    }

    // 4. Create admin alert (optional notification)
    await supabaseAdmin.from("admin_alerts").insert({
      type: "withdrawal_request",
      title: "Nova solicitação de saque",
      message: `${profile.full_name || "Usuário"} solicitou saque de R$ ${amount.toFixed(2)}`,
      metadata: {
        withdrawal_id: withdrawal.id,
        user_id: userId,
        amount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        message: "Solicitação de saque enviada com sucesso",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing withdrawal request:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar solicitação" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
