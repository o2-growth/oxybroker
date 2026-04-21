import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export type PromotionType = "discount" | "cashback";
export type PromotionAppliesTo = "topup" | "bid" | "purchase";
export type BenefitType = "percentage" | "fixed";
export type EligibilityType = "global" | "category" | "individual";
export type ScheduleType = "one_time" | "recurring";

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  applies_to: PromotionAppliesTo;
  benefit_type: BenefitType;
  benefit_value: number;
  min_amount: number | null;
  max_benefit: number | null;
  eligibility: EligibilityType;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromotionSchedule {
  id: string;
  promotion_id: string;
  schedule_type: ScheduleType;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface PromotionEligibility {
  id: string;
  promotion_id: string;
  category_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface PromotionUsage {
  id: string;
  promotion_id: string;
  user_id: string;
  original_amount: number;
  benefit_amount: number;
  reference_type: string;
  reference_id: string | null;
  created_at: string;
}

export interface PromotionWithDetails extends Promotion {
  schedule?: PromotionSchedule;
  eligibility_entries?: PromotionEligibility[];
  usage_count?: number;
  total_benefit?: number;
}

export interface CreatePromotionInput {
  name: string;
  description?: string;
  type: PromotionType;
  applies_to: PromotionAppliesTo;
  benefit_type: BenefitType;
  benefit_value: number;
  min_amount?: number;
  max_benefit?: number;
  eligibility: EligibilityType;
  is_active?: boolean;
  // Schedule
  schedule_type?: ScheduleType;
  starts_at?: string;
  ends_at?: string;
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
  // Eligibility
  category_ids?: string[];
  user_ids?: string[];
}

export function usePromotions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const promotionsQuery = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Promotion[];
    },
  });

  const promotionDetailsQuery = (promotionId: string) => useQuery({
    queryKey: ["promotion", promotionId],
    queryFn: async () => {
      // Get promotion
      const { data: promotion, error: promoError } = await supabase
        .from("promotions")
        .select("*")
        .eq("id", promotionId)
        .single();

      if (promoError) throw promoError;

      // Get schedule
      const { data: schedules } = await supabase
        .from("promotion_schedules")
        .select("*")
        .eq("promotion_id", promotionId);

      // Get eligibility entries
      const { data: eligibility } = await supabase
        .from("promotion_eligibility")
        .select("*")
        .eq("promotion_id", promotionId);

      // Get usage stats
      const { data: usage } = await supabase
        .from("promotion_usage")
        .select("benefit_amount")
        .eq("promotion_id", promotionId);

      return {
        ...promotion,
        schedule: schedules?.[0] || undefined,
        eligibility_entries: eligibility || [],
        usage_count: usage?.length || 0,
        total_benefit: usage?.reduce((sum, u) => sum + Number(u.benefit_amount), 0) || 0,
      } as PromotionWithDetails;
    },
    enabled: !!promotionId,
  });

  const createPromotion = useMutation({
    mutationFn: async (input: CreatePromotionInput) => {
      // Create promotion
      const { data: promotion, error: promoError } = await supabase
        .from("promotions")
        .insert({
          name: input.name,
          description: input.description,
          type: input.type,
          applies_to: input.applies_to,
          benefit_type: input.benefit_type,
          benefit_value: input.benefit_value,
          min_amount: input.min_amount || 0,
          max_benefit: input.max_benefit,
          eligibility: input.eligibility,
          is_active: input.is_active ?? true,
          created_by: user?.id,
        })
        .select()
        .single();

      if (promoError) throw promoError;

      // Create schedule if provided
      if (input.schedule_type) {
        const { error: scheduleError } = await supabase
          .from("promotion_schedules")
          .insert({
            promotion_id: promotion.id,
            schedule_type: input.schedule_type,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            days_of_week: input.days_of_week,
            start_time: input.start_time,
            end_time: input.end_time,
          });

        if (scheduleError) throw scheduleError;
      }

      // Create eligibility entries
      if (input.eligibility === "category" && input.category_ids?.length) {
        const eligibilityEntries = input.category_ids.map((catId) => ({
          promotion_id: promotion.id,
          category_id: catId,
          user_id: null,
        }));

        const { error: eligError } = await supabase
          .from("promotion_eligibility")
          .insert(eligibilityEntries);

        if (eligError) throw eligError;
      }

      if (input.eligibility === "individual" && input.user_ids?.length) {
        const eligibilityEntries = input.user_ids.map((userId) => ({
          promotion_id: promotion.id,
          category_id: null,
          user_id: userId,
        }));

        const { error: eligError } = await supabase
          .from("promotion_eligibility")
          .insert(eligibilityEntries);

        if (eligError) throw eligError;
      }

      return promotion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promoção criada", {
        description: "A promoção foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar promoção", { description: error.message });
    },
  });

  const updatePromotion = useMutation({
    mutationFn: async ({ id, ...input }: CreatePromotionInput & { id: string }) => {
      // Update promotion
      const { error: promoError } = await supabase
        .from("promotions")
        .update({
          name: input.name,
          description: input.description,
          type: input.type,
          applies_to: input.applies_to,
          benefit_type: input.benefit_type,
          benefit_value: input.benefit_value,
          min_amount: input.min_amount || 0,
          max_benefit: input.max_benefit,
          eligibility: input.eligibility,
          is_active: input.is_active,
        })
        .eq("id", id);

      if (promoError) throw promoError;

      // Update schedule - delete and recreate
      await supabase.from("promotion_schedules").delete().eq("promotion_id", id);

      if (input.schedule_type) {
        const { error: scheduleError } = await supabase
          .from("promotion_schedules")
          .insert({
            promotion_id: id,
            schedule_type: input.schedule_type,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            days_of_week: input.days_of_week,
            start_time: input.start_time,
            end_time: input.end_time,
          });

        if (scheduleError) throw scheduleError;
      }

      // Update eligibility - delete and recreate
      await supabase.from("promotion_eligibility").delete().eq("promotion_id", id);

      if (input.eligibility === "category" && input.category_ids?.length) {
        const eligibilityEntries = input.category_ids.map((catId) => ({
          promotion_id: id,
          category_id: catId,
          user_id: null,
        }));

        const { error: eligError } = await supabase
          .from("promotion_eligibility")
          .insert(eligibilityEntries);

        if (eligError) throw eligError;
      }

      if (input.eligibility === "individual" && input.user_ids?.length) {
        const eligibilityEntries = input.user_ids.map((userId) => ({
          promotion_id: id,
          category_id: null,
          user_id: userId,
        }));

        const { error: eligError } = await supabase
          .from("promotion_eligibility")
          .insert(eligibilityEntries);

        if (eligError) throw eligError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promoção atualizada", {
        description: "A promoção foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar promoção", { description: error.message });
    },
  });

  const togglePromotionActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("promotions")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(variables.is_active ? "Promoção ativada" : "Promoção pausada", {
        description: variables.is_active
          ? "A promoção está ativa e disponível para uso."
          : "A promoção foi pausada e não está mais disponível.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar promoção", { description: error.message });
    },
  });

  const deletePromotion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promoção excluída", {
        description: "A promoção foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir promoção", { description: error.message });
    },
  });

  return {
    promotions: promotionsQuery.data || [],
    loading: promotionsQuery.isLoading,
    error: promotionsQuery.error,
    refetch: promotionsQuery.refetch,
    getPromotionDetails: promotionDetailsQuery,
    createPromotion,
    updatePromotion,
    togglePromotionActive,
    deletePromotion,
  };
}
