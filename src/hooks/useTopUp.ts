import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

interface UseTopUpReturn {
  createCheckout: (amount: number) => Promise<void>;
  loading: boolean;
}

export function useTopUp(): UseTopUpReturn {
  const [loading, setLoading] = useState(false);
  const { trackApiCall } = useAnalytics();

  const createCheckout = async (amount: number) => {
    if (amount < 10 || amount > 10000) {
      toast.error("Valor inválido", {
        description: "O valor deve ser entre R$ 10 e R$ 10.000",
      });
      return;
    }

    setLoading(true);
    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { amount },
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar sessão de pagamento");
      }

      if (!data?.url) {
        throw new Error("URL de checkout não retornada");
      }

      trackApiCall("create-checkout", "success", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
      });

      // Abre em nova aba para funcionar no iframe de preview
      const checkoutWindow = window.open(data.url, "_blank");

      // Fallback: se popup bloqueado, tenta redirecionamento direto
      if (!checkoutWindow || checkoutWindow.closed) {
        window.location.href = data.url;
      }

      // Reseta loading após abrir a aba (UX melhor)
      setLoading(false);
    } catch (error: unknown) {
      console.error("Error creating checkout:", error);
      trackApiCall("create-checkout", "error", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
        error: error instanceof Error ? error.message : "unexpected_error",
      });
      toast({
        variant: "destructive",
        title: "Erro ao iniciar recarga",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
      });
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
