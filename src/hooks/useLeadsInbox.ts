import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

export type LeadInboxStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "in_auction"
  | "sold_pre_auction"
  | "sold_auction"
  | "expired";

export type RevenueBracket =
  | "200k_350k"
  | "350k_500k"
  | "500k_1m"
  | "1m_5m"
  | "5m_plus";

export interface LeadInboxRow {
  id: string;
  razao_social: string;
  cnpj: string | null;
  setor: string;
  faturamento_bracket: RevenueBracket;
  contato_nome: string;
  contato_telefone: string | null;
  contato_email: string | null;
  contato_cargo: string | null;
  origem: string;
  observacoes: string | null;
  status: LeadInboxStatus;
  price_cached: number | null;
  lot_id: string | null;
  purchase_id: string | null;
  received_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  expired_at: string | null;
  pipefy_sent_at: string | null;
  pipefy_card_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useLeadsInbox(filter?: { status?: LeadInboxStatus | "all" }) {
  const statusFilter = filter?.status ?? "pending_review";

  return useQuery({
    queryKey: queryKeys.leadsInbox.byStatus(statusFilter),
    queryFn: async (): Promise<LeadInboxRow[]> => {
      let query = supabase
        .from("leads_inbox" as never)
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LeadInboxRow[];
    },
    staleTime: 10_000,
  });
}

export function useApproveLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { leadId: string; customDurationMinutes?: number }) => {
      const { data, error } = await supabase.rpc("promote_lead_to_auction" as never, {
        p_lead_id: vars.leadId,
        p_created_by: (await supabase.auth.getUser()).data.user?.id,
        p_custom_duration_minutes: vars.customDurationMinutes ?? null,
      } as never);

      if (error) throw error;

      const result = data as { error_code?: string; error_message?: string; lot_id?: string };
      if (result?.error_code) {
        throw new Error(result.error_message ?? "Erro ao aprovar lead");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadsInbox.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all });
      toast.success("Lead aprovado e leilão iniciado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRejectLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { leadId: string; reason: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("leads_inbox" as never)
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_by: user.id,
          rejection_reason: vars.reason,
        } as never)
        .eq("id", vars.leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadsInbox.all });
      toast.success("Lead rejeitado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { leadId: string; patch: Partial<LeadInboxRow> }) => {
      const { error } = await supabase
        .from("leads_inbox" as never)
        .update(vars.patch as never)
        .eq("id", vars.leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leadsInbox.all });
      toast.success("Lead atualizado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
