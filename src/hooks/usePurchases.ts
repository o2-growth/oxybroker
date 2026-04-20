import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];

export interface PurchaseWithDetails extends Purchase {
  lot: { title: string } | null;
}

async function fetchPurchases(userId: string): Promise<PurchaseWithDetails[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*, lot:lots(title)")
    .eq("buyer_user_id", userId)
    .order("purchased_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export function usePurchases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.purchases.byUser(user?.id ?? "__none__"),
    queryFn: () => fetchPurchases(user!.id),
    enabled: !!user?.id,
  });
}
