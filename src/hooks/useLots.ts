import { useState, useEffect } from "react";
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

  const fetchLots = async () => {
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
  }, [options.status, options.search]);

  return { lots, loading, error, refetch: fetchLots };
}
