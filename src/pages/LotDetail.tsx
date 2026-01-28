import { useParams, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useLotDetail } from "@/hooks/useLotDetail";
import { BidPanel } from "@/components/auction/BidPanel";
import { BuyNowButton } from "@/components/auction/BuyNowButton";
import { AuctionStatusBadge } from "@/components/auction/AuctionStatusBadge";
import { CountdownTimer } from "@/components/auction/CountdownTimer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Package,
  MapPin,
  Users,
  DollarSign,
  Building,
  Gavel,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useAuctionStatus } from "@/hooks/useAuctionStatus";

const ASSET_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  mql: "MQL",
  meeting: "Meeting",
  client: "Cliente",
  mlq: "MLQ",
};

export default function LotDetail() {
  const { id } = useParams();
  const { lot, loading, error, refetch, wasExtended } = useLotDetail(id);
  const { user } = useAuth();
  const { wallet, refetch: refetchWallet } = useWallet();
  const auctionStatus = useAuctionStatus(lot?.bids || []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const handlePurchased = () => {
    refetch();
    refetchWallet();
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !lot) {
    return (
      <AppShell>
        <div className="oxy-card p-8 text-center">
          <p className="text-destructive">
            {error || "Lote não encontrado"}
          </p>
          <Link to="/marketplace">
            <Button className="mt-4">Voltar ao Marketplace</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isLive = lot.status === "live";
  const balance = wallet ? Number(wallet.balance) : 0;

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/marketplace">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{lot.title}</h1>
              <Badge
                className={
                  isLive
                    ? "oxy-badge-danger"
                    : "oxy-badge bg-muted text-muted-foreground"
                }
              >
                {isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                )}
                {lot.status === "live"
                  ? "Ao Vivo"
                  : lot.status === "ended"
                  ? "Encerrado"
                  : lot.status}
              </Badge>
            </div>
            {lot.description && (
              <p className="text-muted-foreground mt-1">{lot.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auction Status Badge */}
            {user && isLive && (
              <AuctionStatusBadge
                status={auctionStatus.status}
                myBidAmount={auctionStatus.myLastBid ? Number(auctionStatus.myLastBid.amount) : null}
              />
            )}

            {/* Price & Timer */}
            <div className="oxy-card p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Lance Atual
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(Number(lot.current_price))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Início: {formatCurrency(Number(lot.starting_price))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">
                    {isLive ? "Encerra em" : "Encerrou em"}
                  </p>
                  {lot.ends_at && isLive ? (
                    <CountdownTimer endTime={lot.ends_at} wasExtended={wasExtended} />
                  ) : (
                    <p className="text-lg font-medium">
                      {lot.ends_at ? formatDate(lot.ends_at) : "-"}
                    </p>
                  )}
                </div>
              </div>

              {/* Buy Now Button */}
              {user && isLive && (
                <div className="mt-4 pt-4 border-t border-border">
                  <BuyNowButton
                    lotId={lot.id}
                    lotTitle={lot.title}
                    currentPrice={Number(lot.current_price)}
                    startingPrice={Number(lot.starting_price)}
                    balance={balance}
                    onPurchased={handlePurchased}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Assets */}
            <div className="oxy-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Ativos Incluídos ({lot.assets.length})
                </h2>
              </div>
              <div className="divide-y divide-border">
                {lot.assets.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum ativo neste lote
                  </div>
                ) : (
                  lot.assets.map((asset) => (
                    <div key={asset.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{asset.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            {asset.sector && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3.5 w-3.5" />
                                {asset.sector}
                              </span>
                            )}
                            {asset.location_city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {asset.location_city}, {asset.location_state}
                              </span>
                            )}
                            {asset.employees_count && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {asset.employees_count} func.
                              </span>
                            )}
                            {asset.revenue_range && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5" />
                                {asset.revenue_range}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className="oxy-badge-info">
                          Score: {asset.base_score}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bid History */}
            <div className="oxy-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-semibold flex items-center gap-2">
                  <Gavel className="h-4 w-4" />
                  Histórico de Lances ({lot.bids.length})
                </h2>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto oxy-scrollbar">
                {lot.bids.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhum lance ainda. Seja o primeiro!
                  </div>
                ) : (
                  lot.bids.map((bid, index) => (
                    <div
                      key={bid.id}
                      className={`p-3 flex items-center justify-between ${
                        index === 0 ? "bg-[hsl(var(--oxy-success))]/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {index === 0 && (
                          <span className="text-[hsl(var(--oxy-success))]">👑</span>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {formatDate(bid.created_at)}
                        </span>
                        {bid.user_id === user?.id && (
                          <Badge variant="outline" className="text-xs">
                            Você
                          </Badge>
                        )}
                      </div>
                      <span
                        className={`font-mono font-semibold ${
                          index === 0 ? "text-[hsl(var(--oxy-success))]" : ""
                        }`}
                      >
                        {formatCurrency(Number(bid.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Bid Panel */}
          <div className="space-y-4">
            <BidPanel lot={lot} onBidPlaced={refetch} />

            <div className="oxy-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Informações</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Incremento mínimo</span>
                  <span>{formatCurrency(Number(lot.min_bid_increment))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início</span>
                  <span>
                    {lot.starts_at ? formatDate(lot.starts_at) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Término</span>
                  <span>
                    {lot.ends_at ? formatDate(lot.ends_at) : "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
