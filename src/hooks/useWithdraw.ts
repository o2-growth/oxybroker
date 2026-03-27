import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/request-withdrawal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            amount,
            bank_info: bankInfo,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao solicitar saque");
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
