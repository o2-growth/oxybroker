import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserHasBidOnLot(lotId: string | undefined) {
  const [hasBid, setHasBid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!lotId) {
      setHasBid(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    supabase
      .rpc("user_has_bid_on_lot", { _lot_id: lotId })
      .then(({ data, error }) => {
        if (error) {
          console.error("Error checking user bid:", error);
          setHasBid(null);
        } else {
          setHasBid(!!data);
        }
        setIsLoading(false);
      });
  }, [lotId]);

  return { hasBid, isLoading };
}
