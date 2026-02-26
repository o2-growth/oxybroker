import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BankInfo {
  type: "pix" | "bank_account";
  pix_key?: string;
  bank_code?: string;
  agency?: string;
  account?: string;
  account_type?: "corrente" | "poupanca";
}

export function useWithdraw() {
  const [loading, setLoading] = useState(false);

  const requestWithdrawal = async (amount: number, bankInfo: BankInfo) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: {
          amount,
          bank_info: bankInfo,
        },
      });

      if (error) throw error;

      toast.success("Solicitação enviada!", {
        description: "Seu pedido de saque foi registrado e será processado em breve.",
      });

      setLoading(false);
      return true;
    } catch (error) {
      toast.error("Erro ao solicitar saque", { description: error instanceof Error ? error.message : String(error) });
      setLoading(false);
      return false;
    }
  };

  return { requestWithdrawal, loading };
}
