import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Receipt,
  Banknote,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TopUpModal } from "@/components/wallet/TopUpModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { toast } from "@/hooks/use-toast";
import { useAnalytics } from "@/hooks/useAnalytics";

const transactionTypeConfig = {
  topup: {
    label: "Recarga",
    icon: ArrowDownLeft,
    className: "text-oxy-success",
  },
  debit_purchase: {
    label: "Compra",
    icon: ArrowUpRight,
    className: "text-oxy-danger",
  },
  credit_refund: {
    label: "Reembolso",
    icon: ArrowDownLeft,
    className: "text-oxy-success",
  },
  transfer_in: {
    label: "Transferência Recebida",
    icon: ArrowDownLeft,
    className: "text-oxy-success",
  },
  transfer_out: {
    label: "Transferência Enviada",
    icon: ArrowUpRight,
    className: "text-oxy-danger",
  },
  admin_adjust: {
    label: "Ajuste Admin",
    icon: RefreshCw,
    className: "text-oxy-info",
  },
  withdrawal: {
    label: "Saque",
    icon: Banknote,
    className: "text-oxy-danger",
  },
};

export default function WalletPage() {
  const { user, loading: authLoading } = useAuth();
  const { wallet, transactions, canWithdraw, loading, error, refetch } = useWallet();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { trackAction, trackDomainEvent } = useAnalytics();

  const handleTopUpOpen = (open: boolean) => {
    setTopUpOpen(open);
    if (open) trackAction("topup_start");
  };

  const handleWithdrawOpen = (open: boolean) => {
    setWithdrawOpen(open);
    if (open) trackAction("withdraw_start");
  };

  // Handle authentication redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth/login");
    }
  }, [user?.id, authLoading, navigate]);

  // Handle Stripe return query params
  useEffect(() => {
    const topupStatus = searchParams.get("topup");
    if (topupStatus === "success") {
      toast({
        title: "Pagamento processado!",
        description: "Seu saldo será atualizado em instantes.",
      });
      trackDomainEvent("topup_confirmed", "success");
      setSearchParams({});
      // Refetch wallet data after a short delay
      setTimeout(() => refetch(), 2000);
    } else if (topupStatus === "cancelled") {
      toast({
        variant: "destructive",
        title: "Recarga cancelada",
        description: "A operação foi cancelada.",
      });
      trackDomainEvent("topup_cancelled", "cancelled");
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetch, trackDomainEvent]);

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

  if (authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WalletIcon className="h-6 w-6 text-primary" />
              Carteira
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie seu saldo e veja seu extrato
            </p>
          </div>
          <Button className="gap-2" onClick={() => handleTopUpOpen(true)}>
            <Plus className="h-4 w-4" />
            Adicionar Saldo
          </Button>
        </div>

        {/* Balance Card */}
        {loading ? (
          <Skeleton className="h-40" />
        ) : error ? (
          <div className="oxy-card p-6 text-center">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <div className="oxy-card-glow p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Saldo Disponível
                </p>
                <p className="text-4xl md:text-5xl font-bold text-primary">
                  {formatCurrency(Number(wallet?.balance || 0))}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Atualizado em{" "}
                  {wallet?.updated_at
                    ? formatDate(wallet.updated_at)
                    : "-"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate("/transfers")}>
                  Transferir
                </Button>
                {canWithdraw && (
                  <Button variant="outline" onClick={() => handleWithdrawOpen(true)}>
                    <Banknote className="h-4 w-4 mr-2" />
                    Sacar
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="oxy-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Extrato
            </h2>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <WalletIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => {
                const config =
                  transactionTypeConfig[
                    tx.type as keyof typeof transactionTypeConfig
                  ];
                const Icon = config?.icon || Receipt;
                const isCredit = ["topup", "credit_refund", "transfer_in"].includes(
                  tx.type
                );

                return (
                  <div
                    key={tx.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isCredit ? "bg-oxy-success/10" : "bg-oxy-danger/10"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            isCredit ? "text-oxy-success" : "text-oxy-danger"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{config?.label || tx.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </p>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground">
                            {tx.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-semibold ${
                        isCredit ? "text-oxy-success" : "text-oxy-danger"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TopUp Modal */}
        <TopUpModal open={topUpOpen} onOpenChange={handleTopUpOpen} />

        {/* Withdraw Modal */}
        <WithdrawModal
          open={withdrawOpen}
          onOpenChange={handleWithdrawOpen}
          currentBalance={Number(wallet?.balance || 0)}
          onSuccess={refetch}
        />
      </div>
    </AppShell>
  );
}
