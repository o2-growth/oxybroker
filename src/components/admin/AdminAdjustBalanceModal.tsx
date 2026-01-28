import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAdjustBalance } from "@/hooks/useAdminAdjustBalance";
import { DollarSign } from "lucide-react";

interface AdminAdjustBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  onSuccess?: () => void;
}

export function AdminAdjustBalanceModal({
  open,
  onOpenChange,
  user,
  onSuccess,
}: AdminAdjustBalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { adjustBalance, loading } = useAdminAdjustBalance();

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 100000;
  const isValidReason = reason.trim().length >= 5;
  const canSubmit = isValidAmount && isValidReason && !loading;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    const result = await adjustBalance(user.id, parsedAmount, reason.trim());

    if (result.success) {
      setAmount("");
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAmount("");
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Adicionar Saldo
          </DialogTitle>
          <DialogDescription>
            Adicione saldo manualmente à carteira do usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User info (readonly) */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm font-medium">{user?.full_name || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="adjust_amount">Valor (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="adjust_amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo R$ 1,00 • Máximo R$ 100.000,00
            </p>
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="adjust_reason">Motivo</Label>
            <Textarea
              id="adjust_reason"
              placeholder="Ex: Bônus por indicação, correção de erro, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={loading}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 caracteres (mínimo 5)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? "Adicionando..." : "Adicionar Saldo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
