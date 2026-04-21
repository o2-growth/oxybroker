import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type Bid = Database["public"]["Tables"]["bids"]["Row"];
type Asset = Database["public"]["Tables"]["assets"]["Row"];

// Shape retornada pelo PostgREST com embedded relations
interface LotDetailRow extends Lot {
  lot_items: Array<{
    asset_id: string;
    lot_id: string;
    created_at: string;
    assets: Asset;
  }>;
  bids: Bid[];
}

// Interface publica consumida pelos componentes — identica ao contrato anterior
export interface LotWithDetails extends Lot {
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

async function fetchLotDetail(lotId: string): Promise<LotWithDetails> {
  const { data, error } = await supabase
    .from("lots")
    .select(`
      *,
      lot_items(
        asset_id,
        lot_id,
        created_at,
        assets(*)
      ),
      bids(*)
    `)
    .eq("id", lotId)
    .order("amount", { ascending: false, referencedTable: "bids" })
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Lote não encontrado");

  const raw = data as unknown as LotDetailRow;

  // Extrai assets a partir dos lot_items embedados
  const assets: Asset[] = raw.lot_items
    .map((item) => item.assets)
    .filter((asset): asset is Asset => asset !== null && asset !== undefined);

  return {
    ...raw,
    assets,
    bids: raw.bids ?? [],
  };
}

export function useLotDetail(lotId: string | undefined) {
  const queryClient = useQueryClient();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    if (!lotId) return;

    // Broadcast do edge function: atualiza price/ends_at localmente e invalida
    const broadcastChannel = supabase
      .channel(`lot-updates-${lotId}`)
      .on("broadcast", { event: "bid_placed" }, (payload) => {
        const data = payload.payload as BidPlacedPayload;

        // Atualiza price/ends_at no cache sem esperar refetch completo
        queryClient.setQueryData<LotWithDetails>(
          queryKeys.lots.detail(lotId),
          (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              current_price: data.current_price,
              ends_at: data.ends_at,
            };
          }
        );

        // Aciona animacao de extensao
        if (data.was_extended) {
          setWasExtended(true);
          setTimeout(() => setWasExtended(false), 5000);
        }

        // Invalida para buscar bids atualizados
        queryClient.invalidateQueries({
          queryKey: queryKeys.lots.detail(lotId),
        });
      })
      .subscribe();

    // Fallback: postgres_changes em bids
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
          queryClient.invalidateQueries({
            queryKey: queryKeys.lots.detail(lotId),
          });
        }
      )
      .subscribe();

    // Fallback: postgres_changes no proprio lot
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
          queryClient.invalidateQueries({
            queryKey: queryKeys.lots.detail(lotId),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(lotChannel);
    };
  }, [lotId, queryClient]);

  const error = queryError ? (queryError as Error).message : null;

  return {
    lot: lot ?? null,
    loading,
    error,
    refetch,
    wasExtended,
  };
}
