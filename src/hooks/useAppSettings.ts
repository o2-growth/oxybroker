import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

export interface BracketMultipliers {
  "200k_350k": number;
  "350k_500k": number;
  "500k_1m": number;
  "1m_5m": number;
  "5m_plus": number;
}

export interface AppSettings {
  id: string;
  return_window_hours: number;
  bidding_extension_seconds: number;
  scoring_weights: Record<string, number>;
  // Sprint 4
  mql_base_value: number;
  bracket_multipliers: BracketMultipliers;
  buy_now_premium_multiplier: number;
  sla_minutes: number;
  max_sniping_extensions: number;
}

async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("*").single();

  if (error) throw error;
  const row = data as Record<string, unknown>;

  return {
    id: row.id as string,
    return_window_hours: (row.return_window_hours as number) ?? 72,
    bidding_extension_seconds: (row.bidding_extension_seconds as number) ?? 10,
    scoring_weights: (row.scoring_weights as Record<string, number>) || {},
    mql_base_value: Number(row.mql_base_value ?? 718),
    bracket_multipliers:
      (row.bracket_multipliers as BracketMultipliers) ?? ({
        "200k_350k": 0.7,
        "350k_500k": 1.0,
        "500k_1m": 1.3,
        "1m_5m": 1.5,
        "5m_plus": 1.8,
      } as BracketMultipliers),
    buy_now_premium_multiplier: Number(row.buy_now_premium_multiplier ?? 1.8),
    sla_minutes: (row.sla_minutes as number) ?? 10,
    max_sniping_extensions: (row.max_sniping_extensions as number) ?? 10,
  };
}

async function saveAppSettings(settings: AppSettings): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({
      return_window_hours: settings.return_window_hours,
      bidding_extension_seconds: settings.bidding_extension_seconds,
      scoring_weights: settings.scoring_weights,
      mql_base_value: settings.mql_base_value,
      bracket_multipliers: settings.bracket_multipliers,
      buy_now_premium_multiplier: settings.buy_now_premium_multiplier,
      sla_minutes: settings.sla_minutes,
      max_sniping_extensions: settings.max_sniping_extensions,
    } as never)
    .eq("id", settings.id);

  if (error) throw error;
}

export function useAppSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.appSettings.all,
    queryFn: fetchAppSettings,
  });

  const save = useMutation({
    mutationFn: saveAppSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appSettings.all });
      toast.success("Configurações salvas", {
        description: "As alterações foram aplicadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro", { description: error.message });
    },
  });

  return {
    settings: query.data ?? null,
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    saving: save.isPending,
    save: save.mutate,
  };
}
