import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

interface TransferResult {
  success: boolean;
  transfer_id?: string;
  amount?: number;
  new_balance?: number;
  recipient_name?: string;
  error?: string;
}

export function useTransferBalance() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { trackApiCall } = useAnalytics();

  const transferBalance = async (
    toUserEmail: string,
    amount: number
  ): Promise<TransferResult> => {
    const startedAt = Date.now();
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        trackApiCall("create-transfer", "error", Date.now() - startedAt, {
          reason: "not_authenticated",
        });
        throw new Error("Usuário não autenticado");
      }

      const response = await supabase.functions.invoke("create-transfer", {
        body: { to_user_email: toUserEmail, amount },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || "Erro ao realizar transferência");
      }

      trackApiCall("create-transfer", "success", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
      });

      toast({
        title: "Transferência realizada!",
        description: `${formatCurrency(amount)} enviados para ${result.recipient_name}`,
      });

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      trackApiCall("create-transfer", "error", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
        error: message,
      });
      toast({
        title: "Erro na transferência",
        description: message,
        variant: "destructive",
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return { transferBalance, loading };
}
