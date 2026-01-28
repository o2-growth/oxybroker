import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UseTopUpReturn {
  createCheckout: (amount: number) => Promise<void>;
  loading: boolean;
}

export function useTopUp(): UseTopUpReturn {
  const [loading, setLoading] = useState(false);

  const createCheckout = async (amount: number) => {
    if (amount < 10 || amount > 10000) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
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

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        variant: "destructive",
        title: "Erro ao iniciar recarga",
        description: error.message || "Tente novamente mais tarde",
      });
      setLoading(false);
    }
  };

  return { createCheckout, loading };
}
