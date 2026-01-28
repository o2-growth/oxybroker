import { AppShell } from "@/components/layout/AppShell";
import { useLots } from "@/hooks/useLots";
import { LotCard } from "@/components/auction/LotCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Gavel, TrendingUp, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

      // Fetch asset counts
      const { data: lotItems } = await supabase
        .from("lot_items")
        .select("lot_id")
        .in("lot_id", lotIds);

      // Fetch bid counts
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

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              Marketplace
            </h1>
            <p className="text-muted-foreground mt-1">
              Encontre e dê lances nos melhores ativos
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="oxy-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Gavel className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.live}</p>
                <p className="text-sm text-muted-foreground">Leilões Ativos</p>
              </div>
            </div>
          </div>
          <div className="oxy-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-oxy-info/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-oxy-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  }).format(stats.totalValue)}
                </p>
                <p className="text-sm text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </div>
          <div className="oxy-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-oxy-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-oxy-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Lotes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "live" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("live")}
            >
              Ao Vivo
            </Button>
            <Button
              variant={filter === "ended" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("ended")}
            >
              Encerrados
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todos
            </Button>
          </div>
        </div>

        {/* Lots Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="oxy-card p-8 text-center">
            <p className="text-destructive">Erro ao carregar lotes: {error}</p>
          </div>
        ) : lots.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Gavel className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum lote encontrado</h3>
            <p className="text-muted-foreground">
              {search
                ? "Tente uma busca diferente"
                : "Não há lotes disponíveis no momento"}
            </p>
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
