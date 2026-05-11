// src/pages/restaurant/Restaurant.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UtensilsCrossed,
  Clock,
  CheckCircle,
  Package,
  DollarSign,
  ChefHat,
  ClipboardList,
  TrendingUp,
  Trash2,
  Download,
  ChevronDown,
  FileText,
  Table,
  FileCode,
  File,
  FileSpreadsheet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

const Restaurant = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [exportRestaurantOpen, setExportRestaurantOpen] = useState(false);
  const [exportRestaurantLoading, setExportRestaurantLoading] = useState(false);

  const { data: openOrders = [], isLoading: loadingOpen } = useQuery({ 
    queryKey: ["restaurant","orders","open"], 
    queryFn: () => api.get<any[]>("/restaurant/orders?dept=restaurant&status=open") 
  });
  const { data: allOrders = [], isLoading: loadingAll } = useQuery({ 
    queryKey: ["restaurant","orders","all"], 
    queryFn: () => api.get<any[]>("/restaurant/orders?dept=restaurant") 
  });
  const { data: tables = [], isLoading: loadingTables } = useQuery({ 
    queryKey: ["restaurant","tables"], 
    queryFn: () => api.get<any[]>("/restaurant/tables") 
  });

  const reportsToday = useQuery({ 
    queryKey: ["reports","daily","restaurant"], 
    queryFn: () => api.get<any>(`/reports/daily?dept=restaurant&date=${new Date().toISOString().slice(0,10)}`), 
    enabled: true 
  });

  const deleteOrder = useMutation({ 
    mutationFn: (id:number) => api.del(`/restaurant/orders/${id}`), 
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["restaurant","orders","all"] }); 
      toast({ title: t('restaurant.orderDeleted') }); 
    }, 
    onError: (e:any)=> toast({ title: t('common.error'), description: String(e), variant:'destructive' }) 
  });

  const closeOrder = useMutation({ 
    mutationFn: (orderId:number) => api.post(`/restaurant/orders/${orderId}/close`), 
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["restaurant","orders","open"] }); 
      qc.invalidateQueries({ queryKey: ["restaurant","orders","all"] }); 
      toast({ title: t('restaurant.orderClosed') }); 
    }, 
    onError: (e:any)=> toast({ title: t('common.error'), description: String(e), variant:'destructive' }) 
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      open: "bg-warning/10 text-warning border-warning/20",
      closed: "bg-success/10 text-success border-success/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
    } as Record<string,string>;

    const labels: Record<string,string> = { 
      open: t('restaurant.statusActive'), 
      closed: t('restaurant.statusClosed'), 
      cancelled: t('restaurant.statusCancelled') 
    };

    return (
      <Badge variant="outline" className={styles[status] || styles.open}>
        {labels[status] || labels.open}
      </Badge>
    );
  };

  const occupiedTableCodes = Array.from(new Set(openOrders.map((o:any)=> o.table?.code).filter(Boolean)));
  const totalTables = tables.length || 0;
  const activeOrders = openOrders.length || 0;
  const dailyRevenue = reportsToday.data?.total ?? 0;
  const dishesServed = (allOrders || [])
    .filter((o:any)=> o.status === 'closed')
    .reduce((sum:number, o:any)=> sum + (o.lines?.reduce((s:number,l:any)=> s + (l.qty||0), 0) || 0), 0);

  const exportOptions = [
    { format: 'excel', label: t('export.excel'), extension: '.xlsx', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', hoverColor: 'hover:bg-green-100', description: t('export.excelDescription') },
    { format: 'csv', label: t('export.csv'), extension: '.csv', icon: Table, color: 'text-blue-600', bgColor: 'bg-blue-50', hoverColor: 'hover:bg-blue-100', description: t('export.csvDescription') },
    { format: 'txt', label: t('export.txt'), extension: '.txt', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', hoverColor: 'hover:bg-purple-100', description: t('export.txtDescription') },
    { format: 'json', label: t('export.json'), extension: '.json', icon: FileCode, color: 'text-orange-600', bgColor: 'bg-orange-50', hoverColor: 'hover:bg-orange-100', description: t('export.jsonDescription') }
  ];

  const prepareExportData = () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    
    const commandesActives = openOrders.map((order: any) => ({
      id: order.id,
      table: order.table?.code || order.table?.name || order.tableId || 'N/A',
      statut: t('restaurant.statusActive'),
      articles: order.lines?.map((l: any) => `${l.itemName} × ${l.qty}`).join(', ') || '',
      total: order.lines?.reduce((s: any, l: any) => s + (l.unitPrice || 0) * l.qty, 0) || 0,
      heureOuverture: new Date(order.openedAt || order.opened_at || Date.now()).toLocaleTimeString('fr-FR'),
      dateOuverture: new Date(order.openedAt || order.opened_at || Date.now()).toLocaleDateString('fr-FR')
    }));

    const commandesFermees = (allOrders || [])
      .filter((o: any) => o.status === 'closed')
      .map((order: any) => ({
        id: order.id,
        table: order.table?.code || order.table?.name || order.tableId || 'N/A',
        statut: t('restaurant.statusClosed'),
        articles: order.lines?.map((l: any) => `${l.itemName} × ${l.qty}`).join(', ') || '',
        total: order.lines?.reduce((s: any, l: any) => s + (l.unitPrice || 0) * l.qty, 0) || 0,
        heureFermeture: new Date(order.closedAt || order.closed_at || Date.now()).toLocaleTimeString('fr-FR'),
        dateFermeture: new Date(order.closedAt || order.closed_at || Date.now()).toLocaleDateString('fr-FR')
      }));

    const statistiques = {
      tablesOccupees: occupiedTableCodes.length,
      totalTables: totalTables,
      commandesActives: activeOrders,
      caJournalier: dailyRevenue,
      platsServis: dishesServed,
      dateExport: new Date().toLocaleString('fr-FR'),
      hotelName: t('restaurant.hotelName')
    };

    return {
      metadata: {
        hotelName: t('restaurant.hotelName'),
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalCommandes: allOrders.length
      },
      statistiques,
      commandesActives,
      commandesFermees
    };
  };

  const exportToCSV = (data: any) => {
    let csvContent = "\uFEFF";
    csvContent += `${t('restaurant.exportReport')}\n`;
    csvContent += `${t('common.period')}: ${data.metadata.periode}\n`;
    csvContent += `${t('export.title')}: ${data.metadata.exportDate}\n`;
    csvContent += `${t('restaurant.totalOrders')}: ${data.metadata.totalCommandes}\n\n`;

    csvContent += `${t('restaurant.statisticsSummary')}\n`;
    csvContent += `${t('restaurant.metric')},${t('restaurant.value')}\n`;
    csvContent += `${t('restaurant.occupiedTables')},${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}\n`;
    csvContent += `${t('restaurant.activeOrders')},${data.statistiques.commandesActives}\n`;
    csvContent += `${t('restaurant.dailyRevenue')},${new Intl.NumberFormat('fr-FR').format(data.statistiques.caJournalier)} Ar\n`;
    csvContent += `${t('restaurant.dishesServed')},${data.statistiques.platsServis}\n\n`;

    csvContent += `${t('restaurant.activeOrdersList')}\n`;
    csvContent += `${t('restaurant.id')},${t('restaurant.table')},${t('common.status')},${t('restaurant.items')},${t('restaurant.totalAr')},${t('restaurant.time')},${t('common.date')}\n`;
    
    data.commandesActives.forEach((commande: any) => {
      csvContent += `${commande.id},${commande.table},${commande.statut},"${commande.articles}",${commande.total},${commande.heureOuverture},${commande.dateOuverture}\n`;
    });

    csvContent += `\n${t('restaurant.closedOrdersList')}\n`;
    csvContent += `${t('restaurant.id')},${t('restaurant.table')},${t('common.status')},${t('restaurant.items')},${t('restaurant.totalAr')},${t('restaurant.time')},${t('common.date')}\n`;
    
    data.commandesFermees.slice(0, 50).forEach((commande: any) => {
      csvContent += `${commande.id},${commande.table},${commande.statut},"${commande.articles}",${commande.total},${commande.heureFermeture},${commande.dateFermeture}\n`;
    });

    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `restaurant-report-${data.metadata.periode}.csv`);
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();
    
    const syntheseData = [
      [t('restaurant.exportReport'), ""],
      [t('common.period'), data.metadata.periode],
      [t('export.title'), data.metadata.exportDate],
      [t('restaurant.totalOrders'), data.metadata.totalCommandes],
      ["", ""],
      [t('restaurant.statisticsSummary'), ""],
      [t('restaurant.occupiedTables'), `${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}`],
      [t('restaurant.activeOrders'), data.statistiques.commandesActives],
      [t('restaurant.dailyRevenue'), data.statistiques.caJournalier],
      [t('restaurant.dishesServed'), data.statistiques.platsServis]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, t('restaurant.summary'));

    const activesHeaders = [t('restaurant.id'), t('restaurant.table'), t('common.status'), t('restaurant.items'), t('restaurant.totalAr'), t('restaurant.openingTime'), t('restaurant.openingDate')];
    const activesData = data.commandesActives.map((commande: any) => [commande.id, commande.table, commande.statut, commande.articles, commande.total, commande.heureOuverture, commande.dateOuverture]);
    const activesWorksheet = XLSX.utils.aoa_to_sheet([activesHeaders, ...activesData]);
    activesWorksheet['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, activesWorksheet, t('restaurant.activeOrders'));

    const fermeesHeaders = [t('restaurant.id'), t('restaurant.table'), t('common.status'), t('restaurant.items'), t('restaurant.totalAr'), t('restaurant.closingTime'), t('restaurant.closingDate')];
    const fermeesData = data.commandesFermees.slice(0, 100).map((commande: any) => [commande.id, commande.table, commande.statut, commande.articles, commande.total, commande.heureFermeture, commande.dateFermeture]);
    const fermeesWorksheet = XLSX.utils.aoa_to_sheet([fermeesHeaders, ...fermeesData]);
    fermeesWorksheet['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, fermeesWorksheet, t('restaurant.closedOrders'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `restaurant-report-${data.metadata.periode}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const textContent = `
${t('restaurant.exportReport')}
${"=".repeat(50)}

${t('restaurant.generalInfo')}
${t('restaurant.restaurantName')}: ${data.metadata.hotelName}
${t('common.period')}: ${data.metadata.periode}
${t('export.title')}: ${data.metadata.exportDate}
${t('restaurant.totalOrders')}: ${data.metadata.totalCommandes}

${t('restaurant.statisticsSummary')}
• ${t('restaurant.occupiedTables')}: ${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}
• ${t('restaurant.activeOrders')}: ${data.statistiques.commandesActives}
• ${t('restaurant.dailyRevenue')}: ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caJournalier)} Ar
• ${t('restaurant.dishesServed')}: ${data.statistiques.platsServis}

${t('restaurant.activeOrdersList')} (${data.commandesActives.length})
${data.commandesActives.map((commande: any, index: number) => `
${index + 1}. ${t('restaurant.order')} #${commande.id}
   ${t('restaurant.table')}: ${commande.table}
   ${t('common.status')}: ${commande.statut}
   ${t('restaurant.items')}: ${commande.articles}
   ${t('restaurant.total')}: ${new Intl.NumberFormat('fr-FR').format(commande.total)} Ar
   ${t('restaurant.openedOn')}: ${commande.dateOuverture} ${t('restaurant.at')} ${commande.heureOuverture}
`).join('\n')}

${t('restaurant.closedOrdersList')} (${Math.min(data.commandesFermees.length, 50)} ${t('restaurant.first')})
${data.commandesFermees.slice(0, 50).map((commande: any, index: number) => `
${index + 1}. ${t('restaurant.order')} #${commande.id}
   ${t('restaurant.table')}: ${commande.table}
   ${t('common.status')}: ${commande.statut}
   ${t('restaurant.items')}: ${commande.articles}
   ${t('restaurant.total')}: ${new Intl.NumberFormat('fr-FR').format(commande.total)} Ar
   ${t('restaurant.closedOn')}: ${commande.dateFermeture} ${t('restaurant.at')} ${commande.heureFermeture}
`).join('\n')}

---
${t('restaurant.reportGenerated')}
    `.trim();

    saveAs(new Blob([textContent], { type: 'text/plain;charset=utf-8' }), `restaurant-report-${data.metadata.periode}.txt`);
  };

  const exportToJSON = (data: any) => {
    const jsonData = {
      restaurant: t('restaurant.hotelName'),
      exportDate: new Date().toISOString(),
      period: data.metadata.periode,
      totalOrders: data.metadata.totalCommandes,
      statistics: data.statistiques,
      activeOrders: data.commandesActives,
      closedOrders: data.commandesFermees.slice(0, 100)
    };
    saveAs(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), `restaurant-report-${data.metadata.periode}.json`);
  };

  const exporterRestaurant = async (formatType: string) => {
    if (allOrders.length === 0 && openOrders.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportRestaurantLoading(true);
    setExportRestaurantOpen(false);
    
    try {
      const data = prepareExportData();

      switch (formatType) {
        case 'csv': exportToCSV(data); break;
        case 'excel': exportToExcel(data); break;
        case 'txt': exportToTXT(data); break;
        case 'json': exportToJSON(data); break;
      }

      toast({ title: t('export.exportSuccess'), description: `${data.metadata.totalCommandes} ${t('restaurant.ordersExported')} ${formatType.toUpperCase()}` });
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportRestaurantLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {t('nav.restaurant')}
              </h1>
              <p className="text-muted-foreground">
                {t('restaurant.subtitle')}
              </p>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setExportRestaurantOpen(!exportRestaurantOpen)}
                disabled={exportRestaurantLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold group"
              >
                {exportRestaurantLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{t('export.exporting')}</span></>
                ) : (
                  <><Download className="w-4 h-4 group-hover:scale-110 transition-transform" /><span>{t('common.export')}</span><ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" /></>
                )}
              </button>

              {exportRestaurantOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10">
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                    <p className="text-xs text-blue-600 mt-1">{t('restaurant.chooseFormat')}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {exportOptions.map((option) => {
                      const IconComponent = option.icon;
                      return (
                        <button
                          key={option.format}
                          onClick={() => exporterRestaurant(option.format)}
                          className={`flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 ${option.bgColor} ${option.hoverColor}`}
                        >
                          <div className={`p-2 rounded-lg ${option.bgColor}`}>
                            <IconComponent className={`w-5 h-5 ${option.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{option.label}</span>
                              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{option.extension}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">{allOrders.length} {t('restaurant.ordersCount')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title={t('restaurant.occupiedTables')}
              value={`${occupiedTableCodes.length}/${totalTables}`}
              icon={UtensilsCrossed}
              variant="default"
            />
            <StatCard
              title={t('restaurant.activeOrders')}
              value={String(activeOrders)}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title={t('restaurant.dailyRevenue')}
              value={`${new Intl.NumberFormat('fr-FR').format(dailyRevenue)} Ar`}
              icon={DollarSign}
              variant="gold"
            />
            <StatCard
              title={t('restaurant.dishesServed')}
              value={String(dishesServed)}
              icon={CheckCircle}
              variant="success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('restaurant.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/restaurant/pos')}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {t('restaurant.newOrder')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/restaurant/kds')}>
                  <ChefHat className="mr-2 h-4 w-4" />
                  {t('restaurant.kitchenView')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  {t('restaurant.inventory')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/cash')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t('restaurant.cashRegister')}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('restaurant.activeOrders')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {openOrders.map((order:any) => (
                    <div
                      key={order.id}
                      className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <UtensilsCrossed className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{order.id} - {order.table?.code || order.table?.name || order.tableId || 'N/A'}</span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {order.lines?.map((l:any)=> `${l.itemName} × ${l.qty}`).join(', ')}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{new Date(order.openedAt || order.opened_at || Date.now()).toLocaleTimeString('fr-FR')}</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gold">{new Intl.NumberFormat('fr-FR').format(order.lines?.reduce((s:any,l:any)=> s + (l.unitPrice||0)*l.qty,0) || 0)} Ar</span>
                          <Button size="sm" variant="outline" onClick={()=>closeOrder.mutate(order.id)}>{t('restaurant.close')}</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {openOrders.length===0 && <div className="text-sm text-muted-foreground">{t('restaurant.noActiveOrders')}</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('restaurant.closedOrders')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(allOrders || []).filter((o:any)=> o.status === 'closed').slice(0, 20).map((order:any) => (
                    <div key={order.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <UtensilsCrossed className="h-4 w-4 text-success" />
                          <span className="font-semibold">{order.id} - {order.table?.code || order.table?.name || order.tableId || 'N/A'}</span>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {order.lines?.map((l:any)=> `${l.itemName} × ${l.qty}`).join(', ')}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{new Date(order.closedAt || order.closed_at || Date.now()).toLocaleString('fr-FR')}</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{new Intl.NumberFormat('fr-FR').format(order.lines?.reduce((s:any,l:any)=> s + (l.unitPrice||0)*l.qty,0) || 0)} Ar</span>
                          <Button size="sm" variant="destructive" onClick={()=> { if(confirm(t('restaurant.deleteConfirm'))) deleteOrder.mutate(order.id); }}>
                            <Trash2 className="h-4 w-4 mr-1"/> {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(allOrders || []).filter((o:any)=> o.status === 'closed').length===0 && <div className="text-sm text-muted-foreground">{t('restaurant.noClosedOrders')}</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Restaurant;