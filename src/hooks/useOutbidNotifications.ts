import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

interface OutbidPayload {
  lot_id: string;
  lot_title: string;
  your_bid: number;
  new_bid: number;
}

export function useOutbidNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Single broadcast channel for outbid notifications.
    // The broadcast event is sent directly by the server-side bid handler,
    // so it is specific and reliable. A second postgres_changes subscription
    // on the notifications table was previously here and caused every outbid
    // to fire two toasts — it has been removed (STORY-007).
    const channel = supabase
      .channel(`outbid-${user.id}`)
      .on("broadcast", { event: "outbid" }, (payload) => {
        const data = payload.payload as OutbidPayload;

        toast.error("Você foi ultrapassado!", {
          description: `Seu lance de ${formatCurrency(data.your_bid)} no lote "${data.lot_title}" foi superado por ${formatCurrency(data.new_bid)}.`,
          duration: 8000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
