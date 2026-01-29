import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnalyticsFunctions } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";

interface Props {
  dateRange: DateRange;
}

export function AnalyticsFunctions({ dateRange }: Props) {
  const { data: functions, isLoading } = useAnalyticsFunctions(dateRange);

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chamadas de API / Edge Functions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Função</TableHead>
              <TableHead className="text-right">Chamadas</TableHead>
              <TableHead className="text-right">Taxa de Erro</TableHead>
              <TableHead className="text-right">Latência Média</TableHead>
              <TableHead className="text-right">P95 Latência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {functions?.map((fn) => (
              <TableRow key={fn.name}>
                <TableCell className="font-mono text-sm">{fn.name}</TableCell>
                <TableCell className="text-right">{fn.calls.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={fn.errorRate > 5 ? "destructive" : fn.errorRate > 1 ? "secondary" : "outline"}
                  >
                    {fn.errorRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{fn.avgDuration.toFixed(0)}ms</TableCell>
                <TableCell className="text-right">{fn.p95Duration.toFixed(0)}ms</TableCell>
              </TableRow>
            ))}
            {(!functions || functions.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum dado disponível para o período selecionado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
