import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type Transfer = Database["public"]["Tables"]["transfers"]["Row"];

interface TransferWithProfiles extends Transfer {
  from_profile: { full_name: string | null; email: string | null } | null;
  to_profile: { full_name: string | null; email: string | null } | null;
}

export function useTransfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<TransferWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch transfers where user is sender or recipient
      const { data: transferData, error: transferError } = await supabase
        .from("transfers")
        .select("*")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (transferError) throw transferError;

      // Get unique user IDs for profile lookup
      const userIds = new Set<string>();
      transferData?.forEach((t) => {
        userIds.add(t.from_user_id);
        userIds.add(t.to_user_id);
      });

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Combine data
      const enrichedTransfers: TransferWithProfiles[] = (transferData || []).map((t) => ({
        ...t,
        from_profile: profileMap.get(t.from_user_id) || null,
        to_profile: profileMap.get(t.to_user_id) || null,
      }));

      setTransfers(enrichedTransfers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [user?.id]);

  return { transfers, loading, error, refetch: fetchTransfers };
}
