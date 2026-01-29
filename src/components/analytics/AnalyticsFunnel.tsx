import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsFunnel } from "@/hooks/useAnalyticsData";
import type { DateRange } from "@/pages/admin/AdminAnalytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  dateRange: DateRange;
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

export function AnalyticsFunnel({ dateRange }: Props) {
  const { data: funnel, isLoading } = useAnalyticsFunnel(dateRange);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  // Calculate conversion rates
  const funnelWithRates = funnel?.map((step, index) => {
    const prevCount = index > 0 ? funnel[index - 1].count : step.count;
    const conversionRate = prevCount > 0 ? (step.count / prevCount) * 100 : 0;
    const overallRate = funnel[0].count > 0 ? (step.count / funnel[0].count) * 100 : 0;
    
    return {
      ...step,
      conversionRate,
      overallRate,
    };
  }) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelWithRates}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="step" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name === "count" ? "Sessões" : name,
                ]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelWithRates.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {funnelWithRates.map((step, index) => (
              <div
                key={step.step}
                className="rounded-lg border p-4 space-y-2"
                style={{ borderColor: COLORS[index % COLORS.length] }}
              >
                <div className="text-sm font-medium text-muted-foreground">
                  {step.step}
                </div>
                <div className="text-2xl font-bold">{step.count.toLocaleString()}</div>
                {index > 0 && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Step: {step.conversionRate.toFixed(1)}%</span>
                    <span>|</span>
                    <span>Total: {step.overallRate.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
