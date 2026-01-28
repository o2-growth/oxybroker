import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "./CountdownTimer";
import { Gavel, Package, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

interface LotCardProps {
  lot: Lot;
  assetCount?: number;
  bidCount?: number;
}

const statusConfig = {
  draft: { label: "Rascunho", className: "oxy-badge bg-muted text-muted-foreground" },
  live: { label: "Ao Vivo", className: "oxy-badge-danger" },
  ended: { label: "Encerrado", className: "oxy-badge bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", className: "oxy-badge-warning" },
};

export function LotCard({ lot, assetCount = 0, bidCount = 0 }: LotCardProps) {
  const status = statusConfig[lot.status as keyof typeof statusConfig];
  const isLive = lot.status === "live";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Link to={`/lots/${lot.id}`}>
      <Card className="oxy-card-glow h-full hover:border-primary/30 transition-all duration-300 group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
              {lot.title}
            </h3>
            <Badge className={status.className}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
              {status.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {lot.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {lot.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              <span>{assetCount} ativos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>{bidCount} lances</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lance atual</span>
              <span className="oxy-price-large">
                {formatCurrency(Number(lot.current_price))}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Incremento mínimo</span>
              <span className="text-foreground">
                +{formatCurrency(Number(lot.min_bid_increment))}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t border-border">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Gavel className="h-3.5 w-3.5" />
              <span>Encerra em</span>
            </div>
            {lot.ends_at && isLive ? (
              <CountdownTimer endTime={lot.ends_at} />
            ) : (
              <span className="text-sm text-muted-foreground">
                {lot.ends_at ? new Date(lot.ends_at).toLocaleDateString("pt-BR") : "-"}
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
