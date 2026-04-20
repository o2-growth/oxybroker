import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAnalyticsEvent } from "../_shared/analytics.ts";

// Sprint 4 — STORY-018
// Recebe leads via webhook (n8n orquestrando Meta/Google Ads) e insere em leads_inbox.
// Autenticação: header `x-api-key` validado contra SHA-256 em public.webhook_api_keys.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RevenueBracket =
  | "200k_350k"
  | "350k_500k"
  | "500k_1m"
  | "1m_5m"
  | "5m_plus";

interface LeadIntakePayload {
  razao_social: string;
  cnpj?: string;
  setor: string;
  faturamento_bracket: RevenueBracket;
  contato_nome: string;
  contato_telefone?: string;
  contato_email?: string;
  contato_cargo?: string;
  origem: string;
  observacoes?: string;
  payload_raw?: Record<string, unknown>;
}

const VALID_BRACKETS: RevenueBracket[] = [
  "200k_350k",
  "350k_500k",
  "500k_1m",
  "1m_5m",
  "5m_plus",
];

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function validatePayload(body: unknown): {
  valid: boolean;
  data?: LeadIntakePayload;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Body deve ser JSON object" };
  }
  const b = body as Record<string, unknown>;

  const required = ["razao_social", "setor", "faturamento_bracket", "contato_nome", "origem"];
  for (const field of required) {
    if (!b[field] || typeof b[field] !== "string" || (b[field] as string).trim() === "") {
      return { valid: false, error: `Campo obrigatório ausente ou inválido: ${field}` };
    }
  }

  const bracket = b.faturamento_bracket as string;
  if (!VALID_BRACKETS.includes(bracket as RevenueBracket)) {
    return {
      valid: false,
      error: `faturamento_bracket inválido. Valores aceitos: ${VALID_BRACKETS.join(", ")}`,
    };
  }

  const optionalStrings = ["cnpj", "contato_telefone", "contato_email", "contato_cargo", "observacoes"];
  for (const field of optionalStrings) {
    if (b[field] !== undefined && b[field] !== null && typeof b[field] !== "string") {
      return { valid: false, error: `Campo ${field} deve ser string` };
    }
  }

  if (b.contato_email && typeof b.contato_email === "string") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(b.contato_email)) {
      return { valid: false, error: "contato_email inválido" };
    }
  }

  if (b.payload_raw !== undefined && (typeof b.payload_raw !== "object" || Array.isArray(b.payload_raw))) {
    return { valid: false, error: "payload_raw deve ser object" };
  }

  return {
    valid: true,
    data: {
      razao_social: (b.razao_social as string).trim(),
      cnpj: b.cnpj ? (b.cnpj as string).replace(/\D/g, "") : undefined,
      setor: (b.setor as string).trim(),
      faturamento_bracket: bracket as RevenueBracket,
      contato_nome: (b.contato_nome as string).trim(),
      contato_telefone: b.contato_telefone as string | undefined,
      contato_email: b.contato_email as string | undefined,
      contato_cargo: b.contato_cargo as string | undefined,
      origem: (b.origem as string).trim(),
      observacoes: b.observacoes as string | undefined,
      payload_raw: (b.payload_raw as Record<string, unknown>) ?? {},
    },
  };
}

serve(async (req) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey.trim().length < 16) {
      return new Response(
        JSON.stringify({ success: false, error: "API key ausente ou inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyHash = await sha256Hex(apiKey);

    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from("webhook_api_keys")
      .select("id, name, scope, is_active, revoked_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (keyError) {
      console.error("webhook_api_keys lookup error:", keyError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao validar API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!keyRow || !keyRow.is_active || keyRow.revoked_at) {
      return new Response(
        JSON.stringify({ success: false, error: "API key inválida ou revogada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!(keyRow.scope as string[]).includes("leads_inbox")) {
      return new Response(
        JSON.stringify({ success: false, error: "API key sem escopo leads_inbox" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const validation = validatePayload(body);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lead = validation.data;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("leads_inbox")
      .insert({
        razao_social: lead.razao_social,
        cnpj: lead.cnpj,
        setor: lead.setor,
        faturamento_bracket: lead.faturamento_bracket,
        contato_nome: lead.contato_nome,
        contato_telefone: lead.contato_telefone,
        contato_email: lead.contato_email,
        contato_cargo: lead.contato_cargo,
        origem: lead.origem,
        observacoes: lead.observacoes,
        payload_raw: lead.payload_raw,
        status: "pending_review",
      })
      .select("id, received_at")
      .single();

    if (insertError) {
      console.error("leads_inbox insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao registrar lead" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabaseAdmin
      .from("webhook_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    await logAnalyticsEvent(supabaseAdmin, {
      event_type: "domain_event",
      event_name: "lead_intake_received",
      entity_type: "lead_inbox",
      entity_id: inserted.id,
      status: "success",
      duration_ms: Date.now() - startTime,
      metadata: {
        origem: lead.origem,
        bracket: lead.faturamento_bracket,
        api_key_name: keyRow.name,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Lead recebido com sucesso",
        data: { id: inserted.id, received_at: inserted.received_at, status: "pending_review" },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("lead-webhook-intake error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
