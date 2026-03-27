import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Layers,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Play,
  XCircle,
  Eye,
  Package,
  X,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useAdminLots } from "@/hooks/useAdminLots";
import { useAssets } from "@/hooks/useAssets";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type LotItem = Database["public"]["Tables"]["lot_items"]["Row"];
type Asset = Database["public"]["Tables"]["assets"]["Row"];
type LotStatus = Database["public"]["Enums"]["lot_status"];

interface LotWithAssets extends Lot {
  lot_items?: Array<LotItem & { assets: Asset }>;
}

const statusConfig: Record<LotStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  live: { label: "Ao Vivo", className: "oxy-badge-danger" },
  ended: { label: "Encerrado", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", className: "oxy-badge-warning" },
};

const emptyFormData = {
  title: "",
  description: "",
  starting_price: "0",
  min_bid_increment: "100",
  starts_at: "",
  ends_at: "",
};

const PAGE_SIZE = 10;

export default function AdminLots() {
  const { loading: authLoading } = useRoleGuard("admin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LotStatus | "all">("all");

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const {
    lots,
    totalCount,
    totalPages,
    isLoading,
    createLot,
    updateLot,
    addAssetToLot,
    removeAssetFromLot,
    publishLot,
    cancelLot,
    deleteLot,
    isCreating,
    isUpdating,
    isPublishing,
    isCancelling,
    isDeleting,
    closeExpiredLots,
    isClosingExpired,
  } = useAdminLots({ search, status: statusFilter, page, pageSize: PAGE_SIZE });

  const { availableAssets } = useAssets();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [assetsDialogOpen, setAssetsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotToDelete, setLotToDelete] = useState<Lot | null>(null);
  const [lotToPublish, setLotToPublish] = useState<Lot | null>(null);
  const [lotToCancel, setLotToCancel] = useState<Lot | null>(null);
  const [formData, setFormData] = useState(emptyFormData);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatDateTimeLocal = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().slice(0, 16);
  };

  const handleOpenCreate = () => {
    setEditingLot(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (lot: Lot) => {
    setEditingLot(lot);
    setFormData({
      title: lot.title,
      description: lot.description || "",
      starting_price: lot.starting_price.toString(),
      min_bid_increment: lot.min_bid_increment.toString(),
      starts_at: formatDateTimeLocal(lot.starts_at),
      ends_at: formatDateTimeLocal(lot.ends_at),
    });
    setDialogOpen(true);
  };

  const handleOpenAssets = (lot: Lot) => {
    setSelectedLot(lot);
    setAssetsDialogOpen(true);
  };

  const handleOpenDelete = (lot: Lot) => {
    setLotToDelete(lot);
    setDeleteDialogOpen(true);
  };

  const handleOpenPublish = (lot: Lot) => {
    setLotToPublish(lot);
    setPublishDialogOpen(true);
  };

  const handleOpenCancel = (lot: Lot) => {
    setLotToCancel(lot);
    setCancelDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    const data = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      starting_price: parseFloat(formData.starting_price) || 0,
      min_bid_increment: parseFloat(formData.min_bid_increment) || 100,
      starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
      ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
    };

    if (editingLot) {
      await updateLot({ id: editingLot.id, data });
    } else {
      await createLot(data);
    }

    setDialogOpen(false);
    setFormData(emptyFormData);
    setEditingLot(null);
  };

  const handleDelete = async () => {
    if (!lotToDelete) return;
    await deleteLot(lotToDelete.id);
    setDeleteDialogOpen(false);
    setLotToDelete(null);
  };

  const handlePublish = async () => {
    if (!lotToPublish) return;
    await publishLot(lotToPublish.id);
    setPublishDialogOpen(false);
    setLotToPublish(null);
  };

  const handleCancel = async () => {
    if (!lotToCancel) return;
    await cancelLot(lotToCancel.id);
    setCancelDialogOpen(false);
    setLotToCancel(null);
  };

  const handleAddAsset = async (assetId: string) => {
    if (!selectedLot) return;
    await addAssetToLot({ lotId: selectedLot.id, assetId });
  };

  const handleRemoveAsset = async (assetId: string) => {
    if (!selectedLot) return;
    await removeAssetFromLot({ lotId: selectedLot.id, assetId });
  };

  // Get lot assets from the lots query data
  const getLotAssets = (lotId: string): Asset[] => {
    const lot = lots.find((l) => l.id === lotId) as LotWithAssets | undefined;
    return lot?.lot_items?.map((item) => item.assets) || [];
  };

  const getLinkedAssetIds = (): string[] => {
    const selectedLotAssets = getLotAssets(selectedLot?.id || "");
    return selectedLotAssets.map((a) => a.id);
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Lotes
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os lotes de leilão
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => closeExpiredLots()}
              disabled={isClosingExpired}
            >
              {isClosingExpired ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Encerrar Expirados
            </Button>
            <Button className="gap-2" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Novo Lote
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as LotStatus | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(statusConfig).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : lots.length === 0 && totalCount === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum lote</h3>
            <p className="text-muted-foreground">
              Crie lotes para iniciar leilões
            </p>
          </div>
        ) : (
          <>
            <div className="oxy-card overflow-hidden">
              <table className="oxy-table">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Status</th>
                    <th>Ativos</th>
                    <th>Preço Atual</th>
                    <th>Início</th>
                    <th>Término</th>
                    <th className="w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const status = statusConfig[lot.status];
                    const lotAssets = getLotAssets(lot.id);

                    return (
                      <tr key={lot.id}>
                        <td className="font-medium">{lot.title}</td>
                        <td>
                          <Badge className={status.className}>
                            {lot.status === "live" && (
                              <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                            )}
                            {status.label}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1"
                            onClick={() => handleOpenAssets(lot)}
                          >
                            <Package className="h-3.5 w-3.5" />
                            {lotAssets.length}
                          </Button>
                        </td>
                        <td className="font-mono text-primary">
                          {formatCurrency(Number(lot.current_price))}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {formatDate(lot.starts_at)}
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {formatDate(lot.ends_at)}
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem asChild>
                                <Link to={`/lots/${lot.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalhes
                                </Link>
                              </DropdownMenuItem>

                              {lot.status === "draft" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleOpenEdit(lot)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenAssets(lot)}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Gerenciar Ativos
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenPublish(lot)}
                                    className="text-primary"
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Publicar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDelete(lot)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </>
                              )}

                              {lot.status === "live" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenCancel(lot)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancelar Leilão
                                  </DropdownMenuItem>
                                </>
                              )}

                              {lot.status === "cancelled" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleOpenDelete(lot)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <DataTablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLot ? "Editar Lote" : "Novo Lote"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingLot ? "Editar informações do lote" : "Preencha os dados para criar um novo lote"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Nome do lote"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Descrição do lote"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="starting_price">Preço Inicial (R$) *</Label>
                <Input
                  id="starting_price"
                  type="number"
                  step="0.01"
                  value={formData.starting_price}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      starting_price: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_bid_increment">Incremento Mín (R$) *</Label>
                <Input
                  id="min_bid_increment"
                  type="number"
                  step="0.01"
                  value={formData.min_bid_increment}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_bid_increment: e.target.value,
                    }))
                  }
                  placeholder="100.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="starts_at">Início</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, starts_at: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ends_at">Término *</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, ends_at: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || isUpdating || !formData.title.trim()}
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingLot ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assets Dialog */}
      <Dialog open={assetsDialogOpen} onOpenChange={setAssetsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar Ativos - {selectedLot?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Adicione ou remova ativos vinculados a este lote
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Linked Assets */}
            <div>
              <Label className="text-sm font-medium">Ativos Vinculados</Label>
              <div className="mt-2 space-y-2">
                {getLotAssets(selectedLot?.id || "").length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum ativo vinculado
                  </p>
                ) : (
                  getLotAssets(selectedLot?.id || "").map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <span className="text-sm">{asset.title}</span>
                      {selectedLot?.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveAsset(asset.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available Assets */}
            {selectedLot?.status === "draft" && (
              <div>
                <Label className="text-sm font-medium">Ativos Disponíveis</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {availableAssets
                    .filter((a) => !getLinkedAssetIds().includes(a.id))
                    .map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <span className="text-sm">{asset.title}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddAsset(asset.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  {availableAssets.filter(
                    (a) => !getLinkedAssetIds().includes(a.id)
                  ).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum ativo disponível
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetsDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lote "{lotToDelete?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar Lote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja publicar o lote "{lotToPublish?.title}"?
              Ele ficará disponível no marketplace e os ativos serão marcados como
              "em leilão".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
              {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Leilão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o leilão "{lotToCancel?.title}"?
              Os ativos serão liberados e marcados como "disponíveis".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancelar Leilão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
