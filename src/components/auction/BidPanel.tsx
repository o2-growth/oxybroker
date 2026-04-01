import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Gavel, AlertTriangle, Clock, Zap, Wallet, AlertCircle, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePlaceBid } from "@/hooks/usePlaceBid";
import { useWallet } from "@/hooks/useWallet";
import { useUserHasBidOnLot } from "@/hooks/useUserHasBidOnLot";
import { useUserMaxBidOnLot } from "@/hooks/useUserMaxBidOnLot";
import { useActivePromotion } from "@/hooks/useActivePromotion";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

interface BidPanelProps {
  lot: Lot;
  userHasBids?: boolean;
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

export const BidPanel = React.forwardRef<HTMLDivElement, BidPanelProps>(({ lot, userHasBids = false, onBidPlaced }, ref) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { placeBid, loading } = usePlaceBid();
  const { wallet, loading: walletLoading, refetch: refetchWallet } = useWallet();
  const { hasBid: hasBidViaRPC } = useUserHasBidOnLot(lot.id);
  const { maxBid: userMaxBid, refetch: refetchMaxBid } = useUserMaxBidOnLot(lot.id);
  const [bidIncrement, setBidIncrement] = useState("");
  const [wasExtended, setWasExtended] = useState(false);

  // Use RPC result as fallback if prop is false (RLS may have blocked the bids query)
  const effectiveUserHasBids = userHasBids || hasBidViaRPC === true;

  // Calculate the increment value and total bid
  const incrementValue = parseCurrencyInput(bidIncrement);
  const currentPrice = Number(lot.current_price);
  const calculatedTotal = currentPrice + incrementValue;

  // Minimum increment: any positive amount for returning bidders, min_bid_increment for new bidders
  const minIncrement = effectiveUserHasBids 
    ? 0.01 
    : Number(lot.min_bid_increment);

  const balance = wallet ? Number(wallet.balance) : 0;
  
  // Check for active promotion on bids
  const { promotion: bidPromotion, calculateBenefit } = useActivePromotion("bid", calculatedTotal);
  const discountAmount = bidPromotion ? calculateBenefit(calculatedTotal) : 0;
  
  // Calculate required balance: only the difference for returning bidders, minus any discount
  const baseRequiredBalance = userMaxBid > 0
    ? Math.max(0, calculatedTotal - userMaxBid)
    : calculatedTotal;
  
  // Apply discount to required balance
  const requiredBalance = Math.max(0, baseRequiredBalance - discountAmount);

  const hasInsufficientBalance = bidIncrement && requiredBalance > balance;

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

    if (isNaN(incrementValue) || incrementValue < minIncrement) {
      toast({
        title: "Incremento inválido",
        description: effectiveUserHasBids 
          ? "Digite um valor maior que zero para adicionar ao lance."
          : `O incremento mínimo é ${formatCurrency(minIncrement)}`,
        variant: "destructive",
      });
      return;
    }

    // Frontend validation for insufficient balance (using required balance, not total)
    if (requiredBalance > balance) {
      toast({
        title: "Saldo insuficiente",
        description: userMaxBid > 0
          ? `Você precisa de ${formatCurrency(requiredBalance)} a mais para este lance. Seu saldo: ${formatCurrency(balance)}.`
          : `Seu saldo é ${formatCurrency(balance)}. Recarregue sua carteira.`,
        variant: "destructive",
      });
      return;
    }

    const result = await placeBid(lot.id, calculatedTotal);

    if (result.success) {
      toast({
        title: result.data?.was_extended ? "🚀 Lance aceito + tempo estendido!" : "✅ Lance aceito!",
        description: result.message,
      });

      if (result.data?.was_extended) {
        setWasExtended(true);
      }

      setBidIncrement("");
      refetchWallet(); // Refresh wallet balance after successful bid
      refetchMaxBid(); // Refresh user's max bid
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
    if (e.key === "Enter" && !loading && bidIncrement && !hasInsufficientBalance) {
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
          <span>
            Saldo insuficiente. 
            {userMaxBid > 0 
              ? ` Necessário: ${formatCurrency(requiredBalance)} (diferença do seu lance anterior).`
              : ` Necessário: ${formatCurrency(requiredBalance)}.`
            }
          </span>
        </div>
      )}

      {/* Current price and calculated total */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Valor atual
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {formatCurrency(currentPrice)}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {effectiveUserHasBids ? "Você participa" : "Ao vivo"}
          </Badge>
        </div>

        {/* Show calculated total when user is typing */}
        {incrementValue > 0 && (
          <div className="space-y-2">
            <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Seu lance será:</p>
              <p className="text-xl font-bold text-primary tabular-nums">
                {formatCurrency(calculatedTotal)}
              </p>
            </div>
            
            {/* Promotion discount info */}
            {bidPromotion && discountAmount > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                  <Gift className="h-4 w-4" />
                  <span className="text-xs font-medium">{bidPromotion.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Desconto de{" "}
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(discountAmount)}
                  </span>
                  {" • Débito real: "}
                  <span className="font-medium">
                    {formatCurrency(requiredBalance)}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Increment input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Adicionar ao valor atual:
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              +
            </span>
            <Input
              type="text"
              placeholder={formatCurrency(minIncrement)}
              value={bidIncrement}
              onChange={(e) => setBidIncrement(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "text-lg h-12 font-medium pl-8",
                hasInsufficientBalance && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={loading}
            />
          </div>
          <Button
            onClick={handleBid}
            disabled={loading || !bidIncrement || hasInsufficientBalance || incrementValue < minIncrement}
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
        <p className="text-xs text-muted-foreground">
          {effectiveUserHasBids 
            ? "Você já participa! Digite qualquer valor para aumentar seu lance."
            : `Incremento mínimo: ${formatCurrency(minIncrement)}`}
        </p>
      </div>

      {/* Quick increment buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidIncrement(formatCurrency(minIncrement))}
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(minIncrement)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidIncrement(formatCurrency(Number(lot.min_bid_increment) * 2))}
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 2)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidIncrement(formatCurrency(Number(lot.min_bid_increment) * 5))}
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 5)}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidIncrement(formatCurrency(Number(lot.min_bid_increment) * 10))}
          disabled={loading}
          className="text-xs"
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 10)}
        </Button>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Lances nos últimos segundos podem estender o leilão automaticamente.
      </p>
    </div>
  );
});
BidPanel.displayName = "BidPanel";
