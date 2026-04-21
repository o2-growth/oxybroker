import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCheck,
  Gavel,
  Wallet,
  Package,
  AlertTriangle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useNotifications } from "@/hooks/useNotifications";
import type { Database } from "@/integrations/supabase/types";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationPayload = Record<string, unknown>;

const typeConfig: Record<
  string,
  { icon: LucideIcon; className: string }
> = {
  outbid: { icon: Gavel, className: "bg-oxy-warning/10 text-oxy-warning" },
  bid_outbid: { icon: Gavel, className: "bg-oxy-warning/10 text-oxy-warning" },
  auction_won: { icon: Gavel, className: "bg-oxy-success/10 text-oxy-success" },
  bid_won: { icon: Gavel, className: "bg-oxy-success/10 text-oxy-success" },
  ended: { icon: Gavel, className: "bg-muted text-muted-foreground" },
  auction_ended: { icon: Gavel, className: "bg-muted text-muted-foreground" },
  wallet_topup: { icon: Wallet, className: "bg-oxy-success/10 text-oxy-success" },
  payment_failed: { icon: AlertTriangle, className: "bg-oxy-danger/10 text-oxy-danger" },
  auction_payment_failed: { icon: AlertTriangle, className: "bg-oxy-danger/10 text-oxy-danger" },
  return_requested: { icon: RotateCcw, className: "bg-amber-500/10 text-amber-500" },
  return_rejected: { icon: RotateCcw, className: "bg-oxy-danger/10 text-oxy-danger" },
  purchase: { icon: Package, className: "bg-primary/10 text-primary" },
  default: { icon: Bell, className: "bg-muted text-muted-foreground" },
};

function getNotificationFallbackMessage(payload: Notification["payload"]): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const data = payload as NotificationPayload;
  const message = data.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const lotTitle = data.lot_title;
  if (typeof lotTitle === "string" && lotTitle.trim()) {
    return lotTitle;
  }

  return null;
}

export default function Notifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const { trackAction } = useAnalytics();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error(error);
      } else {
        setNotifications(data || []);
      }
      setLoading(false);
    };

    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (id: string) => {
    trackAction("mark_read", undefined, "notification", id);
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  };

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    trackAction("mark_all_read", { count: unreadIds.length });
    markAllAsRead.mutate(unreadIds);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 60000) return "Agora";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return d.toLocaleDateString("pt-BR");
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notificações
            </h1>
            <p className="text-muted-foreground mt-1">
              {unreadCount > 0
                ? `${unreadCount} não lidas`
                : "Todas as notificações lidas"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">
              Nenhuma notificação
            </h3>
            <p className="text-muted-foreground">
              Você receberá notificações sobre seus lances e compras aqui
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const config =
                typeConfig[notification.type] || typeConfig.default;
              const Icon = config.icon;
              const isRead = !!notification.read_at;

              return (
                <div
                  key={notification.id}
                  className={`oxy-card p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !isRead ? "border-l-2 border-l-primary" : ""
                  }`}
                  onClick={() => handleMarkAsRead(notification)}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.className}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        !isRead ? "font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {notification.title ||
                        getNotificationFallbackMessage(notification.payload) ||
                        "Nova notificação"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(notification.created_at)}
                    </p>
                  </div>
                  {!isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
