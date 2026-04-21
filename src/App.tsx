import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OutbidNotificationProvider } from "@/components/providers/OutbidNotificationProvider";
import { useAuth } from "@/hooks/useAuth";

// Auth pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

// Main pages
import Marketplace from "./pages/Marketplace";
import LotDetail from "./pages/LotDetail";
import MyAuctions from "./pages/MyAuctions";
import WalletPage from "./pages/Wallet";
import Transfers from "./pages/Transfers";
import Purchases from "./pages/Purchases";
import Notifications from "./pages/Notifications";

// Admin pages
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminAssets from "./pages/admin/AdminAssets";
import AdminLots from "./pages/admin/AdminLots";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminPromotions from "./pages/admin/AdminPromotions";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Carregando...
    </div>
  );
}

function ProtectedRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <RouteLoadingScreen />;
  }

  if (!user || profile?.suspended_at) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
}

function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteLoadingScreen />;
  }

  if (user) {
    return <Navigate to="/marketplace" replace />;
  }

  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <OutbidNotificationProvider>
              <Routes>
                <Route element={<GuestRoute />}>
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/signup" element={<Signup />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Navigate to="/marketplace" replace />} />

                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/lots/:id" element={<LotDetail />} />
                  <Route path="/my-auctions" element={<MyAuctions />} />
                  <Route path="/wallet" element={<WalletPage />} />
                  <Route path="/transfers" element={<Transfers />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/notifications" element={<Notifications />} />

                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/categories" element={<AdminCategories />} />
                  <Route path="/admin/assets" element={<AdminAssets />} />
                  <Route path="/admin/lots" element={<AdminLots />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/promotions" element={<AdminPromotions />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </OutbidNotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
