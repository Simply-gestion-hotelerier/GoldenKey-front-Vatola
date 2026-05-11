// src/pages/bar/BarDisplay.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/rbac";
import { api } from "@/lib/api";
import { Wine, Clock, CheckCircle, Utensils, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function BarDisplay() {
  const { hasScope } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [loadingLines, setLoadingLines] = useState<Set<number>>(new Set());
  
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "pub"],
    queryFn: () => api.get<any[]>(`/restaurant/orders?dept=pub&status=open`),
    refetchInterval: 3000,
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      commanded: "bg-warning/10 text-warning border-warning/20",
      preparing: "bg-primary/10 text-primary border-primary/20",
      ready: "bg-success/10 text-success border-success/20",
      delivered: "bg-muted/10 text-muted border-muted/20",
    };
    const labels: Record<string, string> = {
      commanded: t('restaurant.kds.commanded'),
      preparing: t('restaurant.kds.preparing'),
      ready: t('restaurant.kds.ready'),
      delivered: t('restaurant.kds.delivered'),
    };
    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const setLineStatus = useMutation({
    mutationFn: async (p: { orderId: number; lineId: number; status: string }) => {
      setLoadingLines(prev => new Set(prev).add(p.lineId));
      try {
        const response = await api.patch(`/restaurant/orders/${p.orderId}/lines/${p.lineId}/status`, { status: p.status });
        return response;
      } finally {
        setLoadingLines(prev => {
          const newSet = new Set(prev);
          newSet.delete(p.lineId);
          return newSet;
        });
      }
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["orders", "pub"] }); 
      toast({ 
        title: t('common.success'), 
        description: t('common.success') 
      }); 
    },
    onError: (err: any) => {
      toast({ 
        title: t('common.error'), 
        description: String(err), 
        variant: 'destructive' 
      });
    },
  });

  const activeBarLines = orders.flatMap((o: any) => 
    o.lines
      ?.filter((l: any) => (l.fireStatus || l.fire_status) !== "delivered")
      .map((line: any) => ({
        ...line,
        order: o
      })) || []
  );

  const deliveredLines = orders.flatMap((o: any) => 
    o.lines
      ?.filter((l: any) => (l.fireStatus || l.fire_status) === "delivered")
      .map((line: any) => ({
        ...line,
        order: o
      })) || []
  );

  const canChange = hasScope("bar:orders:status");
  const isLoading = (lineId: number) => loadingLines.has(lineId);

  const getOrderReference = (order: any) => {
    if (order.table?.code) return `${t('restaurant.kds.table')} ${order.table.code}`;
    if (order.customerName) return `${t('crm.customers')} ${order.customerName}`;
    return `Tab ${order.tabId || order.tab_id}`;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{t('nav.bar')} • Display</h1>
            <p className="text-muted-foreground">{t('restaurant.kds.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(["commanded", "preparing", "ready", "delivered"] as const).map((col) => (
              <Card key={col}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {col === "commanded" && <Clock className="h-5 w-5" />}
                    {col === "preparing" && <Wine className="h-5 w-5" />}
                    {col === "ready" && <CheckCircle className="h-5 w-5" />}
                    {col === "delivered" && <Utensils className="h-5 w-5" />}
                    {col === "commanded" ? t('restaurant.kds.commanded') : 
                     col === "preparing" ? t('restaurant.kds.preparing') : 
                     col === "ready" ? t('restaurant.kds.ready') : 
                     t('restaurant.kds.delivered')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {col === "delivered" && deliveredLines.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">{t('common.success')}</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {deliveredLines.length} {t('common.total')}
                        </p>
                      </div>
                    )}

                    {activeBarLines
                      .filter((l: any) => (l.fireStatus || l.fire_status) === col)
                      .map((l: any) => (
                        <div key={l.id} className="p-3 border rounded-md">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">
                                {(l.itemName || l.item_name)} × {l.qty}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('restaurant.kds.orderNumber', { id: l.order.id })} • {getOrderReference(l.order)}
                              </div>
                              {l.notes && (
                                <div className="text-xs text-warning mt-1">
                                  📝 {l.notes}
                                </div>
                              )}
                            </div>
                            {statusBadge(l.fireStatus || l.fire_status)}
                          </div>
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {(l.fireStatus || l.fire_status) === "commanded" && (
                              <Button 
                                size="sm" 
                                disabled={!canChange || isLoading(l.id)}
                                onClick={() => setLineStatus.mutate({ 
                                  orderId: l.order.id, 
                                  lineId: l.id, 
                                  status: "preparing" 
                                })}
                              >
                                {isLoading(l.id) ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('common.loading')}
                                  </>
                                ) : (
                                  t('restaurant.kds.markAsPreparing')
                                )}
                              </Button>
                            )}
                            {(l.fireStatus || l.fire_status) === "preparing" && (
                              <Button 
                                size="sm" 
                                disabled={!canChange || isLoading(l.id)}
                                onClick={() => setLineStatus.mutate({ 
                                  orderId: l.order.id, 
                                  lineId: l.id, 
                                  status: "ready" 
                                })}
                              >
                                {isLoading(l.id) ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('common.loading')}
                                  </>
                                ) : (
                                  t('restaurant.kds.ready')
                                )}
                              </Button>
                            )}
                            {(l.fireStatus || l.fire_status) === "ready" && (
                              <Button 
                                size="sm" 
                                disabled={!canChange || isLoading(l.id)}
                                onClick={() => setLineStatus.mutate({ 
                                  orderId: l.order.id, 
                                  lineId: l.id, 
                                  status: "delivered"
                                })}
                              >
                                {isLoading(l.id) ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('common.loading')}
                                  </>
                                ) : (
                                  t('restaurant.kds.markAsDelivered')
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {new Date(l.createdAt || l.created_at).toLocaleTimeString('fr-FR')}
                            {isLoading(l.id) && (
                              <div className="flex items-center gap-1 text-blue-600 mt-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>{t('common.loading')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                    
                    {activeBarLines.filter((l: any) => (l.fireStatus || l.fire_status) === col).length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        {col === "delivered" ? (
                          <div className="space-y-2">
                            <Utensils className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                            <div>{t('common.noData')}</div>
                          </div>
                        ) : (
                          t('common.noData')
                        )}
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