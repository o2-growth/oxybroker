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
import { useAnalyticsScreens } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  dateRange: DateRange;
}

export function AnalyticsScreens({ dateRange }: Props) {
  const { data: screens, isLoading } = useAnalyticsScreens(dateRange);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const top10 = screens?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Telas por Views</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="route"
                tick={{ fontSize: 11 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todas as Telas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Usuários Únicos</TableHead>
                <TableHead className="text-right">Sessões Únicas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {screens?.map((screen) => (
                <TableRow key={screen.route}>
                  <TableCell className="font-mono text-sm">{screen.route}</TableCell>
                  <TableCell className="text-right">{screen.views.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{screen.uniqueUsers.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{screen.uniqueSessions.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {(!screens || screens.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum dado disponível para o período selecionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
