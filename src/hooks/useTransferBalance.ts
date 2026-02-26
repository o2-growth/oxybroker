import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

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

      toast.success("Transferência realizada!", {
        description: `${formatCurrency(amount)} enviados para ${result.recipient_name}`,
      });

      return result;
    } catch (error: any) {
      toast.error("Erro na transferência", { description: error.message });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { transferBalance, loading };
}
