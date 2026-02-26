import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Tables } from "@/integrations/supabase/types";

type Lot = Tables<"lots">;
type Bid = Tables<"bids">;

export interface MyAuctionItem {
  lot: Lot;
  myHighestBid: number;
  lotHighestBid: number;
  status: "winning" | "losing";
  isActive: boolean;
}

export function useMyAuctions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.myAuctions.all, user?.id],
    queryFn: async (): Promise<MyAuctionItem[]> => {
      if (!user?.id) return [];

      // 1. Get all bids from the user
      const { data: userBids, error: bidsError } = await supabase
        .from("bids")
        .select("lot_id, amount")
        .eq("user_id", user.id)
        .order("amount", { ascending: false });

      if (bidsError) throw bidsError;
      if (!userBids || userBids.length === 0) return [];

      // 2. Get unique lot IDs and user's highest bid per lot
      const lotBidsMap = new Map<string, number>();
      userBids.forEach((bid) => {
        if (!lotBidsMap.has(bid.lot_id) || lotBidsMap.get(bid.lot_id)! < bid.amount) {
          lotBidsMap.set(bid.lot_id, bid.amount);
        }
      });

      const lotIds = Array.from(lotBidsMap.keys());

      // 3. Fetch lot details
      const { data: lots, error: lotsError } = await supabase
        .from("lots")
        .select("*")
        .in("id", lotIds);

      if (lotsError) throw lotsError;
      if (!lots) return [];

      // 4. Fetch highest bid for each lot
      const { data: allBids, error: allBidsError } = await supabase
        .from("bids")
        .select("lot_id, amount")
        .in("lot_id", lotIds)
        .order("amount", { ascending: false });

      if (allBidsError) throw allBidsError;

      // Get highest bid per lot
      const highestBidMap = new Map<string, number>();
      allBids?.forEach((bid) => {
        if (!highestBidMap.has(bid.lot_id)) {
          highestBidMap.set(bid.lot_id, bid.amount);
        }
      });

      // 5. Build result
      const result: MyAuctionItem[] = lots.map((lot) => {
        const myHighestBid = lotBidsMap.get(lot.id) || 0;
        const lotHighestBid = highestBidMap.get(lot.id) || 0;
        const isActive = lot.status === "live";
        const status: "winning" | "losing" = myHighestBid >= lotHighestBid ? "winning" : "losing";

        return {
          lot,
          myHighestBid,
          lotHighestBid,
          status,
          isActive,
        };
      });

      // Sort: active first, then by end date
      result.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.lot.ends_at && b.lot.ends_at) {
          return new Date(a.lot.ends_at).getTime() - new Date(b.lot.ends_at).getTime();
        }
        return 0;
      });

      return result;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
