import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProcessReturnRequest {
  return_id: string;
  action: "approve" | "reject";
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

    // Use service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // =============================================
    // VALIDATE ADMIN ROLE
    // Use has_role() with explicit user_id - is_admin() doesn't work with service role client
    // =============================================

    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Apenas administradores podem processar devoluções" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { return_id, action }: ProcessReturnRequest = await req.json();

    if (!return_id || !action || !["approve", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // VALIDATE RETURN
    // =============================================

    const { data: returnRecord, error: returnError } = await supabaseAdmin
      .from("returns")
      .select("*, purchase:purchases(*, lot:lots(title))")
      .eq("id", return_id)
      .maybeSingle();

    if (returnError || !returnRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Devolução não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (returnRecord.status !== "requested") {
      return new Response(
        JSON.stringify({ success: false, error: "Esta devolução já foi processada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // PROCESS ACTION
    // =============================================

    if (action === "reject") {
      // Simply update status to rejected
      await supabaseAdmin
        .from("returns")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", return_id);

      // Notify user
      await supabaseAdmin.from("notifications").insert({
        user_id: returnRecord.requested_by,
        type: "return_rejected",
        title: "Devolução rejeitada",
        channel: "in_app",
        payload: {
          return_id,
          purchase_id: returnRecord.purchase_id,
          lot_title: returnRecord.purchase?.lot?.title,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Devolução rejeitada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // APPROVE AND PROCESS REFUND
    // =============================================

    // First, update status to approved
    await supabaseAdmin
      .from("returns")
      .update({ status: "approved" })
      .eq("id", return_id);

    // Then, process the refund atomically
    const { data: processResult, error: processError } = await supabaseAdmin.rpc(
      "process_return_atomic",
      { p_return_id: return_id }
    );

    if (processError) {
      console.error("process_return_atomic error:", processError);
      // Revert to requested status
      await supabaseAdmin
        .from("returns")
        .update({ status: "requested" })
        .eq("id", return_id);

      return new Response(
        JSON.stringify({ success: false, error: processError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processResult?.error_code) {
      // Revert to requested status
      await supabaseAdmin
        .from("returns")
        .update({ status: "requested" })
        .eq("id", return_id);

      return new Response(
        JSON.stringify({ success: false, error: processResult.error_message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Devolução processada com sucesso",
        refunded_amount: processResult.refunded_amount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("process-return error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
