import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Search, Building, MapPin, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Asset = Database["public"]["Tables"]["assets"]["Row"];

const statusConfig = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  available: { label: "Disponível", className: "oxy-badge-success" },
  in_auction: { label: "Em Leilão", className: "oxy-badge-warning" },
  sold: { label: "Vendido", className: "oxy-badge-info" },
  returned: { label: "Devolvido", className: "bg-muted text-muted-foreground" },
  disabled: { label: "Desativado", className: "oxy-badge-danger" },
};

export default function AdminAssets() {
  const { loading: authLoading } = useRoleGuard("admin");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAssets = async () => {
      let query = supabase.from("assets").select("*").order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
      } else {
        setAssets(data || []);
      }
      setLoading(false);
    };

    fetchAssets();
  }, [search]);

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
              <Package className="h-6 w-6 text-primary" />
              Ativos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os ativos disponíveis para leilão
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Ativo
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ativos..."
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
        ) : assets.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum ativo</h3>
            <p className="text-muted-foreground">
              Adicione ativos para criar lotes de leilão
            </p>
          </div>
        ) : (
          <div className="oxy-card overflow-hidden">
            <table className="oxy-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Setor</th>
                  <th>Localização</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const status =
                    statusConfig[asset.status as keyof typeof statusConfig];

                  return (
                    <tr key={asset.id}>
                      <td className="font-medium">{asset.title}</td>
                      <td>
                        <Badge variant="outline" className="capitalize">
                          {asset.asset_type}
                        </Badge>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-sm">
                          <Building className="h-3.5 w-3.5" />
                          {asset.sector || "-"}
                        </span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          {asset.location_city
                            ? `${asset.location_city}, ${asset.location_state}`
                            : "-"}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono">{asset.base_score}</span>
                      </td>
                      <td>
                        <Badge className={status.className}>{status.label}</Badge>
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
