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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWithdraw, BankInfo } from "@/hooks/useWithdraw";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onSuccess?: () => void;
}

export function WithdrawModal({
  open,
  onOpenChange,
  currentBalance,
  onSuccess,
}: WithdrawModalProps) {
  const { requestWithdrawal, loading } = useWithdraw();
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"pix" | "bank_account">("pix");
  const [pixKey, setPixKey] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState<"corrente" | "poupanca">(
    "corrente"
  );

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    setAmount(cleaned);
  };

  const getAmount = (): number => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parsedAmount = getAmount();
  const isValidAmount = parsedAmount >= 50 && parsedAmount <= currentBalance;
  const isValidBankInfo =
    paymentType === "pix"
      ? pixKey.trim().length > 0
      : bankCode.trim().length > 0 &&
        agency.trim().length > 0 &&
        account.trim().length > 0;

  const isValid = isValidAmount && isValidBankInfo;

  const handleSubmit = async () => {
    if (!isValid) return;

    const bankInfo: BankInfo = {
      type: paymentType,
      ...(paymentType === "pix"
        ? { pix_key: pixKey.trim() }
        : {
            bank_code: bankCode.trim(),
            agency: agency.trim(),
            account: account.trim(),
            account_type: accountType,
          }),
    };

    const success = await requestWithdrawal(parsedAmount, bankInfo);
    if (success) {
      // Reset form
      setAmount("");
      setPixKey("");
      setBankCode("");
      setAgency("");
      setAccount("");
      onOpenChange(false);
      onSuccess?.();
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Saque</DialogTitle>
          <DialogDescription>
            Seu saldo disponível: {formatCurrency(currentBalance)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amount input */}
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Valor do saque</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo R$ 50,00 • Máximo {formatCurrency(currentBalance)}
            </p>
          </div>

          {/* Payment type selector */}
          <div className="space-y-2">
            <Label>Forma de recebimento</Label>
            <Select
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as "pix" | "bank_account")}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="bank_account">Conta Bancária</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PIX fields */}
          {paymentType === "pix" && (
            <div className="space-y-2">
              <Label htmlFor="pix-key">Chave PIX</Label>
              <Input
                id="pix-key"
                type="text"
                placeholder="CPF, email, telefone ou chave aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* Bank account fields */}
          {paymentType === "bank_account" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank-code">Código do banco</Label>
                <Input
                  id="bank-code"
                  type="text"
                  placeholder="Ex: 001, 341, 033..."
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência</Label>
                  <Input
                    id="agency"
                    type="text"
                    placeholder="0000"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">Conta</Label>
                  <Input
                    id="account"
                    type="text"
                    placeholder="00000-0"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <Select
                  value={accountType}
                  onValueChange={(v) =>
                    setAccountType(v as "corrente" | "poupanca")
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Summary and submit */}
          <div className="space-y-4">
            {parsedAmount > 0 && (
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Valor a sacar
                  </span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(parsedAmount)}
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
                "Solicitar Saque"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              A solicitação será analisada e processada pela administração.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
