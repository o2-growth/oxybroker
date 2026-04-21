import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];

export interface PurchaseLead {
  id: string;
  razao_social: string;
  cnpj: string | null;
  setor: string;
  faturamento_bracket: string;
  contato_nome: string;
  contato_telefone: string | null;
  contato_email: string | null;
  contato_cargo: string | null;
  origem: string | null;
  observacoes: string | null;
}

export interface PurchaseWithDetails extends Purchase {
  lot:
    | {
        title: string;
        lead_inbox_id: string | null;
        lead: PurchaseLead | null;
      }
    | null;
}

async function fetchPurchases(userId: string): Promise<PurchaseWithDetails[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select(
      "*, lot:lots(title, lead_inbox_id, lead:leads_inbox!lots_lead_inbox_id_fkey(id, razao_social, cnpj, setor, faturamento_bracket, contato_nome, contato_telefone, contato_email, contato_cargo, origem, observacoes))",
    )
    .eq("buyer_user_id", userId)
    .order("purchased_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as PurchaseWithDetails[];
}

export function usePurchases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.purchases.byUser(user?.id ?? "__none__"),
    queryFn: () => fetchPurchases(user!.id),
    enabled: !!user?.id,
  });
}
