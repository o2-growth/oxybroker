import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Check, X, Loader2 } from "lucide-react";
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
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  useAdminReturns,
  type ReturnWithDetails,
} from "@/hooks/useAdminReturns";
import type { Database } from "@/integrations/supabase/types";

type ReturnStatus = Database["public"]["Enums"]["return_status"];

const statusConfig: Record<ReturnStatus, { label: string; className: string }> =
  {
    requested: { label: "Solicitada", className: "oxy-badge-warning" },
    approved: { label: "Aprovada", className: "oxy-badge-success" },
    rejected: { label: "Rejeitada", className: "oxy-badge-danger" },
    processed: { label: "Processada", className: "bg-muted text-muted-foreground" },
  };

const PAGE_SIZE = 10;

export default function AdminReturns() {
  const { loading: authLoading } = useRoleGuard("admin");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">(
    "all"
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { returns, totalCount, totalPages, isLoading, processReturn, isProcessing } =
    useAdminReturns({ status: statusFilter, page, pageSize: PAGE_SIZE });

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] =
    useState<ReturnWithDetails | null>(null);

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

  const truncateId = (id: string) => {
    return id.slice(0, 8) + "...";
  };

  const handleOpenApprove = (ret: ReturnWithDetails) => {
    setSelectedReturn(ret);
    setApproveDialogOpen(true);
  };

  const handleOpenReject = (ret: ReturnWithDetails) => {
    setSelectedReturn(ret);
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedReturn) return;
    await processReturn({
      return_id: selectedReturn.id,
      action: "approve",
    });
    setApproveDialogOpen(false);
    setSelectedReturn(null);
  };

  const handleReject = async () => {
    if (!selectedReturn) return;
    await processReturn({
      return_id: selectedReturn.id,
      action: "reject",
    });
    setRejectDialogOpen(false);
    setSelectedReturn(null);
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
              <RotateCcw className="h-6 w-6 text-primary" />
              Devoluções
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as solicitações de devolução
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ReturnStatus | "all")
            }
          >
            <SelectTrigger className="w-[180px]">
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
        ) : returns.length === 0 && totalCount === 0 ? (
          <div className="oxy-card p-8 text-center">
            <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              Nenhuma devolução
            </h3>
            <p className="text-muted-foreground">
              Nenhuma solicitação de devolução encontrada
            </p>
          </div>
        ) : (
          <>
            <div className="oxy-card overflow-hidden">
              <table className="oxy-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Lote</th>
                    <th>Comprador</th>
                    <th>Valor</th>
                    <th>Motivo</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th className="w-12">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret) => {
                    const status = statusConfig[ret.status];

                    return (
                      <tr key={ret.id}>
                        <td className="font-mono text-xs text-muted-foreground">
                          {truncateId(ret.id)}
                        </td>
                        <td className="font-medium">
                          {ret.purchases?.lots?.title || "-"}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {ret.profiles?.full_name || "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {ret.profiles?.email || ""}
                            </span>
                          </div>
                        </td>
                        <td className="font-mono text-primary">
                          {ret.purchases
                            ? formatCurrency(ret.purchases.amount)
                            : "-"}
                        </td>
                        <td className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {ret.reason || "-"}
                        </td>
                        <td>
                          <Badge className={status.className}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="text-sm text-muted-foreground">
                          {formatDate(ret.created_at)}
                        </td>
                        <td>
                          {ret.status === "requested" && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                onClick={() => handleOpenApprove(ret)}
                                disabled={isProcessing}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleOpenReject(ret)}
                                disabled={isProcessing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
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

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar esta devolução
              {selectedReturn?.purchases?.lots?.title
                ? ` do lote "${selectedReturn.purchases.lots.title}"`
                : ""}
              ? O valor de{" "}
              {selectedReturn?.purchases
                ? formatCurrency(selectedReturn.purchases.amount)
                : ""}{" "}
              será reembolsado ao comprador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar esta devolução
              {selectedReturn?.purchases?.lots?.title
                ? ` do lote "${selectedReturn.purchases.lots.title}"`
                : ""}
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
