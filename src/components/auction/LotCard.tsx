import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./CountdownTimer";
import { Gavel, Package, Users, ArrowRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

interface LotCardProps {
  lot: Lot;
  assetCount?: number;
  bidCount?: number;
}

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

export function LotCard({ lot, assetCount = 0, bidCount = 0 }: LotCardProps) {
  const status = statusConfig[lot.status as keyof typeof statusConfig];
  const isLive = lot.status === "live";

  return (
    <Card
      className={cn(
        "h-full border-border bg-card transition-all duration-300 group",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        isLive && "ring-1 ring-primary/20"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {lot.title}
          </h3>
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
      </CardHeader>

      <CardContent className="pb-3 space-y-4">
        {lot.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {lot.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            <span>{assetCount} ativo{assetCount !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>{bidCount} lance{bidCount !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Price section */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Lance atual
            </span>
            <span className="text-xl font-bold text-primary tabular-nums">
              {formatCurrency(Number(lot.current_price))}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Incremento mínimo</span>
            <span className="text-foreground font-medium">
              +{formatCurrency(Number(lot.min_bid_increment))}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border flex-col gap-3">
        {/* Timer */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gavel className="h-3.5 w-3.5" />
            <span>{isLive ? "Encerra em" : "Encerrado em"}</span>
          </div>
          {lot.ends_at && isLive ? (
            <CountdownTimer endTime={lot.ends_at} />
          ) : (
            <span className="text-xs text-muted-foreground">
              {lot.ends_at
                ? new Date(lot.ends_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "-"}
            </span>
          )}
        </div>

        {/* CTA */}
        <Link to={`/lots/${lot.id}`} className="w-full">
          <Button
            variant={isLive ? "default" : "outline"}
            size="sm"
            className={cn(
              "w-full gap-2 font-medium transition-all",
              isLive && "bg-primary hover:bg-primary/90"
            )}
          >
            {isLive ? (
              <>
                <Gavel className="h-4 w-4" />
                Dar Lance
              </>
            ) : (
              <>
                Ver Detalhes
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
