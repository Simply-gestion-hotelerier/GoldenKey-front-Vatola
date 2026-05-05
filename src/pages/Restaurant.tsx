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

const Restaurant = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // États pour l'exportation améliorée
  const [exportRestaurantOpen, setExportRestaurantOpen] = useState(false);
  const [exportRestaurantLoading, setExportRestaurantLoading] = useState(false);

  const { data: openOrders = [], isLoading: loadingOpen } = useQuery({ queryKey: ["restaurant","orders","open"], queryFn: () => api.get<any[]>("/restaurant/orders?dept=restaurant&status=open") });
  const { data: allOrders = [], isLoading: loadingAll } = useQuery({ queryKey: ["restaurant","orders","all"], queryFn: () => api.get<any[]>("/restaurant/orders?dept=restaurant") });
  const { data: tables = [], isLoading: loadingTables } = useQuery({ queryKey: ["restaurant","tables"], queryFn: () => api.get<any[]>("/restaurant/tables") });

  const reportsToday = useQuery({ queryKey: ["reports","daily","restaurant"], queryFn: () => api.get<any>(`/reports/daily?dept=restaurant&date=${new Date().toISOString().slice(0,10)}`), enabled: true });

  const deleteOrder = useMutation({ mutationFn: (id:number) => api.del(`/restaurant/orders/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant","orders","all"] }); toast({ title: 'Commande supprimée' }); }, onError: (e:any)=> toast({ title:'Erreur suppression', description: String(e), variant:'destructive' }) });

  const closeOrder = useMutation({ mutationFn: (orderId:number) => api.post(`/restaurant/orders/${orderId}/close`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant","orders","open"] }); qc.invalidateQueries({ queryKey: ["restaurant","orders","all"] }); toast({ title: 'Commande clôturée' }); }, onError: (e:any)=> toast({ title:'Erreur', description: String(e), variant:'destructive' }) });

  const getStatusBadge = (status: string) => {
    const styles = {
      open: "bg-warning/10 text-warning border-warning/20",
      closed: "bg-success/10 text-success border-success/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
    } as Record<string,string>;

    const labels: Record<string,string> = { open: 'Active', closed: 'Fermée', cancelled: 'Annulée' };

    return (
      <Badge variant="outline" className={styles[status] || styles.open}>{labels[status] || labels.open}</Badge>
    );
  };

  const occupiedTableCodes = Array.from(new Set(openOrders.map((o:any)=> o.table?.code).filter(Boolean)));
  const totalTables = tables.length || 0;
  const activeOrders = openOrders.length || 0;
  const dailyRevenue = reportsToday.data?.total ?? 0;
  const dishesServed = (allOrders || [])
    .filter((o:any)=> o.status === 'closed')
    .reduce((sum:number, o:any)=> sum + (o.lines?.reduce((s:number,l:any)=> s + (l.qty||0), 0) || 0), 0);

  // Options d'exportation améliorées
  const exportOptions = [
    {
      format: 'excel',
      label: 'Excel',
      extension: '.xlsx',
      icon: FileSpreadsheet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100',
      description: 'Tableur optimisé'
    },
    {
      format: 'csv',
      label: 'CSV',
      extension: '.csv',
      icon: Table,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      description: 'Données avec séparateurs espaces'
    },
    {
      format: 'txt',
      label: 'Texte',
      extension: '.txt',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100',
      description: 'Format lisible'
    },
    {
      format: 'json',
      label: 'JSON',
      extension: '.json',
      icon: FileCode,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      hoverColor: 'hover:bg-orange-100',
      description: 'Données brutes API'
    }
  ];

  // Préparer les données pour l'export
  const prepareExportData = () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    
    const commandesActives = openOrders.map((order: any) => ({
      id: order.id,
      table: order.table?.code || order.table?.name || order.tableId || 'N/A',
      statut: 'Active',
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
        statut: 'Fermée',
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
      hotelName: "Simply Hotel - Restaurant"
    };

    return {
      metadata: {
        hotelName: "Simply Hotel - Restaurant",
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalCommandes: allOrders.length
      },
      statistiques,
      commandesActives,
      commandesFermees
    };
  };

  // Export CSV avec séparateurs espaces
  const exportToCSV = (data: any) => {
    const csvContent = generateCSVContent(data);
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    saveAs(blob, `rapport-restaurant-${data.metadata.periode}.csv`);
  };

  const generateCSVContent = (data: any): string => {
    let csvContent = "\uFEFF"; // BOM UTF-8
    
    // En-tête du rapport
    csvContent += "RAPPORT RESTAURANT - SIMPLY HOTEL\n";
    csvContent += `Période: ${data.metadata.periode}\n`;
    csvContent += `Exporté le: ${data.metadata.exportDate}\n`;
    csvContent += `Total commandes: ${data.metadata.totalCommandes}\n\n`;

    // Section statistiques avec séparateur espace
    csvContent += "SYNTHÈSE DES STATISTIQUES\n";
    csvContent += "Métrique          Valeur\n";
    csvContent += `Tables occupées   ${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}\n`;
    csvContent += `Commandes actives ${data.statistiques.commandesActives}\n`;
    csvContent += `CA journalier     ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caJournalier)} Ar\n`;
    csvContent += `Plats servis      ${data.statistiques.platsServis}\n\n`;

    // Section commandes actives avec formatage aligné
    csvContent += "COMMANDES ACTIVES\n";
    csvContent += "ID    Table  Statut  Articles                                    Total (Ar)  Heure     Date\n";
    
    data.commandesActives.forEach((commande: any) => {
      const ligne = [
        commande.id.toString().padEnd(5),
        commande.table.padEnd(6),
        commande.statut.padEnd(7),
        commande.articles.padEnd(42),
        new Intl.NumberFormat('fr-FR').format(commande.total).padEnd(11),
        commande.heureOuverture.padEnd(9),
        commande.dateOuverture
      ].join('  '); // Double espace comme séparateur
      
      csvContent += ligne + '\n';
    });

    csvContent += '\n';

    // Section commandes fermées avec formatage aligné
    csvContent += "COMMANDES FERMÉES\n";
    csvContent += "ID    Table  Statut  Articles                                    Total (Ar)  Heure     Date\n";
    
    data.commandesFermees.slice(0, 50).forEach((commande: any) => {
      const ligne = [
        commande.id.toString().padEnd(5),
        commande.table.padEnd(6),
        commande.statut.padEnd(7),
        commande.articles.padEnd(42),
        new Intl.NumberFormat('fr-FR').format(commande.total).padEnd(11),
        commande.heureFermeture.padEnd(9),
        commande.dateFermeture
      ].join('  '); // Double espace comme séparateur
      
      csvContent += ligne + '\n';
    });

    return csvContent;
  };

  // Export Excel amélioré
  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();
    
    // Feuille de synthèse
    const syntheseData = [
      ["RAPPORT RESTAURANT - SIMPLY HOTEL", ""],
      ["Période", data.metadata.periode],
      ["Exporté le", data.metadata.exportDate],
      ["Total commandes", data.metadata.totalCommandes],
      ["", ""],
      ["SYNTHÈSE DES STATISTIQUES", ""],
      ["Tables occupées", `${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}`],
      ["Commandes actives", data.statistiques.commandesActives],
      ["CA journalier", data.statistiques.caJournalier],
      ["Plats servis", data.statistiques.platsServis]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, "Synthèse");

    // Feuille des commandes actives
    const activesHeaders = ["ID", "Table", "Statut", "Articles", "Total (Ar)", "Heure Ouverture", "Date Ouverture"];
    const activesData = data.commandesActives.map((commande: any) => [
      commande.id,
      commande.table,
      commande.statut,
      commande.articles,
      commande.total,
      commande.heureOuverture,
      commande.dateOuverture
    ]);

    const activesWorksheet = XLSX.utils.aoa_to_sheet([activesHeaders, ...activesData]);
    activesWorksheet['!cols'] = [
      { wch: 8 },   // ID
      { wch: 10 },  // Table
      { wch: 12 },  // Statut
      { wch: 40 },  // Articles
      { wch: 12 },  // Total
      { wch: 12 },  // Heure
      { wch: 12 }   // Date
    ];
    XLSX.utils.book_append_sheet(workbook, activesWorksheet, "Commandes Actives");

    // Feuille des commandes fermées
    const fermeesHeaders = ["ID", "Table", "Statut", "Articles", "Total (Ar)", "Heure Fermeture", "Date Fermeture"];
    const fermeesData = data.commandesFermees.slice(0, 100).map((commande: any) => [
      commande.id,
      commande.table,
      commande.statut,
      commande.articles,
      commande.total,
      commande.heureFermeture,
      commande.dateFermeture
    ]);

    const fermeesWorksheet = XLSX.utils.aoa_to_sheet([fermeesHeaders, ...fermeesData]);
    fermeesWorksheet['!cols'] = [
      { wch: 8 },   // ID
      { wch: 10 },  // Table
      { wch: 12 },  // Statut
      { wch: 40 },  // Articles
      { wch: 12 },  // Total
      { wch: 12 },  // Heure
      { wch: 12 }   // Date
    ];
    XLSX.utils.book_append_sheet(workbook, fermeesWorksheet, "Commandes Fermées");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `rapport-restaurant-${data.metadata.periode}.xlsx`);
  };

  // Export TXT amélioré
  const exportToTXT = (data: any) => {
    const textContent = `
RAPPORT RESTAURANT - SIMPLY HOTEL
==================================

INFORMATIONS GÉNÉRALES
-----------------------
Restaurant : ${data.metadata.hotelName}
Période : ${data.metadata.periode}
Exporté le : ${data.metadata.exportDate}
Total commandes : ${data.metadata.totalCommandes}

SYNTHÈSE DES STATISTIQUES
-------------------------
• Tables occupées : ${data.statistiques.tablesOccupees}/${data.statistiques.totalTables}
• Commandes actives : ${data.statistiques.commandesActives}
• CA journalier : ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caJournalier)} Ar
• Plats servis : ${data.statistiques.platsServis}

COMMANDES ACTIVES (${data.commandesActives.length})
-----------------------------------------------
${data.commandesActives.map((commande: any, index: number) => `
${index + 1}. Commande #${commande.id}
    Table: ${commande.table}
    Statut: ${commande.statut}
    Articles: ${commande.articles}
    Total: ${new Intl.NumberFormat('fr-FR').format(commande.total)} Ar
    Ouverte le: ${commande.dateOuverture} à ${commande.heureOuverture}
`).join('\n')}

COMMANDES FERMÉES (${Math.min(data.commandesFermees.length, 50)} premières)
---------------------------------------------------------
${data.commandesFermees.slice(0, 50).map((commande: any, index: number) => `
${index + 1}. Commande #${commande.id}
    Table: ${commande.table}
    Statut: ${commande.statut}
    Articles: ${commande.articles}
    Total: ${new Intl.NumberFormat('fr-FR').format(commande.total)} Ar
    Fermée le: ${commande.dateFermeture} à ${commande.heureFermeture}
`).join('\n')}

---
Rapport généré automatiquement par Simply Hotel
Système de gestion hôtelière
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `rapport-restaurant-${data.metadata.periode}.txt`);
  };

  // Export JSON amélioré
  const exportToJSON = (data: any) => {
    const jsonData = {
      restaurant: "Simply Hotel - Restaurant",
      dateExport: new Date().toISOString(),
      periode: data.metadata.periode,
      totalCommandes: data.metadata.totalCommandes,
      statistiques: data.statistiques,
      commandesActives: data.commandesActives,
      commandesFermees: data.commandesFermees.slice(0, 100) // Limiter à 100 commandes
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8' 
    });
    saveAs(blob, `rapport-restaurant-${data.metadata.periode}.json`);
  };

  // Gestion de l'export améliorée
  const exporterRestaurant = async (formatType: string) => {
    if (allOrders.length === 0 && openOrders.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Il n'y a aucune commande à exporter",
        variant: "destructive"
      });
      return;
    }

    setExportRestaurantLoading(true);
    setExportRestaurantOpen(false);
    
    try {
      const data = prepareExportData();

      switch (formatType) {
        case 'csv':
          exportToCSV(data);
          break;
        case 'excel':
          exportToExcel(data);
          break;
        case 'txt':
          exportToTXT(data);
          break;
        case 'json':
          exportToJSON(data);
          break;
        default:
          break;
      }

      toast({
        title: "Export réussi",
        description: `${data.metadata.totalCommandes} commande(s) exportée(s) en ${formatType.toUpperCase()}`
      });
    } catch (erreur) {
      console.error('Erreur lors de l\'export:', erreur);
      toast({
        title: 'Erreur exportation',
        description: String(erreur),
        variant: 'destructive'
      });
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
          {/* Header avec bouton d'exportation amélioré */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Restaurant
              </h1>
              <p className="text-muted-foreground">
                Commandes • Cuisine • Inventaire • Caisse
              </p>
            </div>
            
            {/* Bouton d'exportation amélioré */}
            <div className="relative">
              <button
                onClick={() => setExportRestaurantOpen(!exportRestaurantOpen)}
                disabled={exportRestaurantLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md font-semibold group"
              >
                {exportRestaurantLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Export en cours...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Exporter les données</span>
                    <ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" />
                  </>
                )}
              </button>

              {exportRestaurantOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10 overflow-hidden backdrop-blur-sm">
                  {/* En-tête */}
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    <p className="text-sm font-bold text-blue-900">Format d'exportation</p>
                    <p className="text-xs text-blue-600 mt-1">Choisissez le format souhaité</p>
                  </div>
                  
                  {/* Options d'export */}
                  <div className="p-3 space-y-2">
                    {exportOptions.map((option) => {
                      const IconComponent = option.icon;
                      return (
                        <button
                          key={option.format}
                          onClick={() => exporterRestaurant(option.format)}
                          className={`flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 ${option.bgColor} ${option.hoverColor} group/option`}
                        >
                          <div className={`p-2 rounded-lg ${option.bgColor} group-hover/option:scale-110 transition-transform`}>
                            <IconComponent className={`w-5 h-5 ${option.color}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 group-hover/option:text-blue-700 transition-colors">
                                {option.label}
                              </span>
                              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {option.extension}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {option.description}
                            </p>
                          </div>
                          
                          <div className="opacity-0 group-hover/option:opacity-100 transition-opacity">
                            <Download className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pied de page */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">
                      {allOrders.length} commande(s) • {new Date().toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Tables Occupées"
              value={`${occupiedTableCodes.length}/${totalTables}`}
              icon={UtensilsCrossed}
              variant="default"
            />
            <StatCard
              title="Commandes Actives"
              value={String(activeOrders)}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="CA Aujourd'hui"
              value={`${new Intl.NumberFormat('fr-FR').format(dailyRevenue)} Ar`}
              icon={DollarSign}
              variant="gold"
            />
            <StatCard
              title="Plats Servis"
              value={String(dishesServed)}
              icon={CheckCircle}
              variant="success"
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/restaurant/pos')}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Nouvelle Commande
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/restaurant/kds')}>
                  <ChefHat className="mr-2 h-4 w-4" />
                  Vue Cuisine
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  Inventaire
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/cash')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Caisse
                </Button>
              </CardContent>
            </Card>

            {/* Active Orders */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Commandes Actives</CardTitle>
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
                          <Button size="sm" variant="outline" onClick={()=>closeOrder.mutate(order.id)}>Clôturer</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {openOrders.length===0 && <div className="text-sm text-muted-foreground">Aucune commande active</div>}
                </div>
              </CardContent>
            </Card>

            {/* Closed Orders */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Commandes Clôturées</CardTitle>
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
                          <Button size="sm" variant="destructive" onClick={()=> { if(confirm('Supprimer cette commande ?')) deleteOrder.mutate(order.id); }}>
                            <Trash2 className="h-4 w-4 mr-1"/> Supprimer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(allOrders || []).filter((o:any)=> o.status === 'closed').length===0 && <div className="text-sm text-muted-foreground">Aucune commande clôturée</div>}
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