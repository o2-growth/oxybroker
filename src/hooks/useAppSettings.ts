import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

export interface AppSettings {
  id: string;
  return_window_hours: number;
  bidding_extension_seconds: number;
  scoring_weights: Record<string, number>;
}

async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    return_window_hours: data.return_window_hours,
    bidding_extension_seconds: data.bidding_extension_seconds,
    scoring_weights: (data.scoring_weights as Record<string, number>) || {},
  };
}

async function saveAppSettings(settings: AppSettings): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({
      return_window_hours: settings.return_window_hours,
      bidding_extension_seconds: settings.bidding_extension_seconds,
      scoring_weights: settings.scoring_weights,
    })
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
    loading: query.isLoading,
    error: query.error,
    saving: save.isPending,
    save: save.mutate,
  };
}
