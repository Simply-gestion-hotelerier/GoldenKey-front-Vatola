// src/components/layout/sidebar.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Hotel, UtensilsCrossed, Wine, Sparkles, BarChart3, Settings, Bell,
  Users, LayoutGrid, ChefHat, CalendarDays, Package as PackageIcon,
  DollarSign as DollarIcon, LogOut
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, Role } from "@/lib/rbac";
import { useTranslation } from "react-i18next";

export const getNavigation = (t: (key: string) => string) => [
  { name: t('nav.dashboard'), href: "/", icon: BarChart3 },
  { name: t('nav.hotel'), href: "/hotel", icon: Hotel },
  { name: t('nav.reservations'), href: "/reservations", icon: CalendarDays },
  { name: t('nav.roomPlan'), href: "/hotel/plan", icon: LayoutGrid },
  { name: t('nav.roomManagement'), href: "/rooms/manage", icon: LayoutGrid },
  { name: t('nav.restaurant'), href: "/restaurant", icon: UtensilsCrossed },
  { name: "POS Restaurant", href: "/restaurant/pos", icon: UtensilsCrossed },
  { name: t('nav.menu'), href: "/restaurant/menu", icon: UtensilsCrossed },
  { name: t('nav.kds'), href: "/restaurant/kds", icon: ChefHat },
  { name: t('nav.spa'), href: "/spa", icon: Sparkles },
  { name: t('nav.spaAgenda'), href: "/spa/agenda", icon: CalendarDays },
  { name: t('nav.crm'), href: "/crm", icon: Users },
  { name: t('nav.team'), href: "/team", icon: Users },
  { name: t('nav.inventory'), href: "/inventory", icon: PackageIcon },
  { name: t('nav.clientInvoice'), href: "/invoices/client", icon: DollarIcon },
  { name: t('nav.dailyInvoice'), href: "/invoices/daily", icon: DollarIcon },
  { name: t('nav.cash'), href: "/cash", icon: DollarIcon },
  { name: t('nav.reports'), href: "/reports", icon: BarChart3 },
  { name: t('nav.housekeeping'), href: "/housekeeping", icon: Sparkles },
];

const ICON_COLORS: Record<string, string> = {
  "/": "text-blue-500", "/hotel": "text-emerald-500", "/reservations": "text-blue-600",
  "/hotel/plan": "text-indigo-500", "/rooms/manage": "text-violet-500",
  "/restaurant": "text-rose-500", "/restaurant/pos": "text-pink-500",
  "/restaurant/menu": "text-pink-500", "/restaurant/kds": "text-orange-500",
  "/pub": "text-amber-500", "/pub/menu": "text-amber-500",
  "/bar": "text-yellow-500", "/bar/pos": "text-yellow-500",
  "/spa": "text-fuchsia-500", "/spa/agenda": "text-purple-500",
  "/crm": "text-green-600", "/inventory": "text-cyan-500",
  "/invoices/client": "text-lime-500", 
  "/invoices/daily": "text-lime-500", "/cash": "text-lime-500",
  "/reports": "text-teal-500", "/housekeeping": "text-sky-500",
  "/notifications": "text-orange-400", "/settings": "text-zinc-500",
};

const roleAccess: Record<Role, string[]> = {
  admin: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", "/restaurant/kds",
    "/pub", "/pub/menu", "/bar", "/bar/pos", "/spa", "/spa/agenda",
    "/crm", "/inventory", "/invoices/daily", "/cash", "/reports",
    "/housekeeping", "/notifications", "/settings", "/team"
  ],
  manager: [
    "/hotel", "/reservations", "/restaurant", "/pub", "/spa",
    "/crm", "/reports", "/notifications", "/settings", "/cash",
    "/invoices/daily", "/housekeeping"
  ],
  reception: [
    "/reservations", "/hotel/plan", "/crm", "/notifications", "/settings"
  ],
  housekeeping: [
    "/housekeeping", "/notifications", "/settings"
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

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const navigation = getNavigation(t);
  const filteredNavigation = navigation.filter((item) => {
    const currentRole = user?.role || 'reception';
    const hasAccess = roleAccess[currentRole]?.includes(item.href);
    return hasAccess;
  });

  return (
    <div className="hidden md:flex min-h-screen w-64 flex-col bg-background border-r">
      <div className="h-16 border-b flex items-center">
        <div className="flex items-center gap-3 pl-4 group w-full">
          <img 
            src="/logo_s.png" 
            alt="Simply Hotel Logo" 
            className="h-12 w-12 object-contain rounded-lg transition-transform group-hover:scale-110"
          />
          <div className="flex items-center justify-between w-full pr-4">
            <h1 className="text-lg font-bold text-foreground">Simply</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {filteredNavigation.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>{t('common.noData')}</p>
            <p className="text-sm">{t('common.info')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredNavigation.map(item => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start px-3 flex items-center gap-3 transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                    )}
                    onClick={() => navigate(item.href)}
                  >
                    <item.icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        ICON_COLORS[item.href] ?? "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="mt-auto p-4 border-t space-y-2">
        <Button          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => navigate("/notifications")}
        >
          <Bell className="mr-3 h-5 w-5" />
          {t('nav.notifications')}
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => navigate("/settings")}
        >
          <Settings className="mr-3 h-5 w-5" />
          {t('nav.settings')}
        </Button>
      </div>
    </div>
  );
}