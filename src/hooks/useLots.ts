import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type LotStatus = Database["public"]["Enums"]["lot_status"];

interface UseLotOptions {
  status?: LotStatus;
  search?: string;
}

export function useLots(options: UseLotOptions = {}) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("lots")
        .select("*")
        .order("ends_at", { ascending: true });

      if (options.status) {
        query = query.eq("status", options.status);
      }

      if (options.search) {
        query = query.ilike("title", `%${options.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLots(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [options.search, options.status]);

  useEffect(() => {
    fetchLots();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("lots-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lots",
        },
        () => {
          fetchLots();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLots]);

  return { lots, loading, error, refetch: fetchLots };
}
