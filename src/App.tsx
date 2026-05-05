// App.tsx — logique complète avec second login intégré

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ReactNode, useState } from "react";
// Import des pages
import Index from "./pages/Index";
import Hotel from "./pages/Hotel";
import Restaurant from "./pages/Restaurant";
import Spa from "./pages/Spa";
import NotFound from "./pages/NotFound";
import HotelPlan from "./pages/HotelPlan";
import RestaurantKDS from "./pages/RestaurantKDS";
import SpaAgenda from "./pages/SpaAgenda";
import Inventory from "./pages/Inventory";
import Cash from "./pages/Cash";
import Reports from "./pages/Reports";
import RestaurantPOS from "./pages/RestaurantPOS";
import Housekeeping from "./pages/Housekeeping";
import RoomInspection from "./pages/RoomInspection";
import Settings from "./pages/Settings";
import RoomsManage from "./pages/RoomsManage";
import Team from "./pages/Team";
import Notifications from "./pages/Notifications";
import RestaurantMenu from "./pages/RestaurantMenu";
import DailyInvoice from "./pages/DailyInvoice";
import LoginPage from "./pages/LoginPage";
import Reservations from "./pages/Reservations";
import CRM from "./pages/CRM";
import GuestInvoice from "./pages/GuestInvoice";

// Providers et hooks
import { AuthProvider, Role, useAuth } from "./lib/rbac";
import { AppStateProvider } from "./state/AppState";
import { ThemeProvider } from "next-themes";
import ScrollKeeper from "./components/scroll-keeper";
import LoadingScreen from "./components/loading";

const queryClient = new QueryClient();

// === Configuration des accès par rôle ===
const roleAccess: Record<Role, string[]> = {
  admin: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", "/restaurant/kds",
    "/pub", "/pub/menu", "/bar", "/bar/pos", "/spa", "/spa/agenda",
    "/crm", "/inventory", "/invoices/daily", "/cash", "/reports",
    "/housekeeping", "/notifications", "/settings", "/team" , "/room-inspection", "/invoices/client"
  ],
  manager: [
    "/hotel", "/reservations", "/restaurant", "/pub", "/spa",
    "/crm", "/reports", "/notifications", "/settings", "/cash",
    "/invoices/daily", "/housekeeping", "/room-inspection"
  ],
  reception: [
    "/reservations", "/hotel/plan", "/crm", "/notifications", "/settings"
  ],
  housekeeping: [
    "/housekeeping", "/notifications", "/settings", "/room-inspection"
  ],
  cuisine: [
    "/restaurant/kds", "/notifications", "/settings"
  ],
  serveur: [
    "/restaurant", "/restaurant/pos", "/notifications", "/settings"
  ],
  bar: [
    "/pub", "/bar", "/bar/pos", "/notifications", "/settings"
  ],
  spa: [
    "/spa", "/spa/agenda", "/notifications", "/settings"
  ],
  compta: [
    "/cash", "/invoices/daily", "/reports", "/notifications", "/settings"
  ]
};

// === Routes protégées AVEC second login ===
interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth() as any;
  const location = useLocation();
  const currentPath = location.pathname;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: currentPath }} />;
  }

  const userRole = user?.role || 'guest';
  const allowedPaths = roleAccess[userRole] || [];

  // 🎯 Sur "/" → rediriger vers le premier accès autorisé du rôle
  if (currentPath === "/") {
    const firstAllowed = allowedPaths[0];
    if (firstAllowed && firstAllowed !== "/") {
      return <Navigate to={firstAllowed} replace />;
    }
  }

  const hasAccess = allowedPaths.some((allowedPath) => {
    return currentPath === allowedPath || currentPath.startsWith(allowedPath + '/');
  });

  if (!hasAccess) {
    const firstAllowed = allowedPaths[0] || "/";
    return <Navigate to={firstAllowed} replace />;
  }

  return <>{children}</>;
};

// === Routes publiques ===
const PublicRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as any)?.from || "/";
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};

// === Layout principal ===
const AuthenticatedLayout = ({ children }: ProtectedRouteProps) => {
  const { operator } = useAuth() as any;

  return (
    <>
      <ScrollKeeper />

      {/* 🔥 Affichage opérateur */}
      {operator && (
        <div className="fixed top-2 right-4 text-xs bg-black/70 text-white px-3 py-1 rounded">
          👤 {operator.displayName || operator.userName}
        </div>
      )}

      {children}

      <div className="md:fixed md:left-64 md:right-0 md:bottom-0 h-10 w-full bg-card border-t border-border px-4 flex items-center justify-center text-sm">
        <div>Copyright © {new Date().getFullYear()}</div>
      </div>
    </>
  );
};

// === Routes internes ===
const AuthenticatedRoutes = () => (
  <AuthenticatedLayout>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/hotel" element={<Hotel />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="/hotel/plan" element={<HotelPlan />} />
      <Route path="/rooms/manage" element={<RoomsManage />} />
      <Route path="/restaurant" element={<Restaurant />} />
      <Route path="/restaurant/kds" element={<RestaurantKDS />} />
      <Route path="/restaurant/pos" element={<RestaurantPOS />} />
      <Route path="/restaurant/menu" element={<RestaurantMenu />} />
      <Route path="/spa" element={<Spa />} />
      <Route path="/spa/agenda" element={<SpaAgenda />} />
      <Route path="/crm" element={<CRM />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/invoices/client" element={<GuestInvoice />} />
      <Route path="/invoices/daily" element={<DailyInvoice />} />
      <Route path="/cash" element={<Cash />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/housekeeping" element={<Housekeeping />} />
      <Route path="/room-inspection" element={<RoomInspection />} />
      <Route path="/team" element={<Team />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthenticatedLayout>
);

// === APP PRINCIPALE ===
const App = () => {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <LoadingScreen onLoaded={() => setLoading(false)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <AppStateProvider>
              <BrowserRouter>
                <Routes>

                  {/* PUBLIC */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />

                  {/* PROTECTED */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AuthenticatedRoutes />
                      </ProtectedRoute>
                    }
                  />

                </Routes>
              </BrowserRouter>
            </AppStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;