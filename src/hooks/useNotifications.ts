import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/integrations/supabase/types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: user?.id ? queryKeys.notifications.byUser(user.id) : queryKeys.notifications.all,
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user?.id,
  });

  // Realtime subscription — invalida o cache quando chega mudanca
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byUser(user.id) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byUser(user!.id) });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async (unreadIds: string[]) => {
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.byUser(user!.id) });
    },
  });

  return {
    notifications: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    markAsRead,
    markAllAsRead,
  };
}
