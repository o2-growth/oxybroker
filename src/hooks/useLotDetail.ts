import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type Bid = Database["public"]["Tables"]["bids"]["Row"];
type Asset = Database["public"]["Tables"]["assets"]["Row"];

interface LotWithDetails extends Lot {
  bids: Bid[];
  assets: Asset[];
}

interface BidPlacedPayload {
  lot_id: string;
  current_price: number;
  ends_at: string;
  was_extended: boolean;
  bid_count: number;
}

export function useLotDetail(lotId: string | undefined) {
  const [lot, setLot] = useState<LotWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasExtended, setWasExtended] = useState(false);

  const fetchLot = useCallback(async () => {
    if (!lotId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch lot
      const { data: lotData, error: lotError } = await supabase
        .from("lots")
        .select("*")
        .eq("id", lotId)
        .maybeSingle();

      if (lotError) throw lotError;
      if (!lotData) {
        setError("Lote não encontrado");
        return;
      }

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
  }, [lotId]);

  useEffect(() => {
    fetchLot();

    if (!lotId) return;

    // Subscribe to realtime lot updates (broadcast from edge function)
    const broadcastChannel = supabase
      .channel(`lot-updates-${lotId}`)
      .on("broadcast", { event: "bid_placed" }, (payload) => {
        const data = payload.payload as BidPlacedPayload;
        
        // Update lot state immediately without refetching
        setLot((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            current_price: data.current_price,
            ends_at: data.ends_at,
          };
        });

        // Trigger extension animation
        if (data.was_extended) {
          setWasExtended(true);
          setTimeout(() => setWasExtended(false), 5000);
        }

        // Refetch to get updated bids list
        fetchLot();
      })
      .subscribe();

    // Subscribe to database changes as backup
    const bidsChannel = supabase
      .channel(`bids-db-${lotId}`)
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

    // Subscribe to lot changes
    const lotChannel = supabase
      .channel(`lot-db-${lotId}`)
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
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(lotChannel);
    };
  }, [lotId, fetchLot]);

  return { lot, loading, error, refetch: fetchLot, wasExtended };
}
