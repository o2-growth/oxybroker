import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  const requestWithdrawal = async (amount: number, bankInfo: BankInfo) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
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

      toast({
        title: "Solicitação enviada!",
        description:
          "Seu pedido de saque foi registrado e será processado em breve.",
      });

      setLoading(false);
      return true;
    } catch (error: unknown) {
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
