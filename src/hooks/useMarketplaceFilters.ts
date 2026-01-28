import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type LotStatus = Database["public"]["Enums"]["lot_status"];
type AssetType = Database["public"]["Enums"]["asset_type"];

export interface MarketplaceFilters {
  assetTypes: AssetType[];
  sectors: string[];
  states: string[];
  cities: string[];
  minScore: number | null;
  maxScore: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  status: LotStatus | "all";
  search: string;
  sortBy: "time_remaining" | "highest_score" | "lowest_price" | "highest_price";
}

const DEFAULT_FILTERS: MarketplaceFilters = {
  assetTypes: [],
  sectors: [],
  states: [],
  cities: [],
  minScore: null,
  maxScore: null,
  minPrice: null,
  maxPrice: null,
  status: "live",
  search: "",
  sortBy: "time_remaining",
};

interface LotWithAssets extends Lot {
  assets: {
    asset_type: AssetType;
    sector: string | null;
    location_state: string | null;
    location_city: string | null;
    base_score: number;
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

const STORAGE_KEY = "marketplace_filters";

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
    const citiesParam = searchParams.get("cities");

    return {
      assetTypes: assetTypesParam
        ? (assetTypesParam.split(",") as AssetType[])
        : [],
      sectors: sectorsParam ? sectorsParam.split(",") : [],
      states: statesParam ? statesParam.split(",") : [],
      cities: citiesParam ? citiesParam.split(",") : [],
      minScore: searchParams.get("minScore")
        ? Number(searchParams.get("minScore"))
        : null,
      maxScore: searchParams.get("maxScore")
        ? Number(searchParams.get("maxScore"))
        : null,
      minPrice: searchParams.get("minPrice")
        ? Number(searchParams.get("minPrice"))
        : null,
      maxPrice: searchParams.get("maxPrice")
        ? Number(searchParams.get("maxPrice"))
        : null,
      status: (searchParams.get("status") as LotStatus | "all") || "live",
      search: searchParams.get("q") || "",
      sortBy:
        (searchParams.get("sort") as MarketplaceFilters["sortBy"]) ||
        "time_remaining",
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
        cities: "cities",
        minScore: "minScore",
        maxScore: "maxScore",
        minPrice: "minPrice",
        maxPrice: "maxPrice",
        status: "status",
        search: "q",
        sortBy: "sort",
      };

      const paramKey = paramMap[key];

      if (
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (key === "status" && value === "live")
      ) {
        newParams.delete(paramKey);
      } else if (Array.isArray(value)) {
        newParams.set(paramKey, value.join(","));
      } else {
        newParams.set(paramKey, String(value));
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
      filters.states.length > 0 ||
      filters.cities.length > 0 ||
      filters.minScore !== null ||
      filters.maxScore !== null ||
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.status !== "live" ||
      filters.search !== ""
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

  // Fetch lots with filters
  useEffect(() => {
    const fetchLots = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build main query
        let query = supabase.from("lots").select("*");

        // Status filter
        if (filters.status !== "all") {
          query = query.eq("status", filters.status);
        }

        // Search filter
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }

        // Price filters
        if (filters.minPrice !== null) {
          query = query.gte("current_price", filters.minPrice);
        }
        if (filters.maxPrice !== null) {
          query = query.lte("current_price", filters.maxPrice);
        }

        // Sorting
        switch (filters.sortBy) {
          case "time_remaining":
            query = query.order("ends_at", { ascending: true, nullsFirst: false });
            break;
          case "lowest_price":
            query = query.order("current_price", { ascending: true });
            break;
          case "highest_price":
            query = query.order("current_price", { ascending: false });
            break;
          case "highest_score":
            // Will sort after fetching assets
            query = query.order("created_at", { ascending: false });
            break;
        }

        const { data: lotsData, error: lotsError } = await query;
        if (lotsError) throw lotsError;

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
          .select("id, asset_type, sector, location_state, location_city, base_score")
          .in("id", assetIds);

        // Fetch bids count
        const { data: bids } = await supabase
          .from("bids")
          .select("lot_id")
          .in("lot_id", lotIds);

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
            assets: lotAssets.map((a) => ({
              asset_type: a.asset_type,
              sector: a.sector,
              location_state: a.location_state,
              location_city: a.location_city,
              base_score: a.base_score,
            })),
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

        if (filters.cities.length > 0) {
          lotsWithAssets = lotsWithAssets.filter((lot) =>
            lot.assets.some(
              (a) => a.location_city && filters.cities.includes(a.location_city)
            )
          );
        }

        if (filters.minScore !== null) {
          lotsWithAssets = lotsWithAssets.filter(
            (lot) => lot.total_score >= filters.minScore!
          );
        }

        if (filters.maxScore !== null) {
          lotsWithAssets = lotsWithAssets.filter(
            (lot) => lot.total_score <= filters.maxScore!
          );
        }

        // Sort by score if needed
        if (filters.sortBy === "highest_score") {
          lotsWithAssets.sort((a, b) => b.total_score - a.total_score);
        }

        setLots(lotsWithAssets);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLots();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("marketplace-lots")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lots" },
        () => fetchLots()
      )
      .subscribe();

    return () => {
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
