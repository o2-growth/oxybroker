import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAnalytics } from "./useAnalytics";

interface RequestReturnResult {
  success: boolean;
  return_id?: string;
  error?: string;
}

export function useRequestReturn() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { trackApiCall } = useAnalytics();

  const requestReturn = async (
    purchaseId: string,
    reason?: string
  ): Promise<RequestReturnResult> => {
    const startedAt = Date.now();
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        trackApiCall("request-return", "error", Date.now() - startedAt, {
          reason: "not_authenticated",
        }, "purchase", purchaseId);
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

      trackApiCall("request-return", "success", Date.now() - startedAt, undefined, "purchase", purchaseId);

      toast({
        title: "Devolução solicitada",
        description: "Sua solicitação será analisada em breve.",
      });

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      trackApiCall("request-return", "error", Date.now() - startedAt, {
        error: message,
      }, "purchase", purchaseId);
      toast({
        title: "Erro ao solicitar devolução",
        description: message,
        variant: "destructive",
      });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  return { requestReturn, loading };
}
