import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Auth pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

// Main pages
import Marketplace from "./pages/Marketplace";
import LotDetail from "./pages/LotDetail";
import WalletPage from "./pages/Wallet";
import Transfers from "./pages/Transfers";
import Purchases from "./pages/Purchases";
import Notifications from "./pages/Notifications";

// Admin pages
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminAssets from "./pages/admin/AdminAssets";
import AdminLots from "./pages/admin/AdminLots";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to marketplace */}
            <Route path="/" element={<Navigate to="/marketplace" replace />} />
            
            {/* Auth routes */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            
            {/* Main routes */}
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/lots/:id" element={<LotDetail />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/notifications" element={<Notifications />} />
            
            {/* Admin routes */}
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/assets" element={<AdminAssets />} />
            <Route path="/admin/lots" element={<AdminLots />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
