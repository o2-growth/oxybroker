import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Search, Gavel, Package, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

const statusConfig = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  live: { label: "Ao Vivo", className: "oxy-badge-danger" },
  ended: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", className: "oxy-badge-warning" },
};

export default function AdminLots() {
  const { loading: authLoading } = useRoleGuard("admin");
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchLots = async () => {
      let query = supabase.from("lots").select("*").order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
      } else {
        setLots(data || []);
      }
      setLoading(false);
    };

    fetchLots();
  }, [search]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Lotes
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os lotes de leilão
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Lote
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : lots.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum lote</h3>
            <p className="text-muted-foreground">
              Crie lotes para iniciar leilões
            </p>
          </div>
        ) : (
          <div className="oxy-card overflow-hidden">
            <table className="oxy-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Preço Atual</th>
                  <th>Início</th>
                  <th>Término</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const status = statusConfig[lot.status as keyof typeof statusConfig];

                  return (
                    <tr key={lot.id}>
                      <td className="font-medium">{lot.title}</td>
                      <td>
                        <Badge className={status.className}>
                          {lot.status === "live" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                          )}
                          {status.label}
                        </Badge>
                      </td>
                      <td className="font-mono text-primary">
                        {formatCurrency(Number(lot.current_price))}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {formatDate(lot.starts_at)}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {formatDate(lot.ends_at)}
                      </td>
                      <td>
                        <Link to={`/lots/${lot.id}`}>
                          <Button variant="ghost" size="sm">
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
