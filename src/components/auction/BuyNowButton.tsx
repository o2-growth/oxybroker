import React, { useState } from "react";
import { ShoppingCart, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBuyNow } from "@/hooks/useBuyNow";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BuyNowButtonProps {
  lotId: string;
  lotTitle: string;
  currentPrice: number;
  startingPrice: number;
  balance: number;
  disabled?: boolean;
  className?: string;
  onPurchased?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const BuyNowButton = React.forwardRef<HTMLDivElement, BuyNowButtonProps>(({
  lotId,
  lotTitle,
  currentPrice,
  startingPrice,
  balance,
  disabled,
  className,
  onPurchased,
}, ref) => {
  const { buyNow, loading } = useBuyNow();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Calculate buy now price: 1.8x of current_price (or starting_price if no bids)
  const buyNowPrice = Math.round(
    (currentPrice > startingPrice ? currentPrice : startingPrice) * 1.8 * 100
  ) / 100;

  const hasSufficientBalance = balance >= buyNowPrice;

  const handleBuyNow = async () => {
    const result = await buyNow(lotId);

    if (result.success) {
      toast({
        title: "🎉 Compra realizada com sucesso!",
        description: `Você adquiriu "${result.data?.lot_title}" por ${formatCurrency(result.data?.buy_now_price || 0)}`,
      });
      setOpen(false);
      onPurchased?.();
      navigate("/purchases");
    } else {
      toast({
        title: "Erro na compra",
        description: result.error || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
            className
          )}
          disabled={disabled || !hasSufficientBalance || loading}
        >
          <Zap className="h-4 w-4" />
          Comprar agora ({formatCurrency(buyNowPrice)})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Confirmar Compra Imediata
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a comprar <strong>"{lotTitle}"</strong> pelo
              preço de compra imediata.
            </p>
            <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lance atual:</span>
                <span>{formatCurrency(currentPrice)}</span>
              </div>
              <div className="flex justify-between font-semibold text-primary">
                <span>Preço de compra (1.8x):</span>
                <span>{formatCurrency(buyNowPrice)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Seu saldo:</span>
                <span className={!hasSufficientBalance ? "text-destructive" : ""}>
                  {formatCurrency(balance)}
                </span>
              </div>
            </div>
            {!hasSufficientBalance && (
              <p className="text-destructive text-sm">
                Saldo insuficiente. Você precisa de mais{" "}
                {formatCurrency(buyNowPrice - balance)} para completar esta
                compra.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Esta ação é irreversível. O leilão será encerrado imediatamente e
              você será o vencedor.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBuyNow}
            disabled={loading || !hasSufficientBalance}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            Confirmar Compra
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
BuyNowButton.displayName = "BuyNowButton";
