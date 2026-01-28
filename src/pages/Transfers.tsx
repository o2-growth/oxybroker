import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeftRight,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useTransfers } from "@/hooks/useTransfers";
import { useTransferBalance } from "@/hooks/useTransferBalance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Transfers() {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const { transfers, loading, refetch } = useTransfers();
  const { transferBalance, loading: transferring } = useTransferBalance();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");

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

  const handleTransfer = async () => {
    const numAmount = parseFloat(amount.replace(",", "."));
    if (!recipientEmail || isNaN(numAmount) || numAmount <= 0) return;

    const result = await transferBalance(recipientEmail, numAmount);
    if (result.success) {
      setDialogOpen(false);
      setRecipientEmail("");
      setAmount("");
      refetch();
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              Transferências
            </h1>
            <p className="text-muted-foreground mt-1">
              Transfira saldo para outros usuários
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Send className="h-4 w-4" />
                Nova Transferência
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir Saldo</DialogTitle>
                <DialogDescription>
                  Seu saldo disponível: {formatCurrency(Number(wallet?.balance || 0))}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail do destinatário</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="text"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleTransfer} disabled={transferring}>
                  {transferring ? "Transferindo..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Saldo card */}
        <div className="oxy-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(Number(wallet?.balance || 0))}
            </p>
          </div>
        </div>

        {/* Histórico */}
        <div className="oxy-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Histórico de Transferências</h2>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transferência ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transfers.map((tx) => {
                const isSender = tx.from_user_id === user?.id;
                const Icon = isSender ? ArrowUpRight : ArrowDownLeft;
                const colorClass = isSender ? "text-oxy-danger" : "text-oxy-success";
                const bgClass = isSender ? "bg-oxy-danger/10" : "bg-oxy-success/10";

                const otherUser = isSender ? tx.to_profile : tx.from_profile;

                return (
                  <div
                    key={tx.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${bgClass}`}
                      >
                        <Icon className={`h-5 w-5 ${colorClass}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isSender ? "Enviado para" : "Recebido de"}{" "}
                          {otherUser?.full_name || otherUser?.email || "Usuário"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono font-semibold ${colorClass}`}>
                      {isSender ? "-" : "+"}
                      {formatCurrency(Number(tx.amount || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
