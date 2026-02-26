import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
type Return = Database["public"]["Tables"]["returns"]["Row"];

export interface PurchaseWithDetails extends Purchase {
  lot: { title: string } | null;
  return_request?: Return | null;
}

async function fetchPurchasesWithReturns(userId: string): Promise<PurchaseWithDetails[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, lot:lots(title)")
    .eq("buyer_user_id", userId)
    .order("purchased_at", { ascending: false });

  if (error) throw error;

  const purchaseIds = (data || []).map((p) => p.id);

  if (purchaseIds.length === 0) {
    return [];
  }

  const { data: returns, error: returnsError } = await supabase
    .from("returns")
    .select("*")
    .in("purchase_id", purchaseIds);

  if (returnsError) throw returnsError;

  const returnMap = new Map((returns || []).map((r) => [r.purchase_id, r]));

  return (data || []).map((p) => ({
    ...p,
    return_request: returnMap.get(p.id) || null,
  }));
}

export function usePurchases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: user?.id ? queryKeys.purchases.byUser(user.id) : queryKeys.purchases.all,
    queryFn: () => fetchPurchasesWithReturns(user!.id),
    enabled: !!user?.id,
  });
}
