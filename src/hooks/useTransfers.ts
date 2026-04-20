import { useState, useEffect, useCallback } from "react";
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
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: transferData, error: transferError } = await supabase
          .from("transfers")
          .select("*")
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (transferError) throw transferError;

        const userIds = new Set<string>();
        transferData?.forEach((t) => {
          userIds.add(t.from_user_id);
          userIds.add(t.to_user_id);
        });

        const { data: profiles } = userIds.size > 0
          ? await supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", Array.from(userIds))
          : { data: [] };

        if (cancelled) return;

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        const enrichedTransfers: TransferWithProfiles[] = (transferData || []).map((t) => ({
          ...t,
          from_profile: profileMap.get(t.from_user_id) || null,
          to_profile: profileMap.get(t.to_user_id) || null,
        }));

        setTransfers(enrichedTransfers);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => { cancelled = true; };
  }, [user?.id, refetchKey]);

  return { transfers, loading, error, refetch };
}
