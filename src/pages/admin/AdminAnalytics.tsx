import { useState } from "react";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import { AnalyticsScreens } from "@/components/analytics/AnalyticsScreens";
import { AnalyticsFunctions } from "@/components/analytics/AnalyticsFunctions";
import { AnalyticsUsers } from "@/components/analytics/AnalyticsUsers";
import { AnalyticsFunnel } from "@/components/analytics/AnalyticsFunnel";
import { AnalyticsAudit } from "@/components/analytics/AnalyticsAudit";
import { DateRangePicker } from "@/components/analytics/DateRangePicker";
import { subDays, subHours, startOfDay, endOfDay } from "date-fns";

export type DateRange = {
  from: Date;
  to: Date;
};

export default function AdminAnalytics() {
  const { loading, isAuthorized } = useRoleGuard("admin");
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const [preset, setPreset] = useState<"24h" | "7d" | "30d" | "custom">("7d");

  const handlePresetChange = (newPreset: "24h" | "7d" | "30d" | "custom") => {
    setPreset(newPreset);
    const now = new Date();
    
    switch (newPreset) {
      case "24h":
        setDateRange({ from: subHours(now, 24), to: now });
        break;
      case "7d":
        setDateRange({ from: startOfDay(subDays(now, 7)), to: endOfDay(now) });
        break;
      case "30d":
        setDateRange({ from: startOfDay(subDays(now, 30)), to: endOfDay(now) });
        break;
    }
  };

  const handleCustomRange = (range: DateRange) => {
    setPreset("custom");
    setDateRange(range);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <AppShell>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <DateRangePicker
            preset={preset}
            dateRange={dateRange}
            onPresetChange={handlePresetChange}
            onCustomRange={handleCustomRange}
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="screens">Telas</TabsTrigger>
            <TabsTrigger value="functions">Funções</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="funnel">Funil</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AnalyticsOverview dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="screens" className="mt-6">
            <AnalyticsScreens dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="functions" className="mt-6">
            <AnalyticsFunctions dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <AnalyticsUsers dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="funnel" className="mt-6">
            <AnalyticsFunnel dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AnalyticsAudit dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
