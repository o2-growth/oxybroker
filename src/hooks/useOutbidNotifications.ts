import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface OutbidPayload {
  lot_id: string;
  lot_title: string;
  your_bid: number;
  new_bid: number;
}

export function useOutbidNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to broadcast channel for instant outbid notifications
    const channel = supabase
      .channel(`outbid-${user.id}`)
      .on("broadcast", { event: "outbid" }, (payload) => {
        const data = payload.payload as OutbidPayload;
        
        toast({
          title: "🔔 Você foi ultrapassado!",
          description: `Seu lance de ${formatCurrency(data.your_bid)} no lote "${data.lot_title}" foi superado por ${formatCurrency(data.new_bid)}.`,
          variant: "destructive",
          duration: 8000,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast, formatCurrency]);

  // Also subscribe to new notifications in the database
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-outbid-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as {
            type: string;
            title: string;
            payload: OutbidPayload;
          };

          if (notification.type === "outbid") {
            const data = notification.payload;
            toast({
              title: notification.title || "Você foi ultrapassado!",
              description: `Lance superado no lote "${data.lot_title}".`,
              variant: "destructive",
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
}
