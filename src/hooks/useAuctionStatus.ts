import { useMemo } from "react";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type Bid = Database["public"]["Tables"]["bids"]["Row"];

export type AuctionStatus = "winning" | "losing" | "no_bid";

interface AuctionStatusResult {
  status: AuctionStatus;
  myLastBid: Bid | null;
  highestBid: Bid | null;
  isWinning: boolean;
  isLosing: boolean;
  hasNoBid: boolean;
}

export function useAuctionStatus(bids: Bid[]): AuctionStatusResult {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user || bids.length === 0) {
      return {
        status: "no_bid" as AuctionStatus,
        myLastBid: null,
        highestBid: bids[0] || null,
        isWinning: false,
        isLosing: false,
        hasNoBid: true,
      };
    }

    // Highest bid is first in sorted array (sorted by amount DESC)
    const highestBid = bids[0];

    // Find user's highest bid
    const myBids = bids.filter((b) => b.user_id === user.id);
    const myLastBid = myBids.length > 0 ? myBids[0] : null;

    if (!myLastBid) {
      return {
        status: "no_bid" as AuctionStatus,
        myLastBid: null,
        highestBid,
        isWinning: false,
        isLosing: false,
        hasNoBid: true,
      };
    }

    // Check if user is winning (their bid is the highest)
    const isWinning =
      Number(myLastBid.amount) === Number(highestBid.amount) &&
      myLastBid.created_at === highestBid.created_at;

    return {
      status: isWinning ? "winning" : "losing",
      myLastBid,
      highestBid,
      isWinning,
      isLosing: !isWinning,
      hasNoBid: false,
    };
  }, [bids, user]);
}
