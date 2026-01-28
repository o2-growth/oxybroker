import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin-only endpoint
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);

    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin");
    
    // Alternative: check user_roles table
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!isAdmin && !adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, action } = await req.json();

    if (action === "retry" && event_id) {
      // Retry specific event
      const { data: eventData, error: fetchError } = await supabaseAdmin
        .from("stripe_events")
        .select("*")
        .eq("id", event_id)
        .single();

      if (fetchError || !eventData) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-fetch event from Stripe
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      try {
        const stripeEvent = await stripe.events.retrieve(eventData.stripe_event_id);

        // Call the webhook endpoint to reprocess
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-webhook`;
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(stripeEvent),
        });

        const result = await response.json();

        return new Response(JSON.stringify({ 
          success: response.ok, 
          result,
          message: response.ok ? "Event reprocessed successfully" : "Reprocessing failed"
        }), {
          status: response.ok ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (stripeError) {
        return new Response(JSON.stringify({ 
          error: `Failed to retrieve event from Stripe: ${stripeError}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "list_failed") {
      // List all failed/retry_pending events
      const { data: events, error } = await supabaseAdmin
        .from("stripe_events")
        .select("*")
        .in("status", ["failed", "retry_pending"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ events }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "acknowledge_alert" && event_id) {
      // Acknowledge admin alert
      const { error } = await supabaseAdmin
        .from("admin_alerts")
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userData.user.id,
        })
        .eq("id", event_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in retry-stripe-events:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
