import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Wallet = Database["public"]["Tables"]["wallets"]["Row"];
type Transaction = Database["public"]["Tables"]["wallet_transactions"]["Row"];

interface WalletData {
  wallet: Wallet | null;
  transactions: Transaction[];
  canWithdraw: boolean;
}

async function fetchWalletData(userId: string): Promise<WalletData> {
  console.log("[OXY:Wallet] fetching data for", userId);
  const [walletResult, txResult, profileResult] = await Promise.all([
    supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
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
      .maybeSingle(),
  ]);

  if (walletResult.error) { console.error("[OXY:Wallet] wallet error:", walletResult.error.message); throw walletResult.error; }
  if (txResult.error) { console.error("[OXY:Wallet] tx error:", txResult.error.message); throw txResult.error; }
  if (profileResult.error) { console.error("[OXY:Wallet] profile error:", profileResult.error.message); throw profileResult.error; }

  console.log("[OXY:Wallet] loaded — balance:", walletResult.data?.balance, "txs:", txResult.data?.length);

  return {
    wallet: walletResult.data,
    transactions: txResult.data ?? [],
    canWithdraw: profileResult.data?.can_withdraw ?? false,
  };
}

export function useWallet() {
  const { user } = useAuth();
  const userId = user?.id;
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

  const error = queryError ? (queryError as Error).message : null;

    try {
      const { data: walletData, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletError) throw walletError;
      setWallet(walletData);

      const { data: txData, error: txError } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txError) throw txError;
      setTransactions(txData || []);

      // Fetch can_withdraw from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("can_withdraw")
        .eq("id", userId)
        .maybeSingle();

      setCanWithdraw(profileData?.can_withdraw ?? false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return { wallet, transactions, canWithdraw, loading, error, refetch: fetchWallet };
}
