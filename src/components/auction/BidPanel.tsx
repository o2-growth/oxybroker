import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];

interface BidPanelProps {
  lot: Lot;
  onBidPlaced?: () => void;
}

export function BidPanel({ lot, onBidPlaced }: BidPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bidAmount, setBidAmount] = useState("");

  const minBid = Number(lot.current_price) + Number(lot.min_bid_increment);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleBid = async () => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para dar lances.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(bidAmount.replace(/[^\d,]/g, "").replace(",", "."));

    if (isNaN(amount) || amount < minBid) {
      toast({
        title: "Lance inválido",
        description: `O lance mínimo é ${formatCurrency(minBid)}`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Insert bid
      const { error: bidError } = await supabase.from("bids").insert({
        lot_id: lot.id,
        user_id: user.id,
        amount,
      });

      if (bidError) throw bidError;

      // Update lot current price
      const { error: lotError } = await supabase
        .from("lots")
        .update({ current_price: amount })
        .eq("id", lot.id);

      if (lotError) throw lotError;

      toast({
        title: "Lance registrado!",
        description: `Seu lance de ${formatCurrency(amount)} foi aceito.`,
      });

      setBidAmount("");
      onBidPlaced?.();
    } catch (error: any) {
      toast({
        title: "Erro ao dar lance",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isLive = lot.status === "live";
  const hasEnded = lot.ends_at && new Date(lot.ends_at) < new Date();

  if (!isLive || hasEnded) {
    return (
      <div className="p-4 bg-muted rounded-lg text-center">
        <p className="text-muted-foreground">
          {hasEnded ? "Este leilão foi encerrado." : "Este leilão ainda não começou."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-card border border-border rounded-lg">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Lance mínimo</p>
        <p className="text-xl font-bold text-primary">{formatCurrency(minBid)}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={formatCurrency(minBid)}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="text-lg"
          />
        </div>
        <Button onClick={handleBid} disabled={loading || !bidAmount} size="lg">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Dar Lance
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidAmount(formatCurrency(minBid))}
        >
          Mínimo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidAmount(formatCurrency(minBid + Number(lot.min_bid_increment)))}
        >
          +{formatCurrency(Number(lot.min_bid_increment))}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBidAmount(formatCurrency(minBid + Number(lot.min_bid_increment) * 2))}
        >
          +{formatCurrency(Number(lot.min_bid_increment) * 2)}
        </Button>
      </div>
    </div>
  );
}
