// sidebarPermissions.ts
export const roleRoutes: Record<string, string[]> = {
  ADMIN: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", "/restaurant/kds",
    "/pub", "/pub/menu", "/bar", "/bar/pos",
    "/spa", "/spa/agenda",
    "/crm", "/inventory", "/invoices/daily", "/invoices/client", "/cash", "/reports", "/housekeeping",
    "/notifications", "/settings"
  ],
  MANAGER: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/menu", "/pub", "/bar", "/spa", "/spa/agenda",
    "/crm", "/inventory", "/invoices/daily", "/invoices/client", "/cash", "/reports",
    "/notifications"
  ],
  RECEPTION: ["/", "/reservations", "/hotel/plan", "/rooms/manage", "/crm", "/notifications"],
  HOUSEKEEPING: ["/housekeeping", "/hotel/plan", "/notifications"],
  KITCHEN: ["/restaurant/kds", "/restaurant/menu", "/notifications"],
  WAITER: ["/restaurant/pos", "/restaurant/menu", "/notifications"],
  BARTENDER: ["/bar/pos", "/bar", "/notifications"],
  CASHIER: ["/cash", "/invoices/daily", "/invoices/client", "/notifications"],
  GUEST: ["/"] // accès minimal, juste le dashboard
};
