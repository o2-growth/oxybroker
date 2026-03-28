import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PII keys to remove from metadata
const PII_KEYS = ["email", "name", "full_name", "phone", "address", "cpf", "raw_payload", "password"];

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (PII_KEYS.some(pii => lowerKey.includes(pii))) {
      continue; // Skip PII fields
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body
    const body = await req.json();
    const {
      event_type,
      event_name,
      route,
      session_id,
      entity_type,
      entity_id,
      status,
      duration_ms,
      metadata = {},
      request_id,
      referrer,
    } = body;

    // Validate required fields
    if (!event_type || !event_name || !session_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: event_type, event_name, session_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info if authenticated
    let userId: string | null = null;
    let userRole: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabaseUser.auth.getUser();

      if (user?.id) {
        userId = user.id;
        
        // Get user role
        const { data: roleData } = await supabaseAdmin.rpc("get_user_role", {
          _user_id: userId,
        });
        userRole = roleData || null;
      }
    }

    // Sanitize metadata to remove PII
    const sanitizedMetadata = sanitizeMetadata(metadata);

    // Insert event using service role (bypasses RLS)
    const { error: insertError } = await supabaseAdmin
      .from("analytics_events")
      .insert({
        event_type,
        event_name,
        user_id: userId,
        role: userRole,
        route,
        referrer,
        session_id,
        request_id,
        entity_type,
        entity_id,
        status,
        duration_ms,
        metadata: sanitizedMetadata,
      });

    if (insertError) {
      console.error("Failed to insert analytics event:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("log-event error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
