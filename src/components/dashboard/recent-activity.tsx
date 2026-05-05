import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, UtensilsCrossed, Package, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/rbac";

const statusStyles = {
  success: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  warning: "bg-destructive/10 text-destructive border-destructive/20",
} as const;

type Activity = {
  id: string; icon: any; title: string;
  description: string; time: string;
  status: keyof typeof statusStyles; ts: number;
};

const relTime = (d: Date) => {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return `Il y a ${diff}s`;
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("fr-FR");
};

export function RecentActivity() {
  const { user, hasScopes } = useAuth();

  const canReadReservations = hasScopes("reservations:read");
  const canReadOrders       = hasScopes("orders:read");
  const canReadSpa          = hasScopes("spa:read");
  const canReadInventory    = hasScopes("inventory:read");

  const today     = new Date();
  const ymd       = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const { data: reservations = [] } = useQuery({
    queryKey: ["hotel", "reservations", ymd],
    queryFn: () => api.get<any[]>(`/hotel/reservations?date=${ymd}`),
    enabled: canReadReservations,                          // ✅
    refetchInterval: canReadReservations ? 10000 : false,
    staleTime: 5000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["restaurant", "orders", "open"],
    queryFn: () => api.get<any[]>(`/restaurant/orders?status=open`),
    enabled: canReadOrders,                                // ✅
    refetchInterval: canReadOrders ? 10000 : false,
    staleTime: 5000,
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["spa", "appointments", ymd],
    queryFn: () => api.get<any[]>(`/spa/appointments?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`),
    enabled: canReadSpa,                                   // ✅
    refetchInterval: canReadSpa ? 15000 : false,
    staleTime: 7000,
  });

  const { data: moves = [] } = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: () => api.get<any[]>(`/inventory/movements?limit=20`),
    enabled: canReadInventory,                             // ✅
    refetchInterval: canReadInventory ? 20000 : false,
    staleTime: 10000,
  });

  const activities: Activity[] = [
    ...reservations.map((r: any) => ({
      id: `res-${r.id}`, icon: User,
      title: r.status === "checked_in" ? "Arrivée Client" : "Réservation",
      description: `${r.guest?.fullName ?? "Client"} — Ch ${r.room?.number ?? ""}`,
      time: relTime(new Date(r.createdAt ?? r.checkIn)),
      status: r.status === "checked_in" ? ("success" as const) : ("pending" as const),
      ts: new Date(r.createdAt ?? r.checkIn).getTime(),
    })),
    ...orders.map((o: any) => ({
      id: `ord-${o.id}`, icon: UtensilsCrossed,
      title: "Nouvelle Commande",
      description: `${o.table?.code ? `Table ${o.table.code}` : "Commande"} — ${o.lines?.length ?? 0} article(s)`,
      time: relTime(new Date(o.openedAt)),
      status: "pending" as const,
      ts: new Date(o.openedAt).getTime(),
    })),
    ...apps.map((a: any) => ({
      id: `spa-${a.id}`, icon: CheckCircle,
      title: a.status === "completed" ? "Prestation Terminée" : "RDV Spa",
      description: `${a.serviceName} — ${a.clientName}`,
      time: relTime(new Date(a.createdAt ?? a.start)),
      status: a.status === "completed" ? ("success" as const) : ("pending" as const),
      ts: new Date(a.createdAt ?? a.start).getTime(),
    })),
    ...moves.map((m: any) => ({
      id: `mv-${m.id}`, icon: Package,
      title: `Stock ${m.type}`,
      description: `${m.item?.name ?? "Article"} — ${m.qty} ${m.type}`,
      time: relTime(new Date(m.createdAt)),
      status: "warning" as const,
      ts: new Date(m.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Activité Récente</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune activité disponible
          </p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex-shrink-0">
                <activity.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-foreground">{activity.title}</p>
                  <Badge variant="outline" className={statusStyles[activity.status]}>
                    {activity.status === "success" ? "✓" : activity.status === "pending" ? "..." : "!"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}