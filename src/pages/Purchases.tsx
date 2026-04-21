import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShoppingBag, Package, Eye, Building2, User, Phone, Mail, Briefcase } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePurchases, type PurchaseWithDetails } from "@/hooks/usePurchases";
import { CopyLeadDataButton } from "@/components/marketplace/CopyLeadDataButton";

const BRACKET_LABELS: Record<string, string> = {
  "200k_350k": "R$ 200k – R$ 350k",
  "350k_500k": "R$ 350k – R$ 500k",
  "500k_1m": "R$ 500k – R$ 1M",
  "1m_5m": "R$ 1M – R$ 5M",
  "5m_plus": "R$ 5M+",
};

export default function Purchases() {
  const { data: purchases = [], isLoading: loading } = usePurchases();
  const [selected, setSelected] = useState<PurchaseWithDetails | null>(null);

  const statusConfig = {
    paid: { label: "Pago", className: "oxy-badge-success" },
    refunded: { label: "Reembolsado", className: "oxy-badge-info" },
    disputed: { label: "Em Disputa", className: "oxy-badge-warning" },
  };

  const lead = selected?.lot?.lead ?? null;

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
                <button
                  key={purchase.id}
                  type="button"
                  onClick={() => setSelected(purchase)}
                  className="oxy-card p-4 md:p-6 w-full text-left hover:border-primary/50 transition-colors"
                >
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
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(Number(purchase.amount))}
                      </span>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="h-4 w-4" />
                        Ver lead
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.lot?.title ?? "Detalhes da compra"}</DialogTitle>
            <DialogDescription>
              Comprado em {selected ? formatDate(selected.purchased_at) : ""} • {selected ? formatCurrency(Number(selected.amount)) : ""}
            </DialogDescription>
          </DialogHeader>

          {lead ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Razão Social</div>
                    <div className="font-medium">{lead.razao_social}</div>
                    {lead.cnpj && (
                      <div className="text-xs text-muted-foreground">CNPJ: {lead.cnpj}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Setor / Faturamento</div>
                    <div className="font-medium">{lead.setor}</div>
                    <div className="text-xs text-muted-foreground">
                      {BRACKET_LABELS[lead.faturamento_bracket] ?? lead.faturamento_bracket}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Contato</div>
                    <div className="font-medium">{lead.contato_nome}</div>
                    {lead.contato_cargo && (
                      <div className="text-xs text-muted-foreground">{lead.contato_cargo}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Canais</div>
                    {lead.contato_telefone && (
                      <div className="font-medium">{lead.contato_telefone}</div>
                    )}
                    {lead.contato_email && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {lead.contato_email}
                      </div>
                    )}
                  </div>
                </div>

                {lead.observacoes && (
                  <div className="md:col-span-2 text-muted-foreground text-xs border-t pt-3">
                    <span className="font-medium text-foreground">Observações: </span>
                    {lead.observacoes}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 flex justify-end">
                <CopyLeadDataButton
                  lead={{
                    razao_social: lead.razao_social,
                    cnpj: lead.cnpj,
                    setor: lead.setor,
                    faturamento_bracket: lead.faturamento_bracket,
                    contato_nome: lead.contato_nome,
                    contato_telefone: lead.contato_telefone,
                    contato_email: lead.contato_email,
                    contato_cargo: lead.contato_cargo,
                    origem: lead.origem ?? undefined,
                    observacoes: lead.observacoes,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Dados do lead indisponíveis.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
