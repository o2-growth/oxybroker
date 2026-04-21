import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Parse request body
    const body: RequestBody = await req.json();
    const { amount, bank_info } = body;

    // Basic validation before calling atomic function
    if (!amount || typeof amount !== "number") {
      return new Response(
        JSON.stringify({ error: "Valor inválido" }),
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

    // Call atomic withdrawal function - prevents race conditions
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "request_withdrawal_atomic",
      {
        p_user_id: userId,
        p_amount: amount,
        p_bank_info: bank_info,
      }
    );

    if (rpcError) {
      console.error("Error calling request_withdrawal_atomic:", rpcError);
      return new Response(
        JSON.stringify({ error: "Erro ao processar solicitação de saque" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for business logic errors from atomic function
    if (result?.error_code) {
      const statusMap: Record<string, number> = {
        AMOUNT_TOO_LOW: 400,
        PROFILE_NOT_FOUND: 404,
        WITHDRAWAL_NOT_ALLOWED: 403,
        WALLET_NOT_FOUND: 404,
        INSUFFICIENT_BALANCE: 400,
      };
      
      return new Response(
        JSON.stringify({ error: result.error_message }),
        { 
          status: statusMap[result.error_code] || 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: result.withdrawal_id,
        message: result.message,
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
