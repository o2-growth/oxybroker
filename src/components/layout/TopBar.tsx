import { Moon, Sun, Bell, Menu, Wallet } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { MobileDrawer } from "./MobileDrawer";
import { useWallet } from "@/hooks/useWallet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";

function BalanceBadge() {
  const { wallet, loading } = useWallet();

  if (loading) {
    return <Skeleton className="h-8 w-20 rounded-full" />;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Link
          to="/wallet"
          className="flex items-center gap-1.5 bg-muted/50 hover:bg-muted rounded-full px-3 py-1.5 transition-colors"
          aria-label="Ver carteira"
        >
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-sm font-mono font-medium">
            {wallet ? formatCurrency(wallet.balance) : "---"}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="bg-popover border-border">
        Ver carteira
      </TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel("notifications-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">O2</span>
            </div>
            <span className="font-semibold text-sm">Oxy Broker</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Balance Badge */}
          {user && <BalanceBadge />}

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Link to="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="bg-popover border-border">
              Notificações
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-popover border-border">
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <MobileDrawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen} />
    </>
  );
}
