import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RequestReturnResult {
  success: boolean;
  return_id?: string;
  error?: string;
}

export function useRequestReturn() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const requestReturn = async (
    purchaseId: string,
    reason?: string
  ): Promise<RequestReturnResult> => {
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Usuário não autenticado");
      }

      const response = await supabase.functions.invoke("request-return", {
        body: { purchase_id: purchaseId, reason },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || "Erro ao solicitar devolução");
      }

      toast({
        title: "Devolução solicitada",
        description: "Sua solicitação será analisada em breve.",
      });

      return result;
    } catch (error: any) {
      toast({
        title: "Erro ao solicitar devolução",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return { requestReturn, loading };
}
