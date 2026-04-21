import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

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
  const { toast } = useToast();
  const { trackApiCall } = useAnalytics();

  const requestWithdrawal = async (amount: number, bankInfo: BankInfo) => {
    const startedAt = Date.now();
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        trackApiCall("request-withdrawal", "error", Date.now() - startedAt, {
          reason: "not_authenticated",
        });
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para solicitar saque.",
          variant: "destructive",
        });
        setLoading(false);
        return false;
      }

      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { amount, bank_info: bankInfo },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      trackApiCall("request-withdrawal", "success", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
        transfer_type: bankInfo.type,
      });

      toast({
        title: "Solicitação enviada!",
        description:
          "Seu pedido de saque foi registrado e será processado em breve.",
      });

      setLoading(false);
      return true;
    } catch (error: unknown) {
      trackApiCall("request-withdrawal", "error", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
        transfer_type: bankInfo.type,
        error: error instanceof Error ? error.message : "unexpected_error",
      });
      toast({
        title: "Erro ao solicitar saque",
        description: error instanceof Error ? error.message : "Erro inesperado",
        variant: "destructive",
      });
      setLoading(false);
      return false;
    }
  };

  return { requestWithdrawal, loading };
}
