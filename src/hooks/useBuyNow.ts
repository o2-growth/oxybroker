import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BuyNowResult {
  success: boolean;
  data?: {
    purchase_id: string;
    lot_title: string;
    buy_now_price: number;
    return_deadline: string;
  };
  error?: string;
  error_code?: string;
}

export function useBuyNow() {
  const [loading, setLoading] = useState(false);

  const buyNow = async (lotId: string): Promise<BuyNowResult> => {
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        return {
          success: false,
          error: "Você precisa estar logado para comprar.",
          error_code: "NOT_AUTHENTICATED",
        };
      }

      const { data, error } = await supabase.rpc("buy_now_atomic", {
        p_lot_id: lotId,
        p_user_id: session.session.user.id,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const result = data as {
        success?: boolean;
        error_code?: string;
        error_message?: string;
        purchase_id?: string;
        lot_title?: string;
        buy_now_price?: number;
        return_deadline?: string;
      };

      if (result.error_code) {
        return {
          success: false,
          error: result.error_message || "Erro ao processar compra",
          error_code: result.error_code,
        };
      }

      return {
        success: true,
        data: {
          purchase_id: result.purchase_id!,
          lot_title: result.lot_title!,
          buy_now_price: result.buy_now_price!,
          return_deadline: result.return_deadline!,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Erro ao processar compra",
      };
    } finally {
      setLoading(false);
    }
  };

  return { buyNow, loading };
}
