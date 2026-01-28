import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Gavel, AlertTriangle, Clock, Zap, Wallet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePlaceBid } from "@/hooks/usePlaceBid";
import { useWallet } from "@/hooks/useWallet";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

interface BidPanelProps {
  lot: Lot;
  onBidPlaced?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const parseCurrencyInput = (value: string): number => {
  // Remove currency symbol, dots (thousand separators), and convert comma to dot
  const cleaned = value
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
};

export function BidPanel({ lot, onBidPlaced }: BidPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { placeBid, loading } = usePlaceBid();
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();
  const [bidAmount, setBidAmount] = useState("");
  const [wasExtended, setWasExtended] = useState(false);

  const minBid = Number(lot.current_price) + Number(lot.min_bid_increment);
  const currentBidAmount = parseCurrencyInput(bidAmount);
  const balance = wallet ? Number(wallet.balance) : 0;
  const hasInsufficientBalance = bidAmount && currentBidAmount > balance;

  // Reset extended animation after a few seconds
  useEffect(() => {
    if (wasExtended) {
      const timer = setTimeout(() => setWasExtended(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [wasExtended]);

  const handleBid = async () => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para dar lances.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseCurrencyInput(bidAmount);

    if (isNaN(amount) || amount < minBid) {
      toast({
        title: "Lance inválido",
        description: `O lance mínimo é ${formatCurrency(minBid)}`,
        variant: "destructive",
      });
      return;
    }

    // Frontend validation for insufficient balance
    if (amount > balance) {
      toast({
        title: "Saldo insuficiente",
        description: `Seu saldo é ${formatCurrency(balance)}. Recarregue sua carteira.`,
        variant: "destructive",
      });
      return;
    }

    const result = await placeBid(lot.id, amount);

    if (result.success) {
      toast({
        title: result.data?.was_extended ? "🚀 Lance aceito + tempo estendido!" : "✅ Lance aceito!",
        description: result.message,
      });

      if (result.data?.was_extended) {
        setWasExtended(true);
      }

      setBidAmount("");
      refetchWallet(); // Refresh wallet balance after successful bid
      onBidPlaced?.();
    } else {
      toast({
        title: "Erro ao dar lance",
        description: result.error || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && bidAmount && !hasInsufficientBalance) {
      handleBid();
    }
  };

  const isLive = lot.status === "live";
  const hasEnded = lot.ends_at && new Date(lot.ends_at) < new Date();

  if (!isLive || hasEnded) {
    return (
      <div className="p-6 bg-muted/50 border border-border rounded-lg text-center">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground font-medium">
          {hasEnded ? "Este leilão foi encerrado." : "Este leilão ainda não começou."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-4 p-5 bg-card border rounded-lg transition-all duration-500",
        wasExtended
          ? "border-primary ring-2 ring-primary/30 animate-pulse"
          : "border-border"
      )}
    >
      {/* Extension indicator */}
      {wasExtended && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-md">
          <Zap className="h-4 w-4" />
          <span className="font-medium">Anti-sniping: tempo estendido!</span>
        </div>
      )}

      {/* Wallet balance display */}
      {user && (
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Seu saldo:</span>
            {walletLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <span className={cn(
                "font-medium tabular-nums",
                hasInsufficientBalance ? "text-destructive" : "text-foreground"
              )}>
                {formatCurrency(balance)}
              </span>
            )}
          </div>
          <Link to="/wallet">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Recarregar
            </Button>
          </Link>
        </div>
      )}

      {/* Insufficient balance warning */}
      {hasInsufficientBalance && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>Saldo insuficiente para este lance.</span>
        </div>
      )}

      {/* Current price and minimum bid */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Lance mínimo
          </p>
          <p className="text-2xl font-bold text-primary tabular-nums">
            {formatCurrency(minBid)}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Ao vivo
        </Badge>
      </div>

      {/* Bid input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={formatCurrency(minBid)}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "text-lg h-12 font-medium",
              hasInsufficientBalance && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleBid}
          disabled={loading || !bidAmount || hasInsufficientBalance}
          size="lg"
          className="h-12 px-6 gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gavel className="h-4 w-4" />
          )}
          Dar Lance
        </Button>
      </div>

      {/* Quick bid buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidAmount(formatCurrency(minBid))}
          disabled={loading}
          className="text-xs"
        >
          Mínimo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setBidAmount(formatCurrency(minBid + Number(lot.min_bid_increment)))
          }
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment))}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setBidAmount(
              formatCurrency(minBid + Number(lot.min_bid_increment) * 2)
            )
          }
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 2)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setBidAmount(
              formatCurrency(minBid + Number(lot.min_bid_increment) * 5)
            )
          }
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 5)}
        </Button>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Lances nos últimos segundos podem estender o leilão automaticamente.
      </p>
    </div>
  );
}
