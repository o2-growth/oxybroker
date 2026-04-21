import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useAnalytics } from "./useAnalytics";
import { getAmountBucket } from "@/lib/analytics";

interface BuyNowResult {
  success: boolean;
  data?: {
    purchase_id: string;
    lot_id?: string;
    lot_title: string;
    buy_now_price: number;
    return_deadline?: string;
  };
  error?: string;
  error_code?: string;
}

/**
 * Sprint 4 STORY-025
 * Buy Now em 2 modos:
 *  - `buyNow(lotId)` → compra imediata de lot existente (modo legado, bundle lots)
 *  - `buyNowLeadPreAuction(leadId)` → compra antes do leilão com premium 1.8x
 *    (apenas para leads_inbox com status 'approved', sem lot ativo)
 */
export function useBuyNow() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { trackApiCall, trackDomainEvent } = useAnalytics();

  const buyNow = async (lotId: string): Promise<BuyNowResult> => {
    const startedAt = Date.now();
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        trackApiCall("buy_now_atomic", "error", Date.now() - startedAt, {
          reason: "not_authenticated",
        }, "lot", lotId);
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
        trackApiCall("buy_now_atomic", "error", Date.now() - startedAt, {
          error: error.message,
        }, "lot", lotId);
        return {
          success: false,
          error: error.message,
        };
      }

      const result = data as {
        error_code?: string;
        error_message?: string;
        purchase_id?: string;
        lot_title?: string;
        buy_now_price?: number;
        return_deadline?: string;
      };

      if (result.error_code) {
        trackApiCall("buy_now_atomic", "error", Date.now() - startedAt, {
          error_code: result.error_code,
        }, "lot", lotId);
        return {
          success: false,
          error: result.error_message || "Erro ao processar compra",
          error_code: result.error_code,
        };
      }

      const amountBucket = getAmountBucket(result.buy_now_price!);
      trackApiCall("buy_now_atomic", "success", Date.now() - startedAt, {
        amount_bucket: amountBucket,
      }, "lot", lotId);
      trackDomainEvent("buy_now_executed", "success", {
        amount_bucket: amountBucket,
        purchase_method: "buy_now",
      }, "lot", lotId);
      trackDomainEvent("purchase_created", "success", {
        amount_bucket: amountBucket,
        purchase_method: "buy_now",
      }, "purchase", result.purchase_id);

      return {
        success: true,
        data: {
          purchase_id: result.purchase_id!,
          lot_title: result.lot_title!,
          buy_now_price: result.buy_now_price!,
          return_deadline: result.return_deadline,
        },
      };
    } catch (err: unknown) {
      trackApiCall("buy_now_atomic", "error", Date.now() - startedAt, {
        error: err instanceof Error ? err.message : "unexpected_error",
      }, "lot", lotId);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Erro inesperado",
      };
    } finally {
      setLoading(false);
    }
  };

  const buyNowLeadPreAuction = async (leadId: string): Promise<BuyNowResult> => {
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

      const { data, error } = await supabase.rpc("buy_now_lead_pre_auction", {
        p_lead_id: leadId,
        p_buyer_id: session.session.user.id,
      });

      if (error) return { success: false, error: error.message };

      const result = data as {
        error_code?: string;
        error_message?: string;
        purchase_id?: string;
        lot_id?: string;
        price?: number;
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
          lot_id: result.lot_id,
          lot_title: "Lead",
          buy_now_price: result.price!,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Erro ao processar compra",
      };
    } finally {
      setLoading(false);
    }
  };

  return { buyNow, buyNowLeadPreAuction, loading };
}
