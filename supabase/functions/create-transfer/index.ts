import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TransferRequest {
  to_user_email: string;
  amount: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { to_user_email, amount }: TransferRequest = await req.json();

    if (!to_user_email || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for transactional operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // =============================================
    // FIND RECIPIENT BY EMAIL
    // =============================================

    const { data: recipientProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", to_user_email.toLowerCase().trim())
      .maybeSingle();

    if (profileError) {
      console.error("Error finding recipient:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar destinatário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipientProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Destinatário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // EXECUTE ATOMIC TRANSFER
    // =============================================

    const { data: transferResult, error: transferError } = await supabaseAdmin.rpc(
      "transfer_balance_atomic",
      {
        p_from_user_id: user.id,
        p_to_user_id: recipientProfile.id,
        p_amount: amount,
      }
    );

    if (transferError) {
      console.error("transfer_balance_atomic error:", transferError);
      return new Response(
        JSON.stringify({ success: false, error: transferError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (transferResult?.error_code) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: transferResult.error_message 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Transferência realizada com sucesso",
        transfer_id: transferResult.transfer_id,
        amount: transferResult.amount,
        new_balance: transferResult.new_balance,
        recipient_name: recipientProfile.full_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("create-transfer error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
