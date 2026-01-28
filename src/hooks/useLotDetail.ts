import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type Bid = Database["public"]["Tables"]["bids"]["Row"];
type Asset = Database["public"]["Tables"]["assets"]["Row"];

interface LotWithDetails extends Lot {
  bids: Bid[];
  assets: Asset[];
}

export function useLotDetail(lotId: string | undefined) {
  const [lot, setLot] = useState<LotWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLot = async () => {
    if (!lotId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch lot
      const { data: lotData, error: lotError } = await supabase
        .from("lots")
        .select("*")
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;

      // Fetch bids
      const { data: bidsData, error: bidsError } = await supabase
        .from("bids")
        .select("*")
        .eq("lot_id", lotId)
        .order("amount", { ascending: false });

      if (bidsError) throw bidsError;

      // Fetch assets through lot_items
      const { data: lotItems, error: lotItemsError } = await supabase
        .from("lot_items")
        .select("asset_id")
        .eq("lot_id", lotId);

      if (lotItemsError) throw lotItemsError;

      let assets: Asset[] = [];
      if (lotItems && lotItems.length > 0) {
        const assetIds = lotItems.map((item) => item.asset_id);
        const { data: assetsData, error: assetsError } = await supabase
          .from("assets")
          .select("*")
          .in("id", assetIds);

        if (assetsError) throw assetsError;
        assets = assetsData || [];
      }

      setLot({
        ...lotData,
        bids: bidsData || [],
        assets,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLot();

    if (!lotId) return;

    // Subscribe to bids realtime
    const bidsChannel = supabase
      .channel(`bids-${lotId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bids",
          filter: `lot_id=eq.${lotId}`,
        },
        () => {
          fetchLot();
        }
      )
      .subscribe();

    // Subscribe to lot realtime
    const lotChannel = supabase
      .channel(`lot-${lotId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lots",
          filter: `id=eq.${lotId}`,
        },
        () => {
          fetchLot();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(lotChannel);
    };
  }, [lotId]);

  return { lot, loading, error, refetch: fetchLot };
}
