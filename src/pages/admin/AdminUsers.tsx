import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useUsers, UserProfile, UpdateUserData, CreateUserData } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AdminAdjustBalanceModal } from "@/components/admin/AdminAdjustBalanceModal";
import {
  Search,
  Pencil,
  Users,
  MoreHorizontal,
  UserX,
  UserCheck,
  Trash2,
  Plus,
  Ban,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  master_franquia: "Master Franquia",
  franquia: "Franquia",
  oxy_hacker: "Oxy Hacker",
};

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  master_franquia: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  franquia: "bg-primary/10 text-primary border-primary/20",
  oxy_hacker: "bg-green-500/10 text-green-500 border-green-500/20",
};

const PAGE_SIZE = 10;

export default function AdminUsers() {
  useRoleGuard("admin");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  const { users, loading, totalCount, totalPages, createUser, updateUser, suspendUser, deleteUser } = useUsers({
    page,
    pageSize: PAGE_SIZE,
  });

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UpdateUserData>({});
  const [saving, setSaving] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToSuspend, setUserToSuspend] = useState<{ user: UserProfile; suspend: boolean } | null>(null);
  const [userToAdjustBalance, setUserToAdjustBalance] = useState<UserProfile | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "franquia" as AppRole,
    franchise_category_id: null as string | null,
    can_withdraw: false,
  });
  const [creating, setCreating] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  // Fetch categories for the select
  const { data: categories = [] } = useQuery({
    queryKey: ["franchise-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("franchise_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Client-side filtering since useUsers fetches paginated data
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchTerm ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !u.suspended_at) ||
        (statusFilter === "suspended" && !!u.suspended_at);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleEdit = (userProfile: UserProfile) => {
    setEditingUser(userProfile);
    setFormData({
      full_name: userProfile.full_name || "",
      role: userProfile.role,
      franchise_category_id: userProfile.franchise_category_id,
      can_withdraw: userProfile.can_withdraw,
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;

    if (editingUser.id === user?.id && formData.role !== editingUser.role) {
      return;
    }

    setSaving(true);
    const success = await updateUser(editingUser.id, formData);
    setSaving(false);

    if (success) {
      setEditingUser(null);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete.id);
    setUserToDelete(null);
  };

  const handleSuspend = async () => {
    if (!userToSuspend) return;
    await suspendUser(userToSuspend.user.id, userToSuspend.suspend);
    setUserToSuspend(null);
  };

  const handleCreate = async () => {
    if (!createData.email || !createData.password || !createData.full_name) {
      toast.error("Campos obrigatórios", {
        description: "Preencha email, senha e nome completo.",
      });
      return;
    }

    if (createData.password.length < 6) {
      toast.error("Senha muito curta", {
        description: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }

    setCreating(true);
    const success = await createUser({
      email: createData.email,
      password: createData.password,
      full_name: createData.full_name,
      role: createData.role,
      franchise_category_id: createData.franchise_category_id,
    });
    setCreating(false);

    if (success) {
      setCreateDialogOpen(false);
      setCreateData({
        email: "",
        password: "",
        full_name: "",
        role: "franquia",
        franchise_category_id: null,
        can_withdraw: false,
      });
    }
  };

  const isCurrentUser = editingUser?.id === user?.id;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6" />
              Gestão de Usuários
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie os usuários e suas permissões
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as AppRole | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {Object.entries(roleLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | "active" | "suspended")}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((userProfile) => (
                  <TableRow
                    key={userProfile.id}
                    className={userProfile.suspended_at ? "opacity-60" : ""}
                  >
                    <TableCell className="font-medium">
                      {userProfile.full_name || "—"}
                      {userProfile.id === user?.id && (
                        <span className="text-xs text-muted-foreground ml-2">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userProfile.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColors[userProfile.role]}>
                        {roleLabels[userProfile.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(userProfile.wallet_balance)}
                    </TableCell>
                    <TableCell>
                      {userProfile.suspended_at ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                          <Ban className="h-3 w-3 mr-1" />
                          Suspenso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(userProfile.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(userProfile)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setUserToAdjustBalance(userProfile)}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Adicionar Saldo
                          </DropdownMenuItem>
                          {userProfile.id !== user?.id && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setUserToSuspend({
                                    user: userProfile,
                                    suspend: !userProfile.suspended_at,
                                  })
                                }
                              >
                                {userProfile.suspended_at ? (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Reativar
                                  </>
                                ) : (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Suspender
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setUserToDelete(userProfile)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="border-t px-4">
              <DataTablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                isLoading={loading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create_full_name">Nome completo</Label>
              <Input
                id="create_full_name"
                value={createData.full_name}
                onChange={(e) =>
                  setCreateData({ ...createData, full_name: e.target.value })
                }
                placeholder="Nome do usuário"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_email">Email</Label>
              <Input
                id="create_email"
                type="email"
                value={createData.email}
                onChange={(e) =>
                  setCreateData({ ...createData, email: e.target.value })
                }
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_password">Senha</Label>
              <Input
                id="create_password"
                type="password"
                value={createData.password}
                onChange={(e) =>
                  setCreateData({ ...createData, password: e.target.value })
                }
                placeholder="Senha inicial"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_role">Papel</Label>
              <Select
                value={createData.role}
                onValueChange={(value) =>
                  setCreateData({ ...createData, role: value as AppRole })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_category">Categoria de Franquia</Label>
              <Select
                value={createData.franchise_category_id || "none"}
                onValueChange={(value) =>
                  setCreateData({
                    ...createData,
                    franchise_category_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="create_can_withdraw">Permitir Saque</Label>
                <p className="text-xs text-muted-foreground">
                  Habilita o usuário a solicitar saque do saldo
                </p>
              </div>
              <Switch
                id="create_can_withdraw"
                checked={createData.can_withdraw}
                onCheckedChange={(checked) =>
                  setCreateData({ ...createData, can_withdraw: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={formData.full_name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Papel</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as AppRole })
                }
                disabled={isCurrentUser}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um papel" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCurrentUser && (
                <p className="text-xs text-muted-foreground">
                  Você não pode alterar seu próprio papel.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria de Franquia</Label>
              <Select
                value={formData.franchise_category_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    franchise_category_id: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit_can_withdraw">Permitir Saque</Label>
                <p className="text-xs text-muted-foreground">
                  Habilita o usuário a solicitar saque do saldo
                </p>
              </div>
              <Switch
                id="edit_can_withdraw"
                checked={formData.can_withdraw ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, can_withdraw: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!userToDelete}
        onOpenChange={() => setUserToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário{" "}
              <strong>{userToDelete?.full_name || userToDelete?.email}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend Confirmation */}
      <AlertDialog
        open={!!userToSuspend}
        onOpenChange={() => setUserToSuspend(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userToSuspend?.suspend ? "Suspender" : "Reativar"} Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToSuspend?.suspend
                ? `Tem certeza que deseja suspender o usuário ${
                    userToSuspend?.user.full_name || userToSuspend?.user.email
                  }? Ele não poderá acessar o sistema.`
                : `Tem certeza que deseja reativar o usuário ${
                    userToSuspend?.user.full_name || userToSuspend?.user.email
                  }?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend}>
              {userToSuspend?.suspend ? "Suspender" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjust Balance Modal */}
      <AdminAdjustBalanceModal
        open={!!userToAdjustBalance}
        onOpenChange={(open) => !open && setUserToAdjustBalance(null)}
        user={userToAdjustBalance}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    </AppShell>
  );
}
