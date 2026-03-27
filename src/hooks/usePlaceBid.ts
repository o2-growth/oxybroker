import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

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
  const { trackApiCall } = useAnalytics();

  const placeBid = async (lotId: string, amount: number): Promise<PlaceBidResult> => {
    const startedAt = Date.now();
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        const errorMsg = "Você precisa estar logado para dar lances";
        setError(errorMsg);
        trackApiCall("place-bid", "error", Date.now() - startedAt, {
          reason: "not_authenticated",
        }, "lot", lotId);
        return { success: false, message: "", error: errorMsg };
      }

      const response = await supabase.functions.invoke("place-bid", {
        body: { lot_id: lotId, amount },
      });

      if (response.error) {
        const errorMessage = response.error.message || "Erro ao processar lance";
        setError(errorMessage);
        trackApiCall("place-bid", "error", Date.now() - startedAt, {
          amount_bucket: getAmountBucket(amount),
          error: errorMessage,
        }, "lot", lotId);
        return { success: false, message: "", error: errorMessage };
      }

      const result = response.data as PlaceBidResult;
      
      if (!result.success && result.error) {
        setError(result.error);
        trackApiCall("place-bid", "error", Date.now() - startedAt, {
          amount_bucket: getAmountBucket(amount),
          error: result.error,
        }, "lot", lotId);
      } else {
        trackApiCall("place-bid", "success", Date.now() - startedAt, {
          amount_bucket: getAmountBucket(amount),
        }, "lot", lotId);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      trackApiCall("place-bid", "error", Date.now() - startedAt, {
        amount_bucket: getAmountBucket(amount),
        error: errorMessage,
      }, "lot", lotId);
      return { success: false, message: "", error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { placeBid, loading, error };
}
