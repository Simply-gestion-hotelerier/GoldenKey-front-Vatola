// src/pages/restaurant/RestaurantKDS.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/rbac";
import { api } from "@/lib/api";
import { ChefHat, Clock, Utensils, MessageSquare } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function RestaurantKDS() {
  const { hasScope } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "restaurant", "open"],
    queryFn: () => api.get<any[]>(`/restaurant/orders?dept=restaurant&status=open`),
    refetchInterval: 3000,
  });

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      commanded: "bg-warning/10 text-warning border-warning/20",
      preparing: "bg-primary/10 text-primary border-primary/20",
      delivered: "bg-success/10 text-success border-success/20",
      ready: "bg-primary/10 text-primary border-primary/20",
    };
    const labels: Record<string, string> = {
      commanded: t('restaurant.kds.commanded'),
      preparing: t('restaurant.kds.preparing'),
      delivered: t('restaurant.kds.delivered'),
      ready: t('restaurant.kds.ready'),
    };
    return (
      <Badge variant="outline" className={styles[s]}> {labels[s]} </Badge>
    );
  };

  const setLineStatus = useMutation({
    mutationFn: (p: { orderId: number; lineId: number; status: string }) => 
      api.patch(`/restaurant/orders/${p.orderId}/lines/${p.lineId}/status`, { status: p.status }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["orders", "restaurant", "open"] }); 
      toast({ title: t('restaurant.kds.title'), description: t('common.success') }); 
    },
    onError: (err: any) => toast({ 
      title: t('common.error'), 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const kdsOrders = orders.filter((o: any) => o.status === "open");
  const canChange = hasScope("orders:status");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{t('restaurant.kds.title')}</h1>
            <p className="text-muted-foreground">{t('restaurant.kds.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["commanded", "preparing", "delivered"] as const).map((col) => (
              <Card key={col}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {col === "commanded" && <Clock className="h-5 w-5" />}
                    {col === "preparing" && <ChefHat className="h-5 w-5" />}
                    {col === "delivered" && <Utensils className="h-5 w-5" />}
                    {col === "commanded" ? t('restaurant.kds.commanded') : 
                     col === "preparing" ? t('restaurant.kds.preparing') : 
                     t('restaurant.kds.delivered')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {kdsOrders.flatMap((o: any) =>
                      o.lines
                        .filter((l: any) => (l.fireStatus || l.fire_status) === col)
                        .map((l: any) => (
                          <div key={l.id} className="p-3 border rounded-md">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold">
                                  {(l.itemName || l.item_name)} × {l.qty}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t('restaurant.kds.orderNumber', { id: o.id })} • {t('restaurant.kds.table')} {o.table?.code || o.table_id}
                                </div>
                                
                                {l.comment && (
                                  <div className="mt-2 text-xs italic bg-muted/30 p-2 rounded flex items-start gap-1.5 border-l-2 border-primary">
                                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                                    <span className="text-foreground/80">{l.comment}</span>
                                  </div>
                                )}
                              </div>
                              {statusBadge(l.fireStatus || l.fire_status)}
                            </div>
                            
                            <div className="mt-2 flex gap-2">
                              {(l.fireStatus || l.fire_status) === "commanded" && (
                                <Button 
                                  size="sm" 
                                  disabled={!canChange} 
                                  onClick={() => setLineStatus.mutate({ 
                                    orderId: o.id, 
                                    lineId: l.id, 
                                    status: "preparing" 
                                  })}
                                >
                                  {t('restaurant.kds.markAsPreparing')}
                                </Button>
                              )}
                              {(l.fireStatus || l.fire_status) === "preparing" && (
                                <Button 
                                  size="sm" 
                                  disabled={!canChange} 
                                  onClick={() => setLineStatus.mutate({ 
                                    orderId: o.id, 
                                    lineId: l.id, 
                                    status: "delivered" 
                                  })}
                                >
                                  {t('restaurant.kds.markAsDelivered')}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                    )}
                    
                    {kdsOrders.flatMap((o: any) => 
                      o.lines.filter((l: any) => (l.fireStatus || l.fire_status) === col)
                    ).length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground border rounded-md bg-muted/5">
                        {t('restaurant.kds.noOrders')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}