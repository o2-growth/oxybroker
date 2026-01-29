import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserMaxBidOnLot(lotId: string) {
  const { user } = useAuth();
  const [maxBid, setMaxBid] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !lotId) {
      setMaxBid(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    supabase
      .rpc("get_user_max_bid_on_lot", { _lot_id: lotId })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching user max bid:", error);
          setMaxBid(0);
        } else {
          setMaxBid(Number(data) || 0);
        }
        setLoading(false);
      });
  }, [user, lotId]);

  const refetch = () => {
    if (!user || !lotId) return;
    
    supabase
      .rpc("get_user_max_bid_on_lot", { _lot_id: lotId })
      .then(({ data, error }) => {
        if (!error) {
          setMaxBid(Number(data) || 0);
        }
      });
  };

  return { maxBid, loading, refetch };
}
