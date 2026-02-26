import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseTopUpReturn {
  createCheckout: (amount: number) => Promise<void>;
  loading: boolean;
}

export function useTopUp(): UseTopUpReturn {
  const [loading, setLoading] = useState(false);

  const createCheckout = async (amount: number) => {
    if (amount < 10 || amount > 10000) {
      toast.error("Valor inválido", {
        description: "O valor deve ser entre R$ 10 e R$ 10.000",
      });
      return;
    }

    setLoading(true);
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

      // Abre em nova aba para funcionar no iframe de preview
      const checkoutWindow = window.open(data.url, "_blank");

      // Fallback: se popup bloqueado, tenta redirecionamento direto
      if (!checkoutWindow || checkoutWindow.closed) {
        window.location.href = data.url;
      }

      // Reseta loading após abrir a aba (UX melhor)
      setLoading(false);
    } catch (error) {
      toast.error("Erro ao iniciar recarga", {
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
      });
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
