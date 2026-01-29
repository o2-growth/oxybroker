import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAnalyticsAudit } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  dateRange: DateRange;
}

export function AnalyticsAudit({ dateRange }: Props) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useAnalyticsAudit(dateRange, page, pageSize);

  const handleExportCSV = () => {
    if (!data?.data) return;

    const headers = [
      "ID",
      "Data/Hora",
      "Tipo",
      "Evento",
      "Rota",
      "User ID",
      "Role",
      "Status",
      "Duração (ms)",
      "Entity Type",
      "Entity ID",
    ];

    const rows = data.data.map((event) => [
      event.id,
      format(new Date(event.occurred_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      event.event_type,
      event.event_name,
      event.route || "",
      event.user_id || "",
      event.role || "",
      event.status || "",
      event.duration_ms?.toString() || "",
      event.entity_type || "",
      event.entity_id || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `analytics_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = data?.data.filter((event) => {
    if (!filter) return true;
    const searchLower = filter.toLowerCase();
    return (
      event.event_name.toLowerCase().includes(searchLower) ||
      event.event_type.toLowerCase().includes(searchLower) ||
      event.route?.toLowerCase().includes(searchLower) ||
      event.status?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / pageSize);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Log de Eventos</CardTitle>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Filtrar por evento, tipo, rota..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs">
                    {format(new Date(event.occurred_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">
                      {event.event_type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.event_name}</TableCell>
                  <TableCell className="font-mono text-xs">{event.route || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {event.user_id ? `${event.user_id.slice(0, 8)}...` : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{event.status || "-"}</TableCell>
                  <TableCell className="text-right text-xs">
                    {event.duration_ms ? `${event.duration_ms}ms` : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredData || filteredData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum evento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, data?.totalCount || 0)} de{" "}
            {data?.totalCount || 0} eventos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Página {page + 1} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
