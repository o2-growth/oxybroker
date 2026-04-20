import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sprint 4 — STORY-028
// Envia leads expirados (status='expired', pipefy_sent_at IS NULL) para o Pipefy da Matriz.
//
// STATUS: STUB — credenciais do Pipefy ainda não disponíveis (2026-04-20).
// Quando credenciais estiverem prontas, implementar chamada GraphQL ao endpoint:
//   POST https://api.pipefy.com/graphql
//   Authorization: Bearer ${PIPEFY_API_TOKEN}
// Mutation: createCard(pipe_id, fields_attributes) — ver https://developers.pipefy.com
//
// Até lá, esta função apenas marca os leads como "pipefy_sent_at=now()" e registra
// no log para facilitar QA / integração futura.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HandoffResult {
  lead_id: string;
  success: boolean;
  pipefy_card_id?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const pipefyToken = Deno.env.get("PIPEFY_API_TOKEN"); // TODO: configurar quando disponível
    const pipefyPipeId = Deno.env.get("PIPEFY_MATRIZ_PIPE_ID"); // TODO: configurar

    // Auth: cron secret ou admin
    const providedCronSecret = req.headers.get("X-Cron-Secret");
    const authHeader = req.headers.get("Authorization");
    const isCronAuthorized = cronSecret && providedCronSecret === cronSecret;

    if (!isCronAuthorized) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const supabaseUser = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabaseUser.auth.getClaims(token);

      if (!claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const userId = claimsData.claims.sub as string;
      const supabaseCheck = createClient(supabaseUrl, supabaseServiceKey);
      const { data: hasAdminRole } = await supabaseCheck.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (!hasAdminRole) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Busca leads pendentes de handoff via view
    const { data: pendingLeads, error: pendingError } = await supabaseAdmin
      .from("leads_pending_pipefy_handoff")
      .select("*")
      .limit(50);

    if (pendingError) {
      console.error("leads_pending_pipefy_handoff error:", pendingError);
      return new Response(
        JSON.stringify({ success: false, error: pendingError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum lead pendente de handoff", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[pipefy-handoff] ${pendingLeads.length} leads pendentes`);

    const results: HandoffResult[] = [];
    const isStub = !pipefyToken || !pipefyPipeId;

    if (isStub) {
      console.warn(
        "[pipefy-handoff] STUB MODE: PIPEFY_API_TOKEN ou PIPEFY_MATRIZ_PIPE_ID não configurados. " +
          "Apenas marcando pipefy_sent_at sem chamar API externa.",
      );
    }

    for (const lead of pendingLeads) {
      try {
        let pipefyCardId: string | null = null;

        if (!isStub) {
          // TODO: chamar Pipefy GraphQL quando credenciais estiverem disponíveis
          // const response = await fetch("https://api.pipefy.com/graphql", {
          //   method: "POST",
          //   headers: {
          //     "Content-Type": "application/json",
          //     Authorization: `Bearer ${pipefyToken}`,
          //   },
          //   body: JSON.stringify({
          //     query: `mutation CreateCard($pipeId: ID!, $fields: [FieldValueInput!]!) {
          //       createCard(input: { pipe_id: $pipeId, fields_attributes: $fields }) {
          //         card { id }
          //       }
          //     }`,
          //     variables: {
          //       pipeId: pipefyPipeId,
          //       fields: [
          //         { field_id: "razao_social", field_value: lead.razao_social },
          //         { field_id: "cnpj", field_value: lead.cnpj ?? "" },
          //         { field_id: "setor", field_value: lead.setor },
          //         { field_id: "faturamento", field_value: lead.faturamento_bracket },
          //         { field_id: "contato_nome", field_value: lead.contato_nome },
          //         { field_id: "contato_email", field_value: lead.contato_email ?? "" },
          //         { field_id: "contato_telefone", field_value: lead.contato_telefone ?? "" },
          //         { field_id: "origem", field_value: lead.origem },
          //         { field_id: "observacoes", field_value: lead.observacoes ?? "" },
          //       ],
          //     },
          //   }),
          // });
          // const json = await response.json();
          // pipefyCardId = json?.data?.createCard?.card?.id ?? null;
          // if (!pipefyCardId) throw new Error(json?.errors?.[0]?.message ?? "Pipefy sem card id");
        }

        await supabaseAdmin
          .from("leads_inbox")
          .update({
            pipefy_sent_at: new Date().toISOString(),
            pipefy_card_id: pipefyCardId ?? `stub-${lead.id.slice(0, 8)}`,
          })
          .eq("id", lead.id);

        results.push({
          lead_id: lead.id,
          success: true,
          pipefy_card_id: pipefyCardId ?? undefined,
        });
      } catch (err) {
        console.error(`[pipefy-handoff] erro lead ${lead.id}:`, err);
        results.push({
          lead_id: lead.id,
          success: false,
          error: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        stub_mode: isStub,
        sent: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("pipefy-handoff error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
