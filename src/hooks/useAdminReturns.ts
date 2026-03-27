import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Return = Database["public"]["Tables"]["returns"]["Row"];
type ReturnStatus = Database["public"]["Enums"]["return_status"];

interface Purchase {
  id: string;
  amount: number;
  buyer_user_id: string;
  lot_id: string;
  lots: { title: string } | null;
}

interface Profile {
  full_name: string | null;
  email: string | null;
}

export interface ReturnWithDetails extends Return {
  purchases: Purchase | null;
  profiles: Profile | null;
}

interface ReturnFilters {
  status?: ReturnStatus | "all";
  page?: number;
  pageSize?: number;
}

export function useAdminReturns(filters: ReturnFilters = {}) {
  const { status, page = 1, pageSize = 10 } = filters;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-returns", status, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("returns")
        .select(
          `
          *,
          purchases(id, amount, buyer_user_id, lot_id, lots(title)),
          profiles!requested_by(full_name, email)
        `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { returns: data as ReturnWithDetails[], totalCount: count || 0 };
    },
  });

  const returns = data?.returns || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const processReturnMutation = useMutation({
    mutationFn: async ({
      return_id,
      action,
    }: {
      return_id: string;
      action: "approve" | "reject";
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "process-return",
        {
          body: { return_id, action },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      const actionLabel =
        variables.action === "approve" ? "aprovada" : "rejeitada";
      toast({
        title: `Devolução ${actionLabel}`,
        description: `A devolução foi ${actionLabel} com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar devolução",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    returns,
    totalCount,
    totalPages,
    isLoading,
    error,
    refetch,
    processReturn: processReturnMutation.mutateAsync,
    isProcessing: processReturnMutation.isPending,
  };
}
