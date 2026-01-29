import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OutbidNotificationProvider } from "@/components/providers/OutbidNotificationProvider";

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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <OutbidNotificationProvider>
            <Routes>
              {/* Redirect root to marketplace */}
              <Route path="/" element={<Navigate to="/marketplace" replace />} />
              
              {/* Auth routes */}
              <Route path="/auth/login" element={<Login />} />
              <Route path="/auth/signup" element={<Signup />} />
              
              {/* Main routes */}
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/lots/:id" element={<LotDetail />} />
              <Route path="/my-auctions" element={<MyAuctions />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/notifications" element={<Notifications />} />
              
              {/* Admin routes */}
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/assets" element={<AdminAssets />} />
              <Route path="/admin/lots" element={<AdminLots />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/promotions" element={<AdminPromotions />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </OutbidNotificationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
