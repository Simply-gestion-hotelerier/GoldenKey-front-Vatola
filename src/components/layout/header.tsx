// src/components/layout/header.tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, User, Settings, LogOut, X, Menu, Trash2, CheckCheck, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth, useUserProfile } from "@/lib/rbac";
import { useState, useEffect, useRef } from "react";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Role } from "@/lib/rbac";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useSSENotifications } from "@/hooks/useSSENotifications";
import { useTranslation } from "react-i18next";
import {
  Hotel, UtensilsCrossed, Wine, Sparkles, BarChart3,
  Users, LayoutGrid, ChefHat, CalendarDays, Package as PackageIcon,
  DollarSign as DollarIcon
} from "lucide-react";

// ── Navigation avec i18n ──
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
  { name: t('nav.inventory'), href: "/inventory", icon: PackageIcon },
  { name: t('nav.dailyInvoice'), href: "/invoices/daily", icon: DollarIcon },
  { name: t('nav.cash'), href: "/cash", icon: DollarIcon },
  { name: t('nav.reports'), href: "/reports", icon: BarChart3 },
  { name: t('nav.housekeeping'), href: "/housekeeping", icon: Sparkles },
];

const ICON_COLORS: Record<string, string> = {
  "/": "text-blue-500",
  "/hotel": "text-emerald-500",
  "/reservations": "text-blue-600",
  "/hotel/plan": "text-indigo-500",
  "/rooms/manage": "text-violet-500",
  "/restaurant": "text-rose-500",
  "/restaurant/pos": "text-pink-500",
  "/restaurant/menu": "text-pink-500",
  "/restaurant/kds": "text-orange-500",
  "/spa": "text-fuchsia-500",
  "/spa/agenda": "text-purple-500",
  "/crm": "text-green-600",
  "/inventory": "text-cyan-500",
  "/invoices/daily": "text-lime-500",
  "/cash": "text-lime-500",
  "/reports": "text-teal-500",
  "/housekeeping": "text-sky-500",
  "/notifications": "text-orange-400",
  "/settings": "text-zinc-500",
};

const roleAccess: Record<Role, string[]> = {
  admin: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", "/restaurant/kds",
    "/pub", "/pub/menu", "/bar", "/bar/pos", "/spa", "/spa/agenda",
    "/crm", "/inventory", "/invoices/daily", "/invoices/client", "/cash", "/reports",
    "/housekeeping", "/notifications", "/settings", "/role-accounts", "/team"
  ],
  manager: [
    "/", "/hotel", "/reservations", "/restaurant", "/pub", "/spa",
    "/crm", "/reports", "/notifications", "/settings", "/cash",
    "/invoices/daily", "/invoices/client", "/housekeeping"
  ],
  reception: ["/", "/reservations", "/hotel/plan", "/crm", "/notifications", "/settings"],
  housekeeping: ["/", "/housekeeping", "/notifications", "/settings"],
  cuisine: ["/", "/restaurant/kds", "/notifications", "/settings"],
  serveur: ["/", "/restaurant", "/restaurant/pos", "/notifications", "/settings"],
  bar: ["/", "/pub", "/bar", "/bar/pos", "/notifications", "/settings"],
  spa: ["/", "/spa", "/spa/agenda", "/notifications", "/settings"],
  compta: ["/", "/cash", "/invoices/daily", "/reports", "/notifications", "/settings"],
};

type NotificationItem = {
  id: number;
  title: string;
  body?: string | null;
  type?: string;
  read: boolean;
  createdAt: string;
};

const EVENT_ICONS: Record<string, string> = {
  payment: "💳",
  order_created: "🍽️",
  order_closed: "✅",
  order_line_status: "🔔",
  checkin: "🏨",
  checkout: "🚪",
  low_stock: "⚠️",
  info: "ℹ️",
};

export function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const currentUser = useUserProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useSSENotifications();

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/api/notifications"),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/notifications/mark-all-read", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const removeNotification = useMutation({
    mutationFn: (id: number) => api.del(`/api/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const navigation = getNavigation(t);
  const filteredNavigation = navigation.filter((item) => {
    const role = user?.role ?? "reception";
    return roleAccess[role]?.includes(item.href);
  });

  const getInitials = (name: string) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  const timeString = currentTime.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateString = currentTime.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <header
      className="h-16 border-b border-border px-4 md:px-6 flex items-center justify-between relative"
      style={{ backgroundColor: "#1f2d69" }}
    >
      <div className="md:hidden mr-2">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-2 max-h-[80vh]">
            <div className="p-4 overflow-y-auto max-h-[72vh] pr-1">
              <div className="mb-3">
                <div className="text-sm font-semibold text-foreground">{t('nav.dashboard')}</div>
              </div>
              <ul className="grid grid-cols-1 gap-2">
                {filteredNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Button
                        aria-current={isActive ? "page" : undefined}
                        variant={isActive ? "default" : "ghost"}
                        className={cn(
                          "w-full justify-start text-base",
                          isActive && "bg-primary text-primary-foreground"
                        )}
                        onClick={() => navigate(item.href)}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span className="truncate">{item.name}</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="hidden md:flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white h-4 w-4" />
          <Input
            placeholder={t('common.search')}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/70"
          />
        </div>
      </div>

      <div className="flex flex-row justify-between items-center w-40 md:w-48 lg:w-64 mx-4">
        <div className="text-lg font-semibold text-white">{timeString}</div>
        <div className="text-sm text-white/90 capitalize hidden lg:block">{dateString}</div>
      </div>

      <div className="flex items-center space-x-4">

        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-white hover:bg-white/10"
            onClick={() => {
              setShowNotifications((v) => !v);
              setShowProfile(false);
            }}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold border-2 border-[#1f2d69]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                    {t('notifications.title')}
                  </h3>
                  {unreadCount > 0 && (
                    <span className="h-5 px-1.5 flex items-center rounded-full bg-red-100 text-red-600 text-xs font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => markAllRead.mutate()}
                      disabled={markAllRead.isPending}
                      title={t('notifications.markAllRead')}
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1" />
                      {t('notifications.markAllRead')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowNotifications(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{t('notifications.noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const icon = EVENT_ICONS[n.type ?? "info"] ?? "🔔";
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                          !n.read && "bg-blue-50/60 dark:bg-blue-900/20"
                        )}
                      >
                        <span className="text-base shrink-0 mt-0.5">{icon}</span>

                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => !n.read && markRead.mutate(n.id)}
                        >
                          <p className={cn(
                            "text-sm text-gray-800 dark:text-white leading-snug",
                            !n.read && "font-semibold"
                          )}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(n.createdAt).toLocaleString("fr-FR", {
                              day: "2-digit", month: "short",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>

                        <div className="flex flex-col items-center gap-2 shrink-0">
                          {!n.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 mt-1" />
                          )}
                          <button
                            aria-label={t('common.delete')}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            onClick={() => removeNotification.mutate(n.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <button
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    onClick={() => { setShowNotifications(false); navigate("/notifications"); }}
                  >
                    {t('notifications.viewAll')} →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 p-1"
            onClick={() => {
              setShowProfile((v) => !v);
              setShowNotifications(false);
            }}
          >
            <Avatar className="h-8 w-8 border-2 border-white/20">
              <AvatarImage src={currentUser?.avatar} alt={currentUser?.name ?? "User"} />
              <AvatarFallback className="bg-white/20 text-white text-sm">
                {getInitials(currentUser?.name ?? "User")}
              </AvatarFallback>
            </Avatar>
          </Button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={currentUser?.avatar} alt={currentUser?.name ?? "User"} />
                    <AvatarFallback className="bg-blue-500 text-white">
                      {getInitials(currentUser?.name ?? "User")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white truncate text-sm">
                      {currentUser?.name ?? t('common.loading')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {currentUser?.email ?? "user@example.com"}
                    </p>
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 capitalize font-medium">
                      {currentUser?.role ?? ""}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { setShowProfile(false); navigate("/settings"); }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {t('profile.settings')}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                  onClick={() => { logout(); setShowProfile(false); }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('profile.logout')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}