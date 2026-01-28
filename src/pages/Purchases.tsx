import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package, RotateCcw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Purchase = Database["public"]["Tables"]["purchases"]["Row"];

interface PurchaseWithLot extends Purchase {
  lot: {
    title: string;
  } | null;
}

export default function Purchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<PurchaseWithLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPurchases = async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, lot:lots(title)")
        .eq("buyer_user_id", user.id)
        .order("purchased_at", { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setPurchases(data || []);
      }
      setLoading(false);
    };

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

  const canReturn = (purchase: PurchaseWithLot) => {
    if (!purchase.return_deadline_at) return false;
    return (
      new Date(purchase.return_deadline_at) > new Date() &&
      purchase.status === "paid"
    );
  };

  const handleRequestReturn = async (purchaseId: string) => {
    try {
      const { error } = await supabase.from("returns").insert({
        purchase_id: purchaseId,
        requested_by: user!.id,
        reason: "Solicitação de devolução pelo usuário",
      });

      if (error) throw error;

      toast({
        title: "Devolução solicitada",
        description: "Sua solicitação será analisada em breve.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const statusConfig = {
    paid: { label: "Pago", className: "oxy-badge-success" },
    refunded: { label: "Reembolsado", className: "oxy-badge-info" },
    disputed: { label: "Em Disputa", className: "oxy-badge-warning" },
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
            <h3 className="font-semibold text-lg mb-2">
              Nenhuma compra ainda
            </h3>
            <p className="text-muted-foreground">
              Participe de leilões para adquirir ativos
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const status =
                statusConfig[purchase.status as keyof typeof statusConfig];
              const returnEligible = canReturn(purchase);

              return (
                <div key={purchase.id} className="oxy-card p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">
                          {purchase.lot?.title || "Lote removido"}
                        </h3>
                        <Badge className={status.className}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          Comprado em: {formatDate(purchase.purchased_at)}
                        </span>
                        {purchase.return_deadline_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Devolução até:{" "}
                            {formatDate(purchase.return_deadline_at)}
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
                          onClick={() => handleRequestReturn(purchase.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Devolver
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
