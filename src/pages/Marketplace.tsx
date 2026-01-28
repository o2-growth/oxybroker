import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LotCard } from "@/components/auction/LotCard";
import { LotListItem } from "@/components/marketplace/LotListItem";
import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { ViewToggle, ViewMode } from "@/components/marketplace/ViewToggle";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LotGridSkeleton, StatCardSkeleton } from "@/components/ui/lot-skeleton";
import { Search, Gavel, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { useMarketplaceFilters } from "@/hooks/useMarketplaceFilters";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "marketplaceView";

export default function Marketplace() {
  const {
    filters,
    setFilter,
    clearFilters,
    lots,
    loading,
    error,
    hasActiveFilters,
    availableSectors,
    availableStates,
  } = useMarketplaceFilters();

  const isMobile = useIsMobile();

  // View preference - default to list
  const [view, setView] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ViewMode) || "list";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, view);
  }, [view]);

  const stats = {
    live: lots.filter((l) => l.status === "live").length,
    total: lots.length,
    totalValue: lots.reduce((acc, l) => acc + Number(l.current_price), 0),
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              Marketplace
            </h1>
            <p className="text-muted-foreground mt-1">
              Encontre e dê lances nos melhores ativos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isMobile && (
              <MarketplaceFilters
                filters={filters}
                setFilter={setFilter}
                clearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                availableSectors={availableSectors}
                availableStates={availableStates}
              />
            )}
            <ViewToggle view={view} onViewChange={setView} />
          </div>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.live}</p>
                  <p className="text-xs text-muted-foreground">Leilões Ativos</p>
                </div>
              </div>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      notation: "compact",
                    }).format(stats.totalValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                </div>
              </div>
            </div>
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Lotes</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lotes..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          {!isMobile && (
            <MarketplaceFilters
              filters={filters}
              setFilter={setFilter}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              availableSectors={availableSectors}
              availableStates={availableStates}
            />
          )}

          {/* Lots */}
          <div className="flex-1 min-w-0">
            {loading ? (
              view === "grid" ? (
                <LotGridSkeleton count={6} />
              ) : (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              )
            ) : error ? (
              <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-6 text-center">
                <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Erro ao carregar lotes</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            ) : lots.length === 0 ? (
              <div className="border border-border rounded-lg bg-card">
                <EmptyState
                  icon={Gavel}
                  title="Nenhum lote encontrado"
                  description={
                    hasActiveFilters
                      ? "Tente ajustar os filtros ou limpar a busca"
                      : "Não há lotes disponíveis no momento"
                  }
                  action={
                    hasActiveFilters
                      ? {
                          label: "Limpar filtros",
                          onClick: clearFilters,
                        }
                      : undefined
                  }
                />
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {lots.map((lot) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    assetCount={lot.asset_count}
                    bidCount={lot.bid_count}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {lots.map((lot) => (
                  <LotListItem key={lot.id} lot={lot} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
