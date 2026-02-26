import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
type Transaction = Database["public"]["Tables"]["wallet_transactions"]["Row"];

interface WalletData {
  wallet: Wallet;
  transactions: Transaction[];
  canWithdraw: boolean;
}

async function fetchWalletData(userId: string): Promise<WalletData> {
  const [walletResult, txResult, profileResult] = await Promise.all([
    supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("can_withdraw")
      .eq("id", userId)
      .single(),
  ]);

  if (walletResult.error) throw walletResult.error;
  if (txResult.error) throw txResult.error;
  if (profileResult.error) throw profileResult.error;

  return {
    wallet: walletResult.data,
    transactions: txResult.data ?? [],
    canWithdraw: profileResult.data?.can_withdraw ?? false,
  };
}

export function useWallet() {
  const { user } = useAuth();

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: user
      ? queryKeys.wallet.balance(user.id)
      : (["wallet", "balance", ""] as const),
    queryFn: () => fetchWalletData(user!.id),
    enabled: Boolean(user),
  });

  const error = queryError ? (queryError as Error).message : null;

  return {
    wallet: data?.wallet ?? null,
    transactions: data?.transactions ?? [],
    canWithdraw: data?.canWithdraw ?? false,
    loading,
    error,
    refetch,
  };
}
