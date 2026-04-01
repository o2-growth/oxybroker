import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReturnRequest {
  purchase_id: string;
  reason?: string;
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
    const { purchase_id, reason }: ReturnRequest = await req.json();

    if (!purchase_id) {
      return new Response(
        JSON.stringify({ success: false, error: "ID da compra é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // =============================================
    // VALIDATE PURCHASE
    // =============================================

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("*, lot:lots(title)")
      .eq("id", purchase_id)
      .maybeSingle();

    if (purchaseError) {
      console.error("Error fetching purchase:", purchaseError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar compra" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!purchase) {
      return new Response(
        JSON.stringify({ success: false, error: "Compra não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate ownership
    if (purchase.buyer_user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Você não é o comprador deste lote" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate status
    if (purchase.status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Esta compra não pode ser devolvida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate deadline
    if (!purchase.return_deadline_at || new Date(purchase.return_deadline_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Prazo de devolução expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if return already requested
    const { data: existingReturn } = await supabaseAdmin
      .from("returns")
      .select("id")
      .eq("purchase_id", purchase_id)
      .maybeSingle();

    if (existingReturn) {
      return new Response(
        JSON.stringify({ success: false, error: "Devolução já solicitada para esta compra" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // CREATE RETURN REQUEST
    // =============================================

    const { data: returnRecord, error: returnError } = await supabaseAdmin
      .from("returns")
      .insert({
        purchase_id,
        requested_by: user.id,
        reason: reason || "Solicitação de devolução pelo usuário",
        status: "requested",
      })
      .select()
      .single();

    if (returnError) {
      console.error("Error creating return:", returnError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar solicitação de devolução" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify admins
    await supabaseAdmin.from("admin_alerts").insert({
      type: "return_requested",
      title: "Nova solicitação de devolução",
      message: `Devolução solicitada para o lote: ${purchase.lot?.title || "Lote"}`,
      metadata: {
        return_id: returnRecord.id,
        purchase_id,
        user_id: user.id,
        amount: purchase.amount,
        lot_title: purchase.lot?.title,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Solicitação de devolução criada com sucesso",
        return_id: returnRecord.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("request-return error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
