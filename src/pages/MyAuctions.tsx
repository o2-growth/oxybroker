import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useMyAuctions, MyAuctionItem } from "@/hooks/useMyAuctions";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import { Target, Trophy, AlertTriangle, Gavel, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

function AuctionCard({ item }: { item: MyAuctionItem }) {
  const { lot, myHighestBid, lotHighestBid, status, isActive } = item;

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      !isActive && "opacity-75"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={status === "winning" ? "default" : "destructive"}
                className={cn(
                  "text-xs",
                  status === "winning" && "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20",
                  status === "losing" && "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                )}
              >
                {status === "winning" ? (
                  <>
                    <Trophy className="h-3 w-3 mr-1" />
                    Ganhando
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Perdendo
                  </>
                )}
              </Badge>
              {!isActive && (
                <Badge variant="secondary" className="text-xs">
                  Encerrado
                </Badge>
              )}
            </div>

            <h3 className="font-semibold text-base truncate mb-1">
              {lot.title}
            </h3>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>
                <span className="text-xs uppercase tracking-wider">Seu lance</span>
                <p className="font-medium text-foreground tabular-nums">
                  {formatCurrency(myHighestBid)}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider">Lance atual</span>
                <p className="font-medium text-foreground tabular-nums">
                  {formatCurrency(lotHighestBid)}
                </p>
              </div>
              {isActive && lot.ends_at && (
                <div>
                  <span className="text-xs uppercase tracking-wider">Encerra em</span>
                  <div className="font-medium text-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <CountdownTimer endTime={lot.ends_at} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Link to={`/lots/${lot.id}`}>
            <Button variant="outline" size="sm">
              Ver lote
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyAuctions() {
  const { user } = useAuth();
  const { data: auctions = [], isLoading, error } = useMyAuctions();

  const activeAuctions = auctions.filter((a) => a.isActive);
  const endedAuctions = auctions.filter((a) => !a.isActive);

  const winningCount = activeAuctions.filter((a) => a.status === "winning").length;
  const losingCount = activeAuctions.filter((a) => a.status === "losing").length;

  if (!user) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Faça login para continuar</h2>
              <p className="text-muted-foreground mb-4">
                Você precisa estar autenticado para ver seus leilões.
              </p>
              <Link to="/auth/login">
                <Button>Entrar</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Meus Leilões
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe os leilões em que você está participando
          </p>
        </div>

        {/* Stats */}
        {!isLoading && auctions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold tabular-nums">{activeAuctions.length}</div>
                <p className="text-xs text-muted-foreground">Leilões Ativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold tabular-nums text-green-600">{winningCount}</div>
                <p className="text-xs text-muted-foreground">Ganhando</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold tabular-nums text-amber-600">{losingCount}</div>
                <p className="text-xs text-muted-foreground">Perdendo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold tabular-nums">{endedAuctions.length}</div>
                <p className="text-xs text-muted-foreground">Encerrados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Erro ao carregar</h3>
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar seus leilões.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !error && auctions.length === 0 && (
          <Card>
            <EmptyState
              icon={Target}
              title="Nenhuma participação"
              description="Você ainda não participou de nenhum leilão. Visite o Marketplace para dar seus primeiros lances."
              action={{
                label: "Ir para Marketplace",
                onClick: () => window.location.href = "/marketplace",
              }}
            />
          </Card>
        )}

        {/* Active Auctions */}
        {!isLoading && activeAuctions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              Leilões Ativos ({activeAuctions.length})
            </h2>
            <div className="space-y-3">
              {activeAuctions.map((item) => (
                <AuctionCard key={item.lot.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Ended Auctions */}
        {!isLoading && endedAuctions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              Encerrados ({endedAuctions.length})
            </h2>
            <div className="space-y-3">
              {endedAuctions.map((item) => (
                <AuctionCard key={item.lot.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
