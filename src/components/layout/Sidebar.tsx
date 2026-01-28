import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Wallet,
  ArrowLeftRight,
  ShoppingBag,
  Bell,
  Settings,
  FolderTree,
  Package,
  Layers,
  LogOut,
  Gavel,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const marketplaceItems = [
  { title: "Marketplace", url: "/marketplace", icon: Gavel },
  { title: "Carteira", url: "/wallet", icon: Wallet },
  { title: "Transferências", url: "/transfers", icon: ArrowLeftRight },
  { title: "Compras", url: "/purchases", icon: ShoppingBag },
  { title: "Notificações", url: "/notifications", icon: Bell },
];

const adminItems = [
  { title: "Configurações", url: "/admin/settings", icon: Settings },
  { title: "Categorias", url: "/admin/categories", icon: FolderTree },
  { title: "Ativos", url: "/admin/assets", icon: Package },
  { title: "Lotes", url: "/admin/lots", icon: Layers },
];

export function Sidebar() {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ item, collapsed }: { item: typeof marketplaceItems[0]; collapsed: boolean }) => {
    const content = (
      <NavLink
        to={item.url}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-2"
        )}
        activeClassName="bg-primary/10 text-primary font-medium"
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="text-sm">{item.title}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <SidebarComponent
      className={cn(
        "border-r border-border bg-sidebar transition-all duration-300 hidden md:flex",
        collapsed ? "w-[60px]" : "w-60"
      )}
      collapsible="icon"
    >
      <SidebarHeader className={cn("p-3", collapsed && "px-2")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">O2</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">Oxy Broker</span>
              <span className="text-xs text-muted-foreground">by O2 Inc.</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 flex-1 overflow-y-auto oxy-scrollbar">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-1">
              Navegação
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {marketplaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavItem item={item} collapsed={collapsed} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin() && (
          <SidebarGroup className="mt-4">
            {!collapsed && (
              <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-1">
                Administração
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavItem item={item} collapsed={collapsed} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={cn("p-3 border-t border-border", collapsed && "px-2")}>
        {profile && !collapsed && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-medium">
                {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">
                {profile.full_name || "Usuário"}
              </span>
              <span className="text-xs text-muted-foreground capitalize truncate">
                {profile.role.replace("_", " ")}
              </span>
            </div>
          </div>
        )}

        <div className={cn("flex", collapsed ? "flex-col gap-1" : "items-center justify-between gap-2")}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className={cn(
                  "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
                  "hover:bg-muted rounded-md transition-all duration-200 p-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed && "justify-center w-full"
                )}
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span>Sair</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-popover border-border">
                Sair
              </TooltipContent>
            )}
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 shrink-0"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border">
              {collapsed ? "Expandir" : "Recolher"}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </SidebarComponent>
  );
}
