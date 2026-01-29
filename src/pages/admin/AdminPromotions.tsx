import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { usePromotions, Promotion } from "@/hooks/usePromotions";
import { usePromotionUsageStats } from "@/hooks/usePromotionUsageStats";
import { PromotionFormModal } from "@/components/admin/PromotionFormModal";
import {
  Gift,
  Plus,
  Search,
  Pause,
  Play,
  Trash2,
  Edit,
  Calendar,
  Users,
  Percent,
  DollarSign,
  Wallet,
  Gavel,
  ShoppingBag,
  Clock,
  Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  discount: "Desconto",
  cashback: "Cashback",
};

const appliesToLabels: Record<string, string> = {
  topup: "Recargas",
  bid: "Lances",
  purchase: "Compras",
};

const appliesToIcons: Record<string, typeof Wallet> = {
  topup: Wallet,
  bid: Gavel,
  purchase: ShoppingBag,
};

const eligibilityLabels: Record<string, string> = {
  global: "Global",
  category: "Por Categoria",
  individual: "Individual",
};

export default function AdminPromotions() {
  useRoleGuard(["admin"]);
  
  const { promotions, loading, togglePromotionActive, deletePromotion } = usePromotions();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [appliesToFilter, setAppliesToFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  const promotionIds = promotions.map((p) => p.id);
  const { data: usageStats } = usePromotionUsageStats(promotionIds);

  const filteredPromotions = promotions.filter((promo) => {
    const matchesSearch = promo.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || promo.type === typeFilter;
    const matchesAppliesTo = appliesToFilter === "all" || promo.applies_to === appliesToFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && promo.is_active) ||
      (statusFilter === "inactive" && !promo.is_active);

    return matchesSearch && matchesType && matchesAppliesTo && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromotion(promo);
    setModalOpen(true);
  };

  const handleDelete = (promo: Promotion) => {
    setPromotionToDelete(promo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (promotionToDelete) {
      deletePromotion.mutate(promotionToDelete.id);
      setDeleteDialogOpen(false);
      setPromotionToDelete(null);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingPromotion(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6" />
              Promoções
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie descontos e cashback para recargas, lances e compras
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Promoção
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar promoções..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="discount">Desconto</SelectItem>
              <SelectItem value="cashback">Cashback</SelectItem>
            </SelectContent>
          </Select>
          <Select value={appliesToFilter} onValueChange={setAppliesToFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Aplicação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="topup">Recargas</SelectItem>
              <SelectItem value="bid">Lances</SelectItem>
              <SelectItem value="purchase">Compras</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPromotions.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="Nenhuma promoção encontrada"
            description={
              searchQuery || typeFilter !== "all" || appliesToFilter !== "all" || statusFilter !== "all"
                ? "Tente ajustar os filtros de busca."
                : "Crie sua primeira promoção para oferecer benefícios aos usuários."
            }
            action={
              !searchQuery && typeFilter === "all" && appliesToFilter === "all" && statusFilter === "all"
                ? { label: "Criar Promoção", onClick: () => setModalOpen(true) }
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredPromotions.map((promo) => {
              const AppliesToIcon = appliesToIcons[promo.applies_to];
              const stats = usageStats?.[promo.id];

              return (
                <Card
                  key={promo.id}
                  className={cn(
                    "transition-opacity",
                    !promo.is_active && "opacity-60"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg">{promo.name}</CardTitle>
                          <Badge
                            variant={promo.is_active ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            {promo.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Badge variant="outline" className="shrink-0">
                            {typeLabels[promo.type]}
                          </Badge>
                        </div>
                        {promo.description && (
                          <CardDescription className="mt-1">
                            {promo.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            togglePromotionActive.mutate({
                              id: promo.id,
                              is_active: !promo.is_active,
                            })
                          }
                          disabled={togglePromotionActive.isPending}
                        >
                          {promo.is_active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(promo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(promo)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-4 text-sm">
                      {/* Benefit */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {promo.benefit_type === "percentage" ? (
                          <Percent className="h-4 w-4" />
                        ) : (
                          <DollarSign className="h-4 w-4" />
                        )}
                        <span>
                          {promo.benefit_type === "percentage"
                            ? `${promo.benefit_value}%`
                            : formatCurrency(promo.benefit_value)}
                        </span>
                        {promo.max_benefit && (
                          <span className="text-xs">
                            (máx. {formatCurrency(promo.max_benefit)})
                          </span>
                        )}
                      </div>

                      {/* Applies to */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <AppliesToIcon className="h-4 w-4" />
                        <span>{appliesToLabels[promo.applies_to]}</span>
                      </div>

                      {/* Eligibility */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{eligibilityLabels[promo.eligibility]}</span>
                      </div>

                      {/* Min amount */}
                      {promo.min_amount && promo.min_amount > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>Mín. {formatCurrency(promo.min_amount)}</span>
                        </div>
                      )}

                      {/* Usage stats */}
                      {stats && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>
                            {stats.usageCount} uso{stats.usageCount !== 1 ? "s" : ""} •{" "}
                            {formatCurrency(stats.totalBenefit)} concedidos
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Schedule info */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      Criada em {format(new Date(promo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Form Modal */}
        <PromotionFormModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          promotion={editingPromotion}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir promoção?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a promoção "{promotionToDelete?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
