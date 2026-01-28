import { AppShell } from "@/components/layout/AppShell";
import { useLots } from "@/hooks/useLots";
import { LotCard } from "@/components/auction/LotCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LotGridSkeleton, StatCardSkeleton } from "@/components/ui/lot-skeleton";
import { Search, Gavel, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LotWithCounts {
  id: string;
  assetCount: number;
  bidCount: number;
}

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "ended">("live");
  const { lots, loading, error } = useLots({
    status: filter === "all" ? undefined : filter === "live" ? "live" : "ended",
    search: search || undefined,
  });
  const [lotCounts, setLotCounts] = useState<Record<string, LotWithCounts>>({});

  useEffect(() => {
    const fetchCounts = async () => {
      if (lots.length === 0) return;

      const lotIds = lots.map((l) => l.id);

      const { data: lotItems } = await supabase
        .from("lot_items")
        .select("lot_id")
        .in("lot_id", lotIds);

      const { data: bids } = await supabase
        .from("bids")
        .select("lot_id")
        .in("lot_id", lotIds);

      const counts: Record<string, LotWithCounts> = {};
      lotIds.forEach((id) => {
        counts[id] = {
          id,
          assetCount: lotItems?.filter((li) => li.lot_id === id).length || 0,
          bidCount: bids?.filter((b) => b.lot_id === id).length || 0,
        };
      });

      setLotCounts(counts);
    };

    fetchCounts();
  }, [lots]);

  const stats = {
    live: lots.filter((l) => l.status === "live").length,
    total: lots.length,
    totalValue: lots.reduce((acc, l) => acc + Number(l.current_price), 0),
  };

  const filterButtons = [
    { key: "live", label: "Ao Vivo" },
    { key: "ended", label: "Encerrados" },
    { key: "all", label: "Todos" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            Marketplace
          </h1>
          <p className="text-muted-foreground mt-1">
            Encontre e dê lances nos melhores ativos
          </p>
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

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
            {filterButtons.map((btn) => (
              <Button
                key={btn.key}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(btn.key)}
                className={cn(
                  "h-7 px-3 text-xs font-medium rounded-md transition-all",
                  filter === btn.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Lots Grid */}
        {loading ? (
          <LotGridSkeleton count={6} />
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
                search
                  ? "Tente uma busca diferente ou ajuste os filtros"
                  : "Não há lotes disponíveis no momento"
              }
              action={
                search
                  ? {
                      label: "Limpar busca",
                      onClick: () => setSearch(""),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lots.map((lot) => (
              <LotCard
                key={lot.id}
                lot={lot}
                assetCount={lotCounts[lot.id]?.assetCount}
                bidCount={lotCounts[lot.id]?.bidCount}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
