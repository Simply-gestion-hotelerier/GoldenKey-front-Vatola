// lib/role.ts
export type Role = 'admin' | 'manager' | 'reception' | 'housekeeping' | 'serveur' | 'cuisine' | 'bar' | 'spa' | 'compta';

export const roleAccess: Record<Role, string[]> = {
  admin: [
    "/", "/hotel", "/reservations", "/hotel/plan", "/rooms/manage",
    "/restaurant", "/restaurant/pos", "/restaurant/menu", "/restaurant/kds",
    "/pub", "/pub/menu", "/bar", "/bar/pos", "/spa", "/spa/agenda",
    "/crm", "/inventory" ,"/invoices/daily", "/invoices/client", "/cash", "/reports", 
    "/housekeeping", "/notifications", "/settings", "/team"
  ],
  reception: [
  "/reservations", "/hotel/plan", "/crm", "/notifications"
  ],
  housekeeping: [
     "/housekeeping", "/notifications"
  ],
  cuisine: [
     "/restaurant/kds", "/notifications"
  ],
  serveur: [
    "/restaurant", "/restaurant/pos", "/notifications"
  ],
  bar: [
     "/pub", "/bar", "/bar/pos", "/notifications"
  ],
  compta: [
    "/cash", "/invoices/daily", "/notifications"
  ],
  spa: [
  "/spa", "/spa/agenda", "/notifications"
  ],
  manager: [
    "/hotel", "/reservations", "/restaurant", "/pub", "/spa",
    "/crm", "/reports", "/notifications", "/settings"
  ]
};

// Hook simplifié pour la sidebar
export const useAuth = () => {
  // Cette version simplifiée est pour la sidebar seulement
  // Elle utilise le contexte d'authentification principal
  const auth = useAuth(); // depuis votre RBAC principal
  
  return {
    role: auth.user?.role || 'manager',
    logout: auth.logout
  };
};