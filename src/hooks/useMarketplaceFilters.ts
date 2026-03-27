import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type AssetType = Database["public"]["Enums"]["asset_type"];

export interface MarketplaceFilters {
  assetTypes: AssetType[];
  sectors: string[];
  states: string[];
}

const DEFAULT_FILTERS: MarketplaceFilters = {
  assetTypes: [],
  sectors: [],
  states: [],
};

interface LotWithAssets extends Lot {
  assets: {
    asset_type: AssetType;
    sector: string | null;
    location_state: string | null;
    location_city: string | null;
    base_score: number;
    image_url: string | null;
  }[];
  total_score: number;
  asset_count: number;
  bid_count: number;
}

interface UseMarketplaceFiltersResult {
  filters: MarketplaceFilters;
  setFilter: <K extends keyof MarketplaceFilters>(
    key: K,
    value: MarketplaceFilters[K]
  ) => void;
  clearFilters: () => void;
  lots: LotWithAssets[];
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  availableSectors: string[];
  availableStates: string[];
}

export function useMarketplaceFilters(): UseMarketplaceFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lots, setLots] = useState<LotWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);

  // Parse filters from URL
  const filters = useMemo<MarketplaceFilters>(() => {
    const assetTypesParam = searchParams.get("types");
    const sectorsParam = searchParams.get("sectors");
    const statesParam = searchParams.get("states");

    return {
      assetTypes: assetTypesParam
        ? (assetTypesParam.split(",") as AssetType[])
        : [],
      sectors: sectorsParam ? sectorsParam.split(",") : [],
      states: statesParam ? statesParam.split(",") : [],
    };
  }, [searchParams]);

  const setFilter = useCallback(
    <K extends keyof MarketplaceFilters>(
      key: K,
      value: MarketplaceFilters[K]
    ) => {
      const newParams = new URLSearchParams(searchParams);

      const paramMap: Record<keyof MarketplaceFilters, string> = {
        assetTypes: "types",
        sectors: "sectors",
        states: "states",
      };

      const paramKey = paramMap[key];

      if (Array.isArray(value) && value.length === 0) {
        newParams.delete(paramKey);
      } else if (Array.isArray(value)) {
        newParams.set(paramKey, value.join(","));
      }

      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.assetTypes.length > 0 ||
      filters.sectors.length > 0 ||
      filters.states.length > 0
    );
  }, [filters]);

  // Fetch available filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const { data: assets } = await supabase
        .from("assets")
        .select("sector, location_state")
        .neq("status", "draft");

      if (assets) {
        const sectors = [
          ...new Set(assets.map((a) => a.sector).filter(Boolean)),
        ] as string[];
        const states = [
          ...new Set(assets.map((a) => a.location_state).filter(Boolean)),
        ] as string[];

        setAvailableSectors(sectors.sort());
        setAvailableStates(states.sort());
      }
    };

    fetchFilterOptions();
  }, []);

  // Fetch lots with filters - always live, sorted by ends_at
  useEffect(() => {
    let cancelled = false;

    const fetchLots = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build main query - only live lots, sorted by time remaining
        const query = supabase
          .from("lots")
          .select("*")
          .eq("status", "live")
          .order("ends_at", { ascending: true, nullsFirst: false });

        const { data: lotsData, error: lotsError } = await query;
        if (lotsError) throw lotsError;
        if (cancelled) return;

        if (!lotsData || lotsData.length === 0) {
          setLots([]);
          return;
        }

        const lotIds = lotsData.map((l) => l.id);

        // Fetch lot_items to get asset IDs
        const { data: lotItems } = await supabase
          .from("lot_items")
          .select("lot_id, asset_id")
          .in("lot_id", lotIds);

        // Fetch assets
        const assetIds = [...new Set(lotItems?.map((li) => li.asset_id) || [])];
        const { data: assets } = await supabase
          .from("assets")
          .select("id, asset_type, sector, location_state, location_city, base_score, metadata")
          .in("id", assetIds);

        // Fetch bids count
        const { data: bids } = await supabase
          .from("bids")
          .select("lot_id")
          .in("lot_id", lotIds);

        if (cancelled) return;

        // Map assets to lots
        const assetsByLot: Record<string, typeof assets> = {};
        lotItems?.forEach((li) => {
          if (!assetsByLot[li.lot_id]) assetsByLot[li.lot_id] = [];
          const asset = assets?.find((a) => a.id === li.asset_id);
          if (asset) assetsByLot[li.lot_id].push(asset);
        });

        // Build lots with assets
        let lotsWithAssets: LotWithAssets[] = lotsData.map((lot) => {
          const lotAssets = assetsByLot[lot.id] || [];
          return {
            ...lot,
            assets: lotAssets.map((a) => {
              const meta = a.metadata as Record<string, unknown> | null;
              return {
                asset_type: a.asset_type,
                sector: a.sector,
                location_state: a.location_state,
                location_city: a.location_city,
                base_score: a.base_score,
                image_url: (meta?.image_url as string) || null,
              };
            }),
            total_score: lotAssets.reduce((sum, a) => sum + a.base_score, 0),
            asset_count: lotAssets.length,
            bid_count: bids?.filter((b) => b.lot_id === lot.id).length || 0,
          };
        });

        // Apply asset-based filters
        if (filters.assetTypes.length > 0) {
          lotsWithAssets = lotsWithAssets.filter((lot) =>
            lot.assets.some((a) => filters.assetTypes.includes(a.asset_type))
          );
        }

        if (filters.sectors.length > 0) {
          lotsWithAssets = lotsWithAssets.filter((lot) =>
            lot.assets.some((a) => a.sector && filters.sectors.includes(a.sector))
          );
        }

        if (filters.states.length > 0) {
          lotsWithAssets = lotsWithAssets.filter((lot) =>
            lot.assets.some(
              (a) => a.location_state && filters.states.includes(a.location_state)
            )
          );
        }

        if (!cancelled) {
          setLots(lotsWithAssets);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro inesperado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLots();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("marketplace-lots")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lots" },
        () => {
          if (!cancelled) fetchLots();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [filters]);

  return {
    filters,
    setFilter,
    clearFilters,
    lots,
    loading,
    error,
    hasActiveFilters,
    availableSectors,
    availableStates,
  };
}
