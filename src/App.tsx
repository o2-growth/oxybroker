import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OutbidNotificationProvider } from "@/components/providers/OutbidNotificationProvider";
import { ProtectedRoute } from "@/components/routes/ProtectedRoute";
import { AdminRoute } from "@/components/routes/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
import AdminLeadsInbox from "./pages/admin/AdminLeadsInbox";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <OutbidNotificationProvider>
              <ErrorBoundary>
              <Routes>
                {/* Redirect root to marketplace */}
                <Route path="/" element={<Navigate to="/marketplace" replace />} />

                {/* Auth routes — publicas */}
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/signup" element={<Signup />} />

                {/* Main routes — requerem autenticacao */}
                <Route
                  path="/marketplace"
                  element={
                    <ProtectedRoute>
                      <Marketplace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lots/:id"
                  element={
                    <ProtectedRoute>
                      <LotDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-auctions"
                  element={
                    <ProtectedRoute>
                      <MyAuctions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wallet"
                  element={
                    <ProtectedRoute>
                      <WalletPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transfers"
                  element={
                    <ProtectedRoute>
                      <Transfers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchases"
                  element={
                    <ProtectedRoute>
                      <Purchases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />

                {/* Admin routes — requerem role 'admin' */}
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <AdminSettings />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AdminUsers />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/categories"
                  element={
                    <AdminRoute>
                      <AdminCategories />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/assets"
                  element={
                    <AdminRoute>
                      <AdminAssets />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/lots"
                  element={
                    <AdminRoute>
                      <AdminLots />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <AdminRoute>
                      <AdminAnalytics />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/promotions"
                  element={
                    <AdminRoute>
                      <AdminPromotions />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/leads-inbox"
                  element={
                    <AdminRoute>
                      <AdminLeadsInbox />
                    </AdminRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
            </OutbidNotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
