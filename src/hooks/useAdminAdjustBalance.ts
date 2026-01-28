import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdjustBalanceResult {
  success: boolean;
  new_balance?: number;
  message?: string;
  error?: string;
}

export function useAdminAdjustBalance() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const adjustBalance = async (
    userId: string,
    amount: number,
    reason: string
  ): Promise<AdjustBalanceResult> => {
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para realizar esta ação.",
          variant: "destructive",
        });
        return { success: false, error: "Não autenticado" };
      }

      const response = await supabase.functions.invoke("admin-adjust-balance", {
        body: { user_id: userId, amount, reason },
      });

      if (response.error) {
        const errorMessage = response.error.message || "Erro ao ajustar saldo";
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
        return { success: false, error: errorMessage };
      }

      const data = response.data as AdjustBalanceResult;

      if (!data.success) {
        toast({
          title: "Erro",
          description: data.error || "Erro ao ajustar saldo",
          variant: "destructive",
        });
        return { success: false, error: data.error };
      }

      toast({
        title: "Saldo ajustado",
        description: data.message || `R$ ${amount.toFixed(2)} adicionado com sucesso`,
      });

      return {
        success: true,
        new_balance: data.new_balance,
        message: data.message,
      };
    } catch (error) {
      console.error("Error adjusting balance:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { adjustBalance, loading };
}
