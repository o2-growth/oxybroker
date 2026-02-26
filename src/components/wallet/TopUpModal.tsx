import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTopUp } from "@/hooks/useTopUp";
import { useActivePromotion } from "@/hooks/useActivePromotion";
import { Loader2, Gift } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface TopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000];

export function TopUpModal({ open, onOpenChange }: TopUpModalProps) {
  const { createCheckout, loading } = useTopUp();
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomChange = (value: string) => {
    // Allow only numbers and one decimal point
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    setCustomAmount(cleaned);
    setSelectedAmount(null);
  };

  const getAmount = (): number => {
    if (selectedAmount) return selectedAmount;
    const parsed = parseFloat(customAmount);
    return isNaN(parsed) ? 0 : parsed;
  };

  const amount = getAmount();
  const isValid = amount >= 10 && amount <= 10000;

  // Check for active promotion
  const { promotion, calculateBenefit } = useActivePromotion("topup", amount);
  const benefitAmount = promotion ? calculateBenefit(amount) : 0;
  const finalAmount = promotion?.type === "discount" 
    ? amount // Discount doesn't change what you receive for topup
    : amount + benefitAmount; // Cashback/bonus adds to the amount

  const handleSubmit = async () => {
    if (!isValid) return;
    await createCheckout(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Saldo</DialogTitle>
          <DialogDescription>
            Escolha o valor que deseja adicionar à sua carteira
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset amounts */}
          <div className="grid grid-cols-2 gap-3">
            {PRESET_AMOUNTS.map((presetAmount) => (
              <Button
                key={presetAmount}
                type="button"
                variant={selectedAmount === presetAmount ? "default" : "outline"}
                className="h-12 text-base"
                onClick={() => handlePresetClick(presetAmount)}
                disabled={loading}
              >
                {formatCurrency(presetAmount)}
              </Button>
            ))}
          </div>

          {/* Custom amount input */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Ou digite um valor personalizado</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="custom-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={customAmount}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo R$ 10,00 • Máximo R$ 10.000,00
            </p>
          </div>

          {/* Active promotion banner */}
          {promotion && amount > 0 && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
              <div className="flex items-center gap-2 text-primary mb-2">
                <Gift className="h-4 w-4" />
                <span className="font-medium text-sm">{promotion.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {promotion.type === "cashback" || promotion.type === "discount" ? (
                  <>
                    {promotion.benefit_type === "percentage" 
                      ? `Bônus de ${promotion.benefit_value}%` 
                      : `Bônus de ${formatCurrency(promotion.benefit_value)}`
                    }
                    {" • "}
                    <span className="text-primary font-medium">
                      +{formatCurrency(benefitAmount)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          )}

          {/* Summary and submit */}
          <div className="space-y-4">
            {amount > 0 && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor da recarga</span>
                  <span className="text-sm tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                </div>
                {benefitAmount > 0 && (
                  <div className="flex items-center justify-between text-primary">
                    <span className="text-sm">Bônus da promoção</span>
                    <span className="text-sm font-medium tabular-nums">
                      +{formatCurrency(benefitAmount)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Você receberá</span>
                  <span className="text-lg font-semibold text-primary tabular-nums">
                    {formatCurrency(finalAmount)}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!isValid || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                `Continuar para pagamento`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
