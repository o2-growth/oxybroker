import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAnalyticsUsers } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";

interface Props {
  dateRange: DateRange;
}

export function AnalyticsUsers({ dateRange }: Props) {
  const { data: users, isLoading } = useAnalyticsUsers(dateRange);

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade por Usuário (Top 100)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead className="text-right">Page Views</TableHead>
              <TableHead className="text-right">Lances</TableHead>
              <TableHead className="text-right">Compras</TableHead>
              <TableHead className="text-right">Top-ups</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.userId}>
                <TableCell className="font-mono text-xs">{user.userId.slice(0, 8)}...</TableCell>
                <TableCell className="text-right">{user.pageViews.toLocaleString()}</TableCell>
                <TableCell className="text-right">{user.bids.toLocaleString()}</TableCell>
                <TableCell className="text-right">{user.purchases.toLocaleString()}</TableCell>
                <TableCell className="text-right">{user.topups.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {(!users || users.length === 0) && (
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
