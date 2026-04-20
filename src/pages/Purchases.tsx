import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePurchases } from "@/hooks/usePurchases";

export default function Purchases() {
  const { data: purchases = [], isLoading: loading } = usePurchases();

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
            Histórico de leads adquiridos
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
              Participe de leilões para adquirir leads
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const status = statusConfig[purchase.status as keyof typeof statusConfig];

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
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Comprado em: {formatDate(purchase.purchased_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold text-primary">
                          {formatCurrency(Number(purchase.amount))}
                        </span>
                      </div>
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
