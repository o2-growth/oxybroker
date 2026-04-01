import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAnalyticsEvent, getAmountBucket } from "../_shared/analytics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlaceBidRequest {
  lot_id: string;
  amount: number;
}

interface PlaceBidResponse {
  success: boolean;
  message: string;
  data?: {
    bid_id: string;
    new_price: number;
    ends_at: string;
    was_extended: boolean;
  };
  error?: string;
}

serve(async (req) => {
  const startTime = Date.now();
  
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
    const { lot_id, amount }: PlaceBidRequest = await req.json();

    if (!lot_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for transactional operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // =============================================
    // TRANSACTIONAL BID PLACEMENT
    // Uses RPC function for atomicity
    // =============================================

    const result = await supabaseAdmin.rpc("place_bid_atomic", {
      p_lot_id: lot_id,
      p_user_id: user.id,
      p_amount: amount,
    });

    if (result.error) {
      console.error("place_bid_atomic error:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error.message || "Erro ao processar lance" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bidResult = result.data;

    // Check for business logic errors from the function
    if (bidResult && bidResult.error_code) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: bidResult.error_message || "Erro ao processar lance" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =============================================
    // NOTIFY PREVIOUS HIGHEST BIDDER (OUTBID)
    // =============================================
    if (bidResult.previous_bidder_id && bidResult.previous_bidder_id !== user.id) {
      // Create in-app notification
      await supabaseAdmin.from("notifications").insert({
        user_id: bidResult.previous_bidder_id,
        type: "outbid",
        title: "Você foi ultrapassado!",
        channel: "in_app",
        payload: {
          lot_id,
          lot_title: bidResult.lot_title,
          your_bid: bidResult.previous_amount,
          new_bid: amount,
          new_bidder_id: user.id,
        },
      });

      // Broadcast realtime event for immediate notification
      await supabaseAdmin.channel(`outbid-${bidResult.previous_bidder_id}`).send({
        type: "broadcast",
        event: "outbid",
        payload: {
          lot_id,
          lot_title: bidResult.lot_title,
          your_bid: bidResult.previous_amount,
          new_bid: amount,
        },
      });
    }

    // =============================================
    // BROADCAST LOT UPDATE FOR ALL VIEWERS
    // =============================================
    await supabaseAdmin.channel(`lot-updates-${lot_id}`).send({
      type: "broadcast",
      event: "bid_placed",
      payload: {
        lot_id,
        current_price: amount,
        ends_at: bidResult.ends_at,
        was_extended: bidResult.was_extended,
        bid_count: bidResult.bid_count,
      },
    });

    // =============================================
    // LOG ANALYTICS EVENT
    // =============================================
    await logAnalyticsEvent(supabaseAdmin, {
      event_type: "domain_event",
      event_name: "bid_placed",
      user_id: user.id,
      entity_type: "lot",
      entity_id: lot_id,
      status: "success",
      duration_ms: Date.now() - startTime,
      metadata: {
        amount_bucket: getAmountBucket(amount),
        was_extended: bidResult.was_extended,
      },
    });

    const response: PlaceBidResponse = {
      success: true,
      message: bidResult.was_extended 
        ? "Lance aceito! Leilão estendido devido a lance nos últimos segundos." 
        : "Lance aceito!",
      data: {
        bid_id: bidResult.bid_id,
        new_price: amount,
        ends_at: bidResult.ends_at,
        was_extended: bidResult.was_extended,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("place_bid error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
