import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  // Admin client for database operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;
  const body = await req.text();

  try {
    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For development/testing without signature verification
      event = JSON.parse(body);
      console.warn("⚠️ Webhook signature verification skipped");
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`📥 Received Stripe event: ${event.type} (${event.id})`);

  // =============================================
  // IDEMPOTENCY CHECK - Prevent double processing
  // =============================================
  const { data: existingEvent, error: checkError } = await supabaseAdmin
    .from("stripe_events")
    .select("id, status, attempts")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking event idempotency:", checkError);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If event already processed successfully, skip
  if (existingEvent?.status === "processed") {
    console.log(`⏭️ Event ${event.id} already processed, skipping`);
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Process the event
  let processingResult: { success: boolean; error?: string } = { success: false };

  try {
    processingResult = await processStripeEvent(event, supabaseAdmin);
  } catch (err) {
    processingResult = {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // =============================================
  // RECORD EVENT FOR IDEMPOTENCY
  // =============================================
  const attempts = (existingEvent?.attempts ?? 0) + 1;

  if (existingEvent) {
    // Update existing record
    await supabaseAdmin
      .from("stripe_events")
      .update({
        status: processingResult.success ? "processed" : "failed",
        error_message: processingResult.error || null,
        attempts,
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);
  } else {
    // Insert new record
    await supabaseAdmin.from("stripe_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      status: processingResult.success ? "processed" : "failed",
      payload: event.data.object,
      error_message: processingResult.error || null,
      attempts,
    });
  }

  // =============================================
  // ADMIN ALERT ON FAILURE
  // =============================================
  if (!processingResult.success) {
    console.error(`❌ Failed to process event ${event.id}:`, processingResult.error);

    // Create admin alert after 3 failed attempts
    if (attempts >= 3) {
      await supabaseAdmin.from("admin_alerts").insert({
        type: "stripe_webhook_failed",
        title: `Stripe Webhook Falhou: ${event.type}`,
        message: `O evento ${event.id} falhou após ${attempts} tentativas. Erro: ${processingResult.error}`,
        metadata: {
          stripe_event_id: event.id,
          event_type: event.type,
          attempts,
          last_error: processingResult.error,
        },
      });

      console.log(`🚨 Admin alert created for event ${event.id}`);
    }

    // Mark for retry if under threshold
    if (attempts < 3) {
      await supabaseAdmin
        .from("stripe_events")
        .update({ status: "retry_pending" })
        .eq("stripe_event_id", event.id);
    }

    return new Response(
      JSON.stringify({
        error: processingResult.error,
        attempts,
        will_retry: attempts < 3,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`✅ Event ${event.id} processed successfully`);

  return new Response(JSON.stringify({ received: true, success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// =============================================
// EVENT PROCESSOR
// =============================================
async function processStripeEvent(
  event: Stripe.Event,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  const eventObject = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = eventObject as Stripe.Checkout.Session;

      // Only process wallet top-up payments
      if (session.metadata?.type !== "wallet_topup") {
        console.log("Ignoring non-wallet checkout session");
        return { success: true };
      }

      const userId = session.metadata?.user_id;
      const amountTotal = session.amount_total;

      if (!userId || !amountTotal) {
        return { success: false, error: "Missing user_id or amount in session" };
      }

      // Convert from cents to currency units
      const amount = amountTotal / 100;

      // Credit wallet
      const { error: walletError } = await supabase.rpc("credit_wallet", {
        p_user_id: userId,
        p_amount: amount,
        p_description: `Recarga via Stripe - ${session.id}`,
        p_reference_type: "stripe_checkout",
        p_reference_id: session.id,
      });

      if (walletError) {
        // Fallback: direct update if RPC doesn't exist
        const { data: wallet, error: fetchError } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", userId)
          .single();

        if (fetchError) {
          return { success: false, error: `Failed to fetch wallet: ${fetchError.message}` };
        }

        const newBalance = (wallet?.balance || 0) + amount;

        const { error: updateError } = await supabase
          .from("wallets")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (updateError) {
          return { success: false, error: `Failed to update wallet: ${updateError.message}` };
        }

        // Record transaction
        await supabase.from("wallet_transactions").insert({
          user_id: userId,
          type: "topup",
          amount,
          description: `Recarga via Stripe - ${session.id}`,
          reference_type: "stripe_checkout",
          reference_id: session.id,
        });
      }

      console.log(`💰 Credited ${amount} to wallet for user ${userId}`);
      return { success: true };
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = eventObject as Stripe.PaymentIntent;
      console.log(`Payment failed for intent ${paymentIntent.id}`);

      // Create notification for user if we have their ID
      const userId = paymentIntent.metadata?.user_id;
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "payment_failed",
          title: "Pagamento Falhou",
          payload: {
            payment_intent_id: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            error: paymentIntent.last_payment_error?.message,
          },
        });
      }

      return { success: true };
    }

    case "charge.refunded": {
      const charge = eventObject as Stripe.Charge;
      console.log(`Charge refunded: ${charge.id}`);

      // Handle refund logic here if needed
      return { success: true };
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
      return { success: true };
  }
}
