import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAmountBucket, logAnalyticsEvent } from "../_shared/analytics.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CloseResult {
  lot_id: string;
  lot_title?: string;
  success: boolean;
  has_winner: boolean;
  winner_user_id?: string;
  purchase_id?: string;
  amount?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // =============================================
    // AUTHENTICATION: Admin or Cron Secret required
    // =============================================
    
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedCronSecret = req.headers.get("X-Cron-Secret");
    
    // Check cron secret first (for scheduled jobs)
    const isCronAuthorized = cronSecret && providedCronSecret === cronSecret;
    
    // If not cron, check for admin auth
    let isAdminAuthorized = false;
    
    if (!isCronAuthorized) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = user.id;
      
      // Check admin role using service client
      const supabaseAdminCheck = createClient(supabaseUrl, supabaseServiceKey);
      const { data: hasAdminRole } = await supabaseAdminCheck.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (!hasAdminRole) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      isAdminAuthorized = true;
    }

    // At this point, either cron or admin is authorized
    if (!isCronAuthorized && !isAdminAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // =============================================
    // FIND ALL LOTS TO CLOSE
    // status = 'live' AND ends_at <= now()
    // =============================================

    const { data: lotsToClose, error: lotsError } = await supabaseAdmin
      .from("lots")
      .select("id, title")
      .eq("status", "live")
      .lte("ends_at", new Date().toISOString());

    if (lotsError) {
      console.error("Error fetching lots to close:", lotsError);
      return new Response(
        JSON.stringify({ success: false, error: lotsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lotsToClose || lotsToClose.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum leilão para encerrar", closed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${lotsToClose.length} lots to close`);

    const results: CloseResult[] = [];

    // =============================================
    // CLOSE EACH LOT ATOMICALLY
    // =============================================

    for (const lot of lotsToClose) {
      try {
        const { data: closeResult, error: closeError } = await supabaseAdmin.rpc(
          "close_auction_atomic",
          { p_lot_id: lot.id }
        );

        if (closeError) {
          console.error(`Error closing lot ${lot.id}:`, closeError);
          results.push({
            lot_id: lot.id,
            lot_title: lot.title,
            success: false,
            has_winner: false,
            error: closeError.message,
          });
          continue;
        }

        if (closeResult?.error_code) {
          results.push({
            lot_id: lot.id,
            lot_title: lot.title,
            success: false,
            has_winner: false,
            error: closeResult.error_message,
          });
          continue;
        }

        results.push({
          lot_id: lot.id,
          lot_title: closeResult.lot_title || lot.title,
          success: true,
          has_winner: closeResult.has_winner,
          winner_user_id: closeResult.winner_user_id,
          purchase_id: closeResult.purchase_id,
          amount: closeResult.amount,
        });

        // =============================================
        // NOTIFY OTHER PARTICIPANTS (LOSERS)
        // =============================================

        if (closeResult.has_winner) {
          await logAnalyticsEvent(supabaseAdmin, {
            event_type: "domain_event",
            event_name: "auction_won",
            user_id: closeResult.winner_user_id,
            entity_type: "lot",
            entity_id: lot.id,
            status: "success",
            metadata: {
              amount_bucket: getAmountBucket(closeResult.amount ?? 0),
              purchase_method: "auction",
            },
          });

          await logAnalyticsEvent(supabaseAdmin, {
            event_type: "domain_event",
            event_name: "purchase_created",
            user_id: closeResult.winner_user_id,
            entity_type: "purchase",
            entity_id: closeResult.purchase_id ?? lot.id,
            status: "success",
            metadata: {
              amount_bucket: getAmountBucket(closeResult.amount ?? 0),
              purchase_method: "auction",
              lot_id: lot.id,
            },
          });

          const { data: otherBidders } = await supabaseAdmin
            .from("bids")
            .select("user_id")
            .eq("lot_id", lot.id)
            .neq("user_id", closeResult.winner_user_id);

          if (otherBidders && otherBidders.length > 0) {
            const uniqueUserIds = [...new Set(otherBidders.map((b) => b.user_id))];

            for (const recipientUserId of uniqueUserIds) {
              await supabaseAdmin.from("notifications").insert({
                user_id: recipientUserId,
                type: "ended",
                title: `Leilão encerrado: ${lot.title}`,
                channel: "in_app",
                payload: {
                  lot_id: lot.id,
                  lot_title: lot.title,
                  winning_amount: closeResult.amount,
                  you_won: false,
                },
              });
            }
          }
        }

        // Broadcast lot ended event
        await supabaseAdmin.channel(`lot-updates-${lot.id}`).send({
          type: "broadcast",
          event: "lot_ended",
          payload: {
            lot_id: lot.id,
            has_winner: closeResult.has_winner,
            winning_amount: closeResult.amount,
          },
        });

      } catch (lotError) {
        console.error(`Exception closing lot ${lot.id}:`, lotError);
        results.push({
          lot_id: lot.id,
          lot_title: lot.title,
          success: false,
          has_winner: false,
          error: lotError instanceof Error ? lotError.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`Closed ${successCount} lots successfully, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Encerrados ${successCount} leilões`,
        closed: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("close-auctions error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
