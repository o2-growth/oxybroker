import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsOverview, useAnalyticsTimeseries } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";
import { Users, Eye, Gavel, ShoppingCart, Zap, AlertTriangle, Timer, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  dateRange: DateRange;
}

export function AnalyticsOverview({ dateRange }: Props) {
  const { data: overview, isLoading: loadingOverview } = useAnalyticsOverview(dateRange);
  const { data: timeseries, isLoading: loadingTimeseries } = useAnalyticsTimeseries(dateRange);

  if (loadingOverview) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const metrics = [
    { label: "Usuários Únicos", value: overview?.uniqueUsers || 0, icon: Users, color: "text-blue-500" },
    { label: "Page Views", value: overview?.totalPageViews || 0, icon: Eye, color: "text-green-500" },
    { label: "Lances", value: overview?.bidsCount || 0, icon: Gavel, color: "text-orange-500" },
    { label: "Compras", value: overview?.purchasesCount || 0, icon: ShoppingCart, color: "text-purple-500" },
    { label: "Buy Now", value: overview?.buyNowCount || 0, icon: Zap, color: "text-yellow-500" },
    { label: "Reembolsos", value: overview?.refundsCount || 0, icon: TrendingUp, color: "text-red-500" },
    { label: "Taxa de Erro", value: `${(overview?.errorRate || 0).toFixed(1)}%`, icon: AlertTriangle, color: "text-red-400" },
    { label: "Latência Média", value: `${(overview?.avgDuration || 0).toFixed(0)}ms`, icon: Timer, color: "text-cyan-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTimeseries ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeseries || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actions"
                  name="UI Actions"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="apiCalls"
                  name="API Calls"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  name="Domain Events"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
