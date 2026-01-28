import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlaceBidResult {
  success: boolean;
  message: string;
  data?: {
    bid_id: string;
    new_price: number;
    ends_at: string;
    was_extended: boolean;
  };
  error?: string;
}

export function usePlaceBid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeBid = async (lotId: string, amount: number): Promise<PlaceBidResult> => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        const errorMsg = "Você precisa estar logado para dar lances";
        setError(errorMsg);
        return { success: false, message: "", error: errorMsg };
      }

      const response = await supabase.functions.invoke("place-bid", {
        body: { lot_id: lotId, amount },
      });

      if (response.error) {
        const errorMessage = response.error.message || "Erro ao processar lance";
        setError(errorMessage);
        return { success: false, message: "", error: errorMessage };
      }

      const result = response.data as PlaceBidResult;
      
      if (!result.success && result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      return { success: false, message: "", error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { placeBid, loading, error };
}
