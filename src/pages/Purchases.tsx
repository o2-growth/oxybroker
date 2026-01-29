import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package, RotateCcw, Clock, AlertCircle } from "lucide-react";
import { useRequestReturn } from "@/hooks/useRequestReturn";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];
type Return = Database["public"]["Tables"]["returns"]["Row"];

interface PurchaseWithDetails extends Purchase {
  lot: { title: string } | null;
  return_request?: Return | null;
}

export default function Purchases() {
  const { user } = useAuth();
  const { requestReturn, loading: returning } = useRequestReturn();
  const { trackAction, trackDomainEvent } = useAnalytics();
  const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithDetails | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const fetchPurchases = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("purchases")
      .select("*, lot:lots(title)")
      .eq("buyer_user_id", user.id)
      .order("purchased_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    // Fetch any return requests for these purchases
    const purchaseIds = data?.map((p) => p.id) || [];
    const { data: returns } = await supabase
      .from("returns")
      .select("*")
      .in("purchase_id", purchaseIds);

    const returnMap = new Map(returns?.map((r) => [r.purchase_id, r]) || []);

    const enrichedPurchases: PurchaseWithDetails[] = (data || []).map((p) => ({
      ...p,
      return_request: returnMap.get(p.id) || null,
    }));

    setPurchases(enrichedPurchases);
    setLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, [user]);

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

  const canReturn = (purchase: PurchaseWithDetails) => {
    if (!purchase.return_deadline_at) return false;
    if (purchase.return_request) return false; // Already requested
    return (
      new Date(purchase.return_deadline_at) > new Date() &&
      purchase.status === "paid"
    );
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const handleRequestReturn = async () => {
    if (!selectedPurchase) return;

    trackAction("return_request_submit", undefined, "purchase", selectedPurchase.id);
    const result = await requestReturn(selectedPurchase.id, returnReason || undefined);
    if (result.success) {
      trackDomainEvent("return_requested", "success", undefined, "purchase", selectedPurchase.id);
      setReturnDialogOpen(false);
      setSelectedPurchase(null);
      setReturnReason("");
      fetchPurchases();
    } else {
      trackDomainEvent("return_requested", "error", undefined, "purchase", selectedPurchase.id);
    }
  };

  const openReturnDialog = (purchase: PurchaseWithDetails) => {
    setSelectedPurchase(purchase);
    setReturnDialogOpen(true);
  };

  const statusConfig = {
    paid: { label: "Pago", className: "oxy-badge-success" },
    refunded: { label: "Reembolsado", className: "oxy-badge-info" },
    disputed: { label: "Em Disputa", className: "oxy-badge-warning" },
  };

  const returnStatusConfig = {
    requested: { label: "Devolução Solicitada", className: "bg-yellow-500/10 text-yellow-500" },
    approved: { label: "Devolução Aprovada", className: "bg-blue-500/10 text-blue-500" },
    rejected: { label: "Devolução Rejeitada", className: "bg-red-500/10 text-red-500" },
    processed: { label: "Reembolso Processado", className: "bg-green-500/10 text-green-500" },
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Minhas Compras
          </h1>
          <p className="text-muted-foreground mt-1">
            Histórico de lotes adquiridos
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma compra ainda</h3>
            <p className="text-muted-foreground">
              Participe de leilões para adquirir ativos
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const status = statusConfig[purchase.status as keyof typeof statusConfig];
              const returnEligible = canReturn(purchase);
              const timeRemaining = purchase.return_deadline_at
                ? getTimeRemaining(purchase.return_deadline_at)
                : null;

              return (
                <div key={purchase.id} className="oxy-card p-4 md:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold">
                            {purchase.lot?.title || "Lote removido"}
                          </h3>
                          <Badge className={status.className}>{status.label}</Badge>
                          {purchase.return_request && (
                            <Badge
                              className={
                                returnStatusConfig[
                                  purchase.return_request.status as keyof typeof returnStatusConfig
                                ]?.className
                              }
                            >
                              {
                                returnStatusConfig[
                                  purchase.return_request.status as keyof typeof returnStatusConfig
                                ]?.label
                              }
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Comprado em: {formatDate(purchase.purchased_at)}</span>
                          {purchase.return_deadline_at && purchase.status === "paid" && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {timeRemaining ? (
                                <>Restam {timeRemaining} para devolução</>
                              ) : (
                                <>Prazo de devolução expirado</>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold text-primary">
                          {formatCurrency(Number(purchase.amount))}
                        </span>
                        {returnEligible && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReturnDialog(purchase)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Devolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Return Dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Solicitar Devolução
              </DialogTitle>
              <DialogDescription>
                Você está solicitando a devolução do lote{" "}
                <strong>{selectedPurchase?.lot?.title}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Valor a ser reembolsado</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(Number(selectedPurchase?.amount || 0))}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva o motivo da devolução..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRequestReturn} disabled={returning}>
                {returning ? "Solicitando..." : "Confirmar Devolução"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
