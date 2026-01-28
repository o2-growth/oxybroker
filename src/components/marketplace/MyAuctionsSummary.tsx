import { Link } from "react-router-dom";
import { useMyAuctions } from "@/hooks/useMyAuctions";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import { Target, Trophy, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function MyAuctionsSummary() {
  const { user } = useAuth();
  const { data: auctions = [], isLoading } = useMyAuctions();

  // Only show active auctions, max 5
  const activeAuctions = auctions.filter((a) => a.isActive).slice(0, 5);
  const totalActive = auctions.filter((a) => a.isActive).length;

  // Don't show anything if user is not logged in or has no active participations
  if (!user) return null;
  if (!isLoading && activeAuctions.length === 0) return null;

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Minhas Participações
          {totalActive > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {totalActive}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            {activeAuctions.map((item) => (
              <Link
                key={item.lot.id}
                to={`/lots/${item.lot.id}`}
                className="block"
              >
                <div className={cn(
                  "p-3 rounded-lg border transition-all duration-200",
                  "hover:bg-accent/50 hover:border-accent",
                  item.status === "winning" 
                    ? "border-green-500/30 bg-green-500/5" 
                    : "border-amber-500/30 bg-amber-500/5"
                )}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate flex-1">
                      {item.lot.title}
                    </span>
                    {item.status === "winning" ? (
                      <Trophy className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.lotHighestBid)}
                    </span>
                    {item.lot.ends_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <CountdownTimer endTime={item.lot.ends_at} />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}

            {totalActive > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                + {totalActive - 5} outros leilões
              </p>
            )}

            <Link to="/my-auctions" className="block">
              <Button variant="outline" size="sm" className="w-full">
                Ver todos
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
