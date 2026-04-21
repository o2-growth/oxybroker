import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/pages/admin/AdminAnalytics";

function getEventMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function getActorKey(event: {
  session_id?: string | null;
  user_id?: string | null;
  entity_id?: string | null;
}): string | null {
  return event.session_id ?? event.user_id ?? event.entity_id ?? null;
}

// Overview metrics
export function useAnalyticsOverview(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "overview", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const from = dateRange.from.toISOString();
      const to = dateRange.to.toISOString();

      // Get page views and unique users
      const { data: pageViews, error: pvError } = await supabase
        .from("analytics_events")
        .select("user_id, session_id")
        .eq("event_type", "page_view")
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      if (pvError) throw pvError;

      // Get domain events counts
      const { data: domainEvents, error: deError } = await supabase
        .from("analytics_events")
        .select("event_name, status")
        .eq("event_type", "domain_event")
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      if (deError) throw deError;

      // Get API call stats
      const { data: apiCalls, error: apiError } = await supabase
        .from("analytics_events")
        .select("event_name, status, duration_ms")
        .eq("event_type", "api_call")
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      if (apiError) throw apiError;

      // Calculate metrics
      const uniqueUsers = new Set(pageViews?.filter(p => p.user_id).map(p => p.user_id)).size;
      const uniqueSessions = new Set(pageViews?.map(p => p.session_id)).size;
      const totalPageViews = pageViews?.length || 0;

      // Domain event counts
      const bidsCount = domainEvents?.filter(e => e.event_name === "bid_placed").length || 0;
      const purchasesCount = domainEvents?.filter(e => e.event_name === "purchase_created").length || 0;
      const buyNowCount = domainEvents?.filter(e => e.event_name === "buy_now_executed").length || 0;
      const refundsCount = domainEvents?.filter(e => e.event_name === "refund_processed").length || 0;

      // API error rate
      const totalApiCalls = apiCalls?.length || 0;
      const errorApiCalls = apiCalls?.filter(a => a.status === "error").length || 0;
      const errorRate = totalApiCalls > 0 ? (errorApiCalls / totalApiCalls) * 100 : 0;

      // Average API duration
      const durations = apiCalls?.filter(a => a.duration_ms).map(a => a.duration_ms!) || [];
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      return {
        uniqueUsers,
        uniqueSessions,
        totalPageViews,
        bidsCount,
        purchasesCount,
        buyNowCount,
        refundsCount,
        errorRate,
        avgDuration,
        totalApiCalls,
      };
    },
  });
}

// Screen/route analytics
export function useAnalyticsScreens(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "screens", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("route, user_id, session_id")
        .eq("event_type", "page_view")
        .gte("occurred_at", dateRange.from.toISOString())
        .lte("occurred_at", dateRange.to.toISOString())
        .not("route", "is", null);

      if (error) throw error;

      // Group by route
      const routeMap = new Map<string, { views: number; users: Set<string>; sessions: Set<string> }>();
      
      data?.forEach((event) => {
        const route = event.route!;
        if (!routeMap.has(route)) {
          routeMap.set(route, { views: 0, users: new Set(), sessions: new Set() });
        }
        const entry = routeMap.get(route)!;
        entry.views++;
        if (event.user_id) entry.users.add(event.user_id);
        entry.sessions.add(event.session_id);
      });

      return Array.from(routeMap.entries())
        .map(([route, stats]) => ({
          route,
          views: stats.views,
          uniqueUsers: stats.users.size,
          uniqueSessions: stats.sessions.size,
        }))
        .sort((a, b) => b.views - a.views);
    },
  });
}

// Function/API analytics
export function useAnalyticsFunctions(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "functions", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("event_name, status, duration_ms")
        .eq("event_type", "api_call")
        .gte("occurred_at", dateRange.from.toISOString())
        .lte("occurred_at", dateRange.to.toISOString());

      if (error) throw error;

      // Group by function name
      const fnMap = new Map<string, { calls: number; errors: number; durations: number[] }>();
      
      data?.forEach((event) => {
        const fn = event.event_name;
        if (!fnMap.has(fn)) {
          fnMap.set(fn, { calls: 0, errors: 0, durations: [] });
        }
        const entry = fnMap.get(fn)!;
        entry.calls++;
        if (event.status === "error") entry.errors++;
        if (event.duration_ms) entry.durations.push(event.duration_ms);
      });

      return Array.from(fnMap.entries())
        .map(([name, stats]) => {
          const sortedDurations = [...stats.durations].sort((a, b) => a - b);
          const p95Index = Math.floor(sortedDurations.length * 0.95);
          
          return {
            name,
            calls: stats.calls,
            errorRate: stats.calls > 0 ? (stats.errors / stats.calls) * 100 : 0,
            avgDuration: stats.durations.length > 0
              ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
              : 0,
            p95Duration: sortedDurations[p95Index] || 0,
          };
        })
        .sort((a, b) => b.calls - a.calls);
    },
  });
}

// User analytics
export function useAnalyticsUsers(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "users", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("user_id, event_type, event_name")
        .gte("occurred_at", dateRange.from.toISOString())
        .lte("occurred_at", dateRange.to.toISOString())
        .not("user_id", "is", null);

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, { pageViews: number; bids: number; purchases: number; topups: number }>();
      
      data?.forEach((event) => {
        const userId = event.user_id!;
        if (!userMap.has(userId)) {
          userMap.set(userId, { pageViews: 0, bids: 0, purchases: 0, topups: 0 });
        }
        const entry = userMap.get(userId)!;
        
        if (event.event_type === "page_view") entry.pageViews++;
        if (event.event_name === "bid_placed") entry.bids++;
        if (event.event_name === "purchase_created") entry.purchases++;
        if (event.event_name === "topup_confirmed") entry.topups++;
      });

      return Array.from(userMap.entries())
        .map(([userId, stats]) => ({
          userId,
          ...stats,
        }))
        .sort((a, b) => b.pageViews - a.pageViews)
        .slice(0, 100); // Top 100 users
    },
  });
}

// Funnel analytics
export function useAnalyticsFunnel(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "funnel", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const from = dateRange.from.toISOString();
      const to = dateRange.to.toISOString();

      // Get all relevant events
      const { data, error } = await supabase
        .from("analytics_events")
        .select("event_type, event_name, route, session_id, user_id, entity_id, metadata")
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      if (error) throw error;

      // Count unique sessions for each funnel step
      const marketplaceViews = new Set(
        data
          ?.filter(e => e.event_type === "page_view" && e.route === "/marketplace")
          .map(getActorKey)
          .filter((value): value is string => Boolean(value))
      );

      const lotViews = new Set(
        data
          ?.filter(e => e.event_type === "page_view" && e.route?.startsWith("/lots/"))
          .map(getActorKey)
          .filter((value): value is string => Boolean(value))
      );

      const bidsPlaced = new Set(
        data
          ?.filter(e => e.event_name === "bid_placed")
          .map(getActorKey)
          .filter((value): value is string => Boolean(value))
      );

      const auctionsWon = new Set(
        data
          ?.filter(e => e.event_name === "auction_won")
          .map(getActorKey)
          .filter((value): value is string => Boolean(value))
      );

      const purchasesPaid = new Set(
        data
          ?.filter((e) => {
            if (e.event_name !== "purchase_created") return false;
            const metadata = getEventMetadata(e.metadata);
            return metadata?.purchase_method === "auction";
          })
          .map(getActorKey)
          .filter((value): value is string => Boolean(value))
      );

      return [
        { step: "Marketplace View", count: marketplaceViews.size },
        { step: "Lot View", count: lotViews.size },
        { step: "Bid Placed", count: bidsPlaced.size },
        { step: "Auction Won", count: auctionsWon.size },
        { step: "Auction Purchase", count: purchasesPaid.size },
      ];
    },
  });
}

// Audit/raw events
export function useAnalyticsAudit(dateRange: DateRange, page: number = 0, pageSize: number = 50) {
  return useQuery({
    queryKey: ["analytics", "audit", dateRange.from.toISOString(), dateRange.to.toISOString(), page, pageSize],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact" })
        .gte("occurred_at", dateRange.from.toISOString())
        .lte("occurred_at", dateRange.to.toISOString())
        .order("occurred_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      return { data: data || [], totalCount: count || 0 };
    },
  });
}

// Timeseries data for charts
export function useAnalyticsTimeseries(dateRange: DateRange) {
  return useQuery({
    queryKey: ["analytics", "timeseries", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("occurred_at, event_type, event_name")
        .gte("occurred_at", dateRange.from.toISOString())
        .lte("occurred_at", dateRange.to.toISOString())
        .order("occurred_at", { ascending: true });

      if (error) throw error;

      // Group by date
      const dateMap = new Map<string, { pageViews: number; actions: number; apiCalls: number; events: number }>();
      
      data?.forEach((event) => {
        const date = new Date(event.occurred_at).toISOString().split("T")[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, { pageViews: 0, actions: 0, apiCalls: 0, events: 0 });
        }
        const entry = dateMap.get(date)!;
        
        switch (event.event_type) {
          case "page_view":
            entry.pageViews++;
            break;
          case "ui_action":
            entry.actions++;
            break;
          case "api_call":
            entry.apiCalls++;
            break;
          case "domain_event":
            entry.events++;
            break;
        }
      });

      return Array.from(dateMap.entries())
        .map(([date, stats]) => ({
          date,
          ...stats,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
