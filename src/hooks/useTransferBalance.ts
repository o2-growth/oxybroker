import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  const transferBalance = async (
    toUserEmail: string,
    amount: number
  ): Promise<TransferResult> => {
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
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

      toast({
        title: "Transferência realizada!",
        description: `${formatCurrency(amount)} enviados para ${result.recipient_name}`,
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Erro na transferência",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
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
