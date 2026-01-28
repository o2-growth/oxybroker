import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Plus,
  Search,
  Building,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { useAssets } from "@/hooks/useAssets";
import type { Database } from "@/integrations/supabase/types";

type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetStatus = Database["public"]["Enums"]["asset_status"];
type AssetType = Database["public"]["Enums"]["asset_type"];

const statusConfig: Record<AssetStatus, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  available: { label: "Disponível", className: "oxy-badge-success" },
  in_auction: { label: "Em Leilão", className: "oxy-badge-warning" },
  sold: { label: "Vendido", className: "oxy-badge-info" },
  returned: { label: "Devolvido", className: "bg-muted text-muted-foreground" },
  disabled: { label: "Desativado", className: "oxy-badge-danger" },
};

const assetTypeLabels: Record<AssetType, string> = {
  lead: "Lead",
  mlq: "MLQ",
  meeting: "Reunião",
};

const emptyFormData = {
  title: "",
  asset_type: "lead" as AssetType,
  status: "draft" as AssetStatus,
  sector: "",
  revenue_range: "",
  location_city: "",
  location_state: "",
  employees_count: "",
  base_score: "0",
};

export default function AdminAssets() {
  const { loading: authLoading } = useRoleGuard("admin");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");

  const {
    assets,
    isLoading,
    createAsset,
    updateAsset,
    updateAssetStatus,
    deleteAsset,
    isCreating,
    isUpdating,
    isDeleting,
  } = useAssets({ search, status: statusFilter, type: typeFilter });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [formData, setFormData] = useState(emptyFormData);

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setFormData({
      title: asset.title,
      asset_type: asset.asset_type,
      status: asset.status,
      sector: asset.sector || "",
      revenue_range: asset.revenue_range || "",
      location_city: asset.location_city || "",
      location_state: asset.location_state || "",
      employees_count: asset.employees_count?.toString() || "",
      base_score: asset.base_score?.toString() || "0",
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (asset: Asset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    const data = {
      title: formData.title.trim(),
      asset_type: formData.asset_type,
      status: formData.status,
      sector: formData.sector.trim() || null,
      revenue_range: formData.revenue_range.trim() || null,
      location_city: formData.location_city.trim() || null,
      location_state: formData.location_state.trim() || null,
      employees_count: formData.employees_count ? parseInt(formData.employees_count) : null,
      base_score: parseInt(formData.base_score) || 0,
    };

    if (editingAsset) {
      await updateAsset({ id: editingAsset.id, data });
    } else {
      await createAsset(data);
    }

    setDialogOpen(false);
    setFormData(emptyFormData);
    setEditingAsset(null);
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    await deleteAsset(assetToDelete.id);
    setDeleteDialogOpen(false);
    setAssetToDelete(null);
  };

  const handleStatusChange = async (asset: Asset, newStatus: AssetStatus) => {
    await updateAssetStatus({ id: asset.id, status: newStatus });
  };

  const isEditable = (asset: Asset) =>
    asset.status !== "in_auction" && asset.status !== "sold";

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
              <Package className="h-6 w-6 text-primary" />
              Ativos
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os ativos disponíveis para leilão
            </p>
          </div>
          <Button className="gap-2" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            Novo Ativo
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ativos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as AssetStatus | "all")}
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
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as AssetType | "all")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              {Object.entries(assetTypeLabels).map(([key, label]) => (
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
        ) : assets.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum ativo</h3>
            <p className="text-muted-foreground">
              Adicione ativos para criar lotes de leilão
            </p>
          </div>
        ) : (
          <div className="oxy-card overflow-hidden">
            <table className="oxy-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Setor</th>
                  <th>Localização</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th className="w-12">Ações</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const status = statusConfig[asset.status];

                  return (
                    <tr key={asset.id}>
                      <td className="font-medium">{asset.title}</td>
                      <td>
                        <Badge variant="outline" className="capitalize">
                          {assetTypeLabels[asset.asset_type]}
                        </Badge>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-sm">
                          <Building className="h-3.5 w-3.5" />
                          {asset.sector || "-"}
                        </span>
                      </td>
                      <td>
                        <span className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          {asset.location_city
                            ? `${asset.location_city}, ${asset.location_state}`
                            : "-"}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono">{asset.base_score}</span>
                      </td>
                      <td>
                        <Badge className={status.className}>{status.label}</Badge>
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            {isEditable(asset) && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(asset)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {Object.entries(statusConfig)
                              .filter(([key]) => key !== asset.status)
                              .map(([key, { label }]) => (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() =>
                                    handleStatusChange(asset, key as AssetStatus)
                                  }
                                >
                                  Marcar como {label}
                                </DropdownMenuItem>
                              ))}
                            {asset.status === "draft" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(asset)}
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
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? "Editar Ativo" : "Novo Ativo"}
            </DialogTitle>
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
                placeholder="Nome do ativo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="asset_type">Tipo *</Label>
                <Select
                  value={formData.asset_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      asset_type: value as AssetType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: value as AssetStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sector">Setor</Label>
              <Input
                id="sector"
                value={formData.sector}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, sector: e.target.value }))
                }
                placeholder="Ex: Tecnologia"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="revenue_range">Faixa de Receita</Label>
              <Input
                id="revenue_range"
                value={formData.revenue_range}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, revenue_range: e.target.value }))
                }
                placeholder="Ex: R$ 1M - R$ 5M"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="location_city">Cidade</Label>
                <Input
                  id="location_city"
                  value={formData.location_city}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_city: e.target.value,
                    }))
                  }
                  placeholder="Ex: São Paulo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location_state">Estado</Label>
                <Input
                  id="location_state"
                  value={formData.location_state}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      location_state: e.target.value,
                    }))
                  }
                  placeholder="Ex: SP"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="employees_count">Nº Funcionários</Label>
                <Input
                  id="employees_count"
                  type="number"
                  value={formData.employees_count}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      employees_count: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="base_score">Score Base</Label>
                <Input
                  id="base_score"
                  type="number"
                  value={formData.base_score}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, base_score: e.target.value }))
                  }
                  placeholder="0"
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
              {editingAsset ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ativo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o ativo "{assetToDelete?.title}"?
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
    </AppShell>
  );
}
