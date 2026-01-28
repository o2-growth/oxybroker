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
  LayoutGrid,
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
  const { state } = useSidebar();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarComponent
      className={cn(
        "border-r border-border transition-all duration-300",
        collapsed ? "w-14" : "w-60"
      )}
      collapsible="icon"
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">O2</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Oxy Broker</span>
              <span className="text-xs text-muted-foreground">by O2 Inc.</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {marketplaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin() && (
          <SidebarGroup>
            <SidebarGroupLabel className={cn(collapsed && "sr-only")}>
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                        activeClassName="bg-primary/10 text-primary"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {profile && !collapsed && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium">
                {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {profile.full_name || "Usuário"}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {profile.role.replace("_", " ")}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </SidebarComponent>
  );
}
