import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-r border-border">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">O2</span>
            </div>
            <SheetTitle className="flex flex-col items-start gap-0">
              <span className="font-semibold text-sm">Oxy Broker</span>
              <span className="text-xs text-muted-foreground font-normal">by O2 Inc.</span>
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-73px)]">
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
                Navegação
              </p>
              <div className="space-y-1">
                {marketplaceItems.map((item) => (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    onClick={handleNavClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                      "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-sm">{item.title}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {isAdmin() && (
              <div>
                <Separator className="mb-4" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-2">
                  Administração
                </p>
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      onClick={handleNavClick}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200",
                        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.title}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            {profile && (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
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
              onClick={() => {
                signOut();
                onOpenChange(false);
              }}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
