import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Inbox,
  Check,
  X,
  Eye,
  Clock,
  Building2,
  Phone,
  Mail,
  User as UserIcon,
  AlertCircle,
} from "lucide-react";
import {
  useLeadsInbox,
  useApproveLead,
  useRejectLead,
  type LeadInboxRow,
  type LeadInboxStatus,
} from "@/hooks/useLeadsInbox";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAppSettings } from "@/hooks/useAppSettings";

const BRACKET_LABELS: Record<string, string> = {
  "200k_350k": "R$ 200k – R$ 350k",
  "350k_500k": "R$ 350k – R$ 500k",
  "500k_1m": "R$ 500k – R$ 1M",
  "1m_5m": "R$ 1M – R$ 5M",
  "5m_plus": "R$ 5M+",
};

const STATUS_CONFIG: Record<LeadInboxStatus, { label: string; variant: string }> = {
  pending_review: { label: "Pendente", variant: "bg-yellow-500/10 text-yellow-600" },
  approved: { label: "Aprovado", variant: "bg-blue-500/10 text-blue-600" },
  rejected: { label: "Rejeitado", variant: "bg-red-500/10 text-red-600" },
  in_auction: { label: "Em leilão", variant: "bg-green-500/10 text-green-600" },
  sold_pre_auction: { label: "Vendido (Buy Now)", variant: "bg-purple-500/10 text-purple-600" },
  sold_auction: { label: "Vendido (leilão)", variant: "bg-green-500/10 text-green-700" },
  expired: { label: "Expirado → Pipefy", variant: "bg-gray-500/10 text-gray-600" },
};

function priceFor(bracket: string, mqlBase: number, multipliers: Record<string, number>): number {
  const mult = multipliers?.[bracket] ?? 1;
  return Math.round(mqlBase * mult * 100) / 100;
}

export default function AdminLeadsInbox() {
  useRoleGuard("admin");
  const { data: settings } = useAppSettings();
  const [activeTab, setActiveTab] = useState<LeadInboxStatus | "all">("pending_review");
  const { data: leads = [], isLoading } = useLeadsInbox({ status: activeTab });

  const approve = useApproveLead();
  const reject = useRejectLead();

  const [selected, setSelected] = useState<LeadInboxRow | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [customDuration, setCustomDuration] = useState<string>("");

  const mqlBase = Number(settings?.mql_base_value ?? 718);
  const multipliers = (settings?.bracket_multipliers ?? {}) as Record<string, number>;

  const handleApprove = async () => {
    if (!selected) return;
    await approve.mutateAsync({
      leadId: selected.id,
      customDurationMinutes: customDuration ? Number(customDuration) : undefined,
    });
    setApproveDialogOpen(false);
    setSelected(null);
    setCustomDuration("");
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    await reject.mutateAsync({ leadId: selected.id, reason: rejectReason.trim() });
    setRejectDialogOpen(false);
    setRejectReason("");
    setSelected(null);
  };

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Inbox className="h-6 w-6 text-primary" />
              Inbox de Leads
            </h1>
            <p className="text-muted-foreground mt-1">
              Triagem de leads recebidos via webhook antes de leilão
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadInboxStatus | "all")}>
          <TabsList>
            <TabsTrigger value="pending_review">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="in_auction">Em leilão</TabsTrigger>
            <TabsTrigger value="sold_auction">Vendidos</TabsTrigger>
            <TabsTrigger value="expired">Expirados</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : leads.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum lead nesse status</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const price = lead.price_cached ?? priceFor(lead.faturamento_bracket, mqlBase, multipliers);
              const status = STATUS_CONFIG[lead.status];

              return (
                <div key={lead.id} className="oxy-card p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {lead.razao_social}
                        </h3>
                        <Badge className={status.variant}>{status.label}</Badge>
                        <Badge variant="outline">{lead.setor}</Badge>
                        <Badge variant="outline">
                          {BRACKET_LABELS[lead.faturamento_bracket] ?? lead.faturamento_bracket}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {lead.contato_nome}
                          {lead.contato_cargo ? ` (${lead.contato_cargo})` : ""}
                        </span>
                        {lead.contato_telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.contato_telefone}
                          </span>
                        )}
                        {lead.contato_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.contato_email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(lead.received_at)}
                        </span>
                        <span>via {lead.origem}</span>
                      </div>
                      {lead.observacoes && (
                        <p className="text-sm text-muted-foreground italic">
                          "{lead.observacoes}"
                        </p>
                      )}
                      {lead.rejection_reason && (
                        <p className="text-sm text-destructive">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          Rejeitado: {lead.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 min-w-[180px]">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Preço calculado</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(price)}</p>
                      </div>

                      {lead.status === "pending_review" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelected(lead);
                              setRejectDialogOpen(true);
                            }}
                          >
                            <X className="h-3 w-3 mr-1" /> Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelected(lead);
                              setApproveDialogOpen(true);
                            }}
                          >
                            <Check className="h-3 w-3 mr-1" /> Aprovar → leilão
                          </Button>
                        </div>
                      )}

                      {lead.lot_id && (
                        <a
                          href={`/lots/${lead.lot_id}`}
                          className="text-xs text-primary underline flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> Ver leilão
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar lead e iniciar leilão</DialogTitle>
              <DialogDescription>
                O lead "{selected?.razao_social}" entrará em leilão imediatamente.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Preço inicial</p>
                <p className="text-lg font-bold text-primary">
                  {selected
                    ? formatCurrency(priceFor(selected.faturamento_bracket, mqlBase, multipliers))
                    : ""}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">
                  Duração do leilão (min, opcional — padrão {settings?.sla_minutes ?? 10} min)
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={1440}
                  placeholder={String(settings?.sla_minutes ?? 10)}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApprove} disabled={approve.isPending}>
                {approve.isPending ? "Aprovando..." : "Confirmar e abrir leilão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar lead</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição (fica registrado para auditoria).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Dados insuficientes, lead duplicado, fora do ICP..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || reject.isPending}
              >
                {reject.isPending ? "Rejeitando..." : "Confirmar rejeição"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
