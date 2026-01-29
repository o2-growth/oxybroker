import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromotionUsageStats {
  promotionId: string;
  usageCount: number;
  totalBenefit: number;
}

export function usePromotionUsageStats(promotionIds: string[]) {
  return useQuery({
    queryKey: ["promotion-usage-stats", promotionIds],
    queryFn: async () => {
      if (!promotionIds.length) return {};

      const { data, error } = await supabase
        .from("promotion_usage")
        .select("promotion_id, benefit_amount")
        .in("promotion_id", promotionIds);

      if (error) throw error;

      // Aggregate stats by promotion
      const stats: Record<string, PromotionUsageStats> = {};
      
      for (const promoId of promotionIds) {
        stats[promoId] = {
          promotionId: promoId,
          usageCount: 0,
          totalBenefit: 0,
        };
      }

      for (const usage of data || []) {
        if (stats[usage.promotion_id]) {
          stats[usage.promotion_id].usageCount += 1;
          stats[usage.promotion_id].totalBenefit += Number(usage.benefit_amount);
        }
      }

      return stats;
    },
    enabled: promotionIds.length > 0,
  });
}
