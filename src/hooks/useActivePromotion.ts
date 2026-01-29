import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PromotionAppliesTo = "topup" | "bid" | "purchase";

export interface ActivePromotion {
  promotion_id: string;
  name: string;
  type: "discount" | "cashback";
  benefit_type: "percentage" | "fixed";
  benefit_value: number;
  max_benefit: number | null;
}

export function useActivePromotion(appliesTo: PromotionAppliesTo, amount: number) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["active-promotion", user?.id, appliesTo, amount],
    queryFn: async () => {
      if (!user?.id || amount <= 0) return null;

      const { data, error } = await supabase.rpc("get_active_promotion", {
        p_user_id: user.id,
        p_applies_to: appliesTo,
        p_amount: amount,
      });

      if (error) {
        console.error("Error fetching active promotion:", error);
        return null;
      }

      if (!data || data.length === 0) return null;

      const promo = data[0];
      return {
        promotion_id: promo.promotion_id,
        name: promo.name,
        type: promo.type as "discount" | "cashback",
        benefit_type: promo.benefit_type as "percentage" | "fixed",
        benefit_value: Number(promo.benefit_value),
        max_benefit: promo.max_benefit ? Number(promo.max_benefit) : null,
      } as ActivePromotion;
    },
    enabled: !!user?.id && amount > 0,
    staleTime: 30000, // 30 seconds
  });

  // Calculate benefit amount
  const calculateBenefit = (originalAmount: number): number => {
    if (!query.data) return 0;

    let benefit: number;
    if (query.data.benefit_type === "percentage") {
      benefit = originalAmount * (query.data.benefit_value / 100);
    } else {
      benefit = query.data.benefit_value;
    }

    // Apply max cap
    if (query.data.max_benefit && benefit > query.data.max_benefit) {
      benefit = query.data.max_benefit;
    }

    return Math.round(benefit * 100) / 100;
  };

  return {
    promotion: query.data,
    loading: query.isLoading,
    error: query.error,
    calculateBenefit,
    refetch: query.refetch,
  };
}
