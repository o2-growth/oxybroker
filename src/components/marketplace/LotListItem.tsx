import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import { Gavel, Package, Users, ArrowRight, MapPin, Building } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type AssetType = Database["public"]["Enums"]["asset_type"];

interface LotListItemProps {
  lot: Lot & {
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
  };
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  lead: "Lead",
  mql: "MQL",
  meeting: "Meeting",
  client: "Cliente",
  mlq: "MLQ",
};

const statusConfig = {
  draft: { label: "Rascunho", variant: "muted" as const },
  live: { label: "Ao Vivo", variant: "live" as const },
  ended: { label: "Encerrado", variant: "muted" as const },
  cancelled: { label: "Cancelado", variant: "warning" as const },
};

const badgeVariants = {
  muted: "bg-muted text-muted-foreground border-muted",
  live: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};

export function LotListItem({ lot }: LotListItemProps) {
  const status = statusConfig[lot.status as keyof typeof statusConfig];
  const isLive = lot.status === "live";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Get unique asset types
  const assetTypes = [...new Set(lot.assets.map((a) => a.asset_type))];
  
  // Get locations
  const locations = [...new Set(
    lot.assets
      .filter((a) => a.location_state)
      .map((a) => a.location_state)
  )].slice(0, 2);

  // Get sectors
  const sectors = [...new Set(
    lot.assets.filter((a) => a.sector).map((a) => a.sector)
  )].slice(0, 2);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-border rounded-lg bg-card transition-all",
        "hover:border-primary/40 hover:shadow-md",
        isLive && "ring-1 ring-primary/20"
      )}
    >
      {/* Main Info */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="font-semibold text-sm truncate">{lot.title}</h3>
          <Badge
            className={cn(
              "shrink-0 text-xs font-medium border",
              badgeVariants[status.variant]
            )}
          >
            {isLive && (
              <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
            )}
            {status.label}
          </Badge>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Package className="h-3.5 w-3.5" />
            {lot.asset_count} ativo{lot.asset_count !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {lot.bid_count} lance{lot.bid_count !== 1 ? "s" : ""}
          </span>
          {locations.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {locations.join(", ")}
            </span>
          )}
          {sectors.length > 0 && (
            <span className="flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              {sectors.join(", ")}
            </span>
          )}
        </div>

        {/* Asset types */}
        <div className="flex gap-1 flex-wrap">
          {assetTypes.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {ASSET_TYPE_LABELS[type]}
            </Badge>
          ))}
          {lot.total_score > 0 && (
            <Badge className="oxy-badge-info text-xs">
              Score: {lot.total_score}
            </Badge>
          )}
        </div>
      </div>

      {/* Price & Timer */}
      <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 shrink-0">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Lance atual</p>
          <p className="text-lg font-bold text-primary tabular-nums">
            {formatCurrency(Number(lot.current_price))}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Gavel className="h-3.5 w-3.5" />
          {lot.ends_at && isLive ? (
            <CountdownTimer endTime={lot.ends_at} />
          ) : (
            <span>
              {lot.ends_at
                ? new Date(lot.ends_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })
                : "-"}
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link to={`/lots/${lot.id}`} className="shrink-0">
        <Button
          variant={isLive ? "default" : "outline"}
          size="sm"
          className={cn("gap-2", isLive && "bg-primary hover:bg-primary/90")}
        >
          {isLive ? (
            <>
              <Gavel className="h-4 w-4" />
              Dar Lance
            </>
          ) : (
            <>
              Ver
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </Link>
    </div>
  );
}
