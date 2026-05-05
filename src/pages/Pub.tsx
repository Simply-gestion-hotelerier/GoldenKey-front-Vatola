import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wine,
  Clock,
  CheckCircle,
  Package,
  DollarSign,
  AlertTriangle,
  Users,
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
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const Pub = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // États pour l'exportation améliorée
  const [exportPubOpen, setExportPubOpen] = useState(false);
  const [exportPubLoading, setExportPubLoading] = useState(false);

  const { data: tabs = [] } = useQuery({ queryKey: ["bar","tabs"], queryFn: () => api.get<any[]>("/bar/tabs"), refetchInterval: 10000 });

  const { data: tables = [] } = useQuery({ queryKey: ["restaurant","tables"], queryFn: () => api.get<any[]>("/restaurant/tables"), staleTime: 15000 });
  const { data: openOrders = [] } = useQuery({ queryKey: ["pub","orders","open"], queryFn: () => api.get<any[]>("/restaurant/orders?dept=pub&status=open"), refetchInterval: 5000, staleTime: 2000 });

  const today = new Date();
  const ymd = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const { data: pubDaily = { total: 0 } } = useQuery({ queryKey: ["reports","pub", ymd], queryFn: ()=> api.get<{ total:number }>(`/reports/daily?dept=pub&date=${ymd}`), refetchInterval: 30000, staleTime: 10000 });

  const stats = useMemo(() => {
    const pubTables = (tables || []).filter((t:any)=> (t.department||t.dept||'') === 'pub');
    const usedTables = new Set((openOrders||[]).filter((o:any)=> o.tableId).map((o:any)=> o.tableId)).size;
    const openTabs = (tabs||[]).filter((t:any)=> (t.status||'') === 'open').length;
    const unpaidTotal = (tabs||[]).filter((t:any)=> (t.status||'') === 'unpaid').reduce((s:number, t:any)=> s + (t.balance||0), 0);
    return { 
      tablesOccupied: `${usedTables}/${pubTables.length}`, 
      openTabs, 
      dailyTotal: pubDaily?.total||0, 
      unpaidTotal,
      totalTabs: tabs.length,
      paidTabs: tabs.filter((t:any) => t.status === 'paid').length
    };
  }, [tables, openOrders, tabs, pubDaily]);

  const createTab = useMutation({ mutationFn: (name:string) => api.post('/bar/tabs', { customerName: name }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bar','tabs'] }); toast({ title: 'Ardoise créée' }); } });

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: "bg-success/10 text-success border-success/20",
      unpaid: "bg-destructive/10 text-destructive border-destructive/20",
      open: "bg-warning/10 text-warning border-warning/20",
    } as Record<string,string>;

    const labels = {
      paid: "Payé",
      unpaid: "Impayé",
      open: "Ouvert",
    } as Record<string,string>;

    return (
      <Badge variant="outline" className={styles[status] || styles.open}>
        {labels[status] || labels.open}
      </Badge>
    );
  };

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
    
    const donneesTabs = tabs.map((tab: any) => ({
      id: tab.id,
      client: tab.customerName || tab.customer_name || `Tab ${tab.id}`,
      statut: tab.status,
      statutFormate: tab.status === 'paid' ? 'Payé' : tab.status === 'unpaid' ? 'Impayé' : 'Ouvert',
      solde: tab.balance || 0,
      soldeFormate: `${new Intl.NumberFormat('fr-FR').format(tab.balance || 0)} MGA`,
      nombreCommandes: tab.orders?.length || 0,
      dateCreation: new Date(tab.createdAt || tab.created_at || Date.now()).toLocaleDateString('fr-FR'),
      heureCreation: new Date(tab.createdAt || tab.created_at || Date.now()).toLocaleTimeString('fr-FR'),
      derniereModification: tab.updatedAt ? new Date(tab.updatedAt).toLocaleString('fr-FR') : 'N/A'
    }));

    const statistiques = {
      tablesOccupees: stats.tablesOccupied,
      tabsActives: stats.openTabs,
      tabsTotal: stats.totalTabs,
      tabsPayees: stats.paidTabs,
      tabsImpayees: stats.totalTabs - stats.paidTabs - stats.openTabs,
      caSoiree: stats.dailyTotal,
      impayes: stats.unpaidTotal,
      dateExport: new Date().toLocaleString('fr-FR'),
      hotelName: "Simply Hotel - Pub/Bar"
    };

    return {
      metadata: {
        hotelName: "Simply Hotel - Pub/Bar",
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalTabs: tabs.length
      },
      statistiques,
      tabs: donneesTabs
    };
  };

  // Export CSV avec séparateurs espaces
  const exportToCSV = (data: any) => {
    const csvContent = generateCSVContent(data);
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    saveAs(blob, `rapport-pub-${data.metadata.periode}.csv`);
  };

  const generateCSVContent = (data: any): string => {
    let csvContent = "\uFEFF"; // BOM UTF-8
    
    // En-tête du rapport
    csvContent += "RAPPORT PUB/BAR - SIMPLY HOTEL\n";
    csvContent += `Période: ${data.metadata.periode}\n`;
    csvContent += `Exporté le: ${data.metadata.exportDate}\n`;
    csvContent += `Total tabs: ${data.metadata.totalTabs}\n\n`;

    // Section statistiques avec séparateur espace
    csvContent += "SYNTHÈSE DES STATISTIQUES\n";
    csvContent += "Métrique          Valeur\n";
    csvContent += `Tables occupées   ${data.statistiques.tablesOccupees}\n`;
    csvContent += `Tabs actives      ${data.statistiques.tabsActives}\n`;
    csvContent += `Tabs total        ${data.statistiques.tabsTotal}\n`;
    csvContent += `Tabs payées       ${data.statistiques.tabsPayees}\n`;
    csvContent += `Tabs impayées     ${data.statistiques.tabsImpayees}\n`;
    csvContent += `CA soirée         ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caSoiree)} MGA\n`;
    csvContent += `Impayés           ${new Intl.NumberFormat('fr-FR').format(data.statistiques.impayes)} MGA\n\n`;

    // Section détail des tabs avec formatage aligné
    csvContent += "DÉTAIL DES TABS\n";
    csvContent += "ID    Client           Statut   Solde (MGA)   Commandes  Date Création  Heure\n";
    
    data.tabs.forEach((tab: any) => {
      const ligne = [
        tab.id.toString().padEnd(5),
        tab.client.padEnd(16),
        tab.statutFormate.padEnd(8),
        new Intl.NumberFormat('fr-FR').format(tab.solde).padEnd(13),
        tab.nombreCommandes.toString().padEnd(10),
        tab.dateCreation.padEnd(14),
        tab.heureCreation
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
      ["RAPPORT PUB/BAR - SIMPLY HOTEL", ""],
      ["Période", data.metadata.periode],
      ["Exporté le", data.metadata.exportDate],
      ["Total tabs", data.metadata.totalTabs],
      ["", ""],
      ["SYNTHÈSE DES STATISTIQUES", ""],
      ["Tables occupées", data.statistiques.tablesOccupees],
      ["Tabs actives", data.statistiques.tabsActives],
      ["Tabs total", data.statistiques.tabsTotal],
      ["Tabs payées", data.statistiques.tabsPayees],
      ["Tabs impayées", data.statistiques.tabsImpayees],
      ["CA soirée", data.statistiques.caSoiree],
      ["Impayés", data.statistiques.impayes]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, "Synthèse");

    // Feuille des détails des tabs
    const detailsHeaders = ["ID", "Client", "Statut", "Solde (MGA)", "Nombre Commandes", "Date Création", "Heure Création", "Dernière Modification"];
    const detailsData = data.tabs.map((tab: any) => [
      tab.id,
      tab.client,
      tab.statutFormate,
      tab.solde,
      tab.nombreCommandes,
      tab.dateCreation,
      tab.heureCreation,
      tab.derniereModification
    ]);

    const detailsWorksheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsData]);
    detailsWorksheet['!cols'] = [
      { wch: 8 },   // ID
      { wch: 20 },  // Client
      { wch: 10 },  // Statut
      { wch: 12 },  // Solde
      { wch: 15 },  // Nombre Commandes
      { wch: 12 },  // Date Création
      { wch: 12 },  // Heure Création
      { wch: 18 }   // Dernière Modification
    ];
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, "Détails Tabs");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `rapport-pub-${data.metadata.periode}.xlsx`);
  };

  // Export TXT amélioré
  const exportToTXT = (data: any) => {
    const textContent = `
RAPPORT PUB/BAR - SIMPLY HOTEL
===============================

INFORMATIONS GÉNÉRALES
-----------------------
Établissement : ${data.metadata.hotelName}
Période : ${data.metadata.periode}
Exporté le : ${data.metadata.exportDate}
Total tabs : ${data.metadata.totalTabs}

SYNTHÈSE DES STATISTIQUES
-------------------------
• Tables occupées : ${data.statistiques.tablesOccupees}
• Tabs actives : ${data.statistiques.tabsActives}
• Tabs total : ${data.statistiques.tabsTotal}
• Tabs payées : ${data.statistiques.tabsPayees}
• Tabs impayées : ${data.statistiques.tabsImpayees}
• CA soirée : ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caSoiree)} MGA
• Impayés : ${new Intl.NumberFormat('fr-FR').format(data.statistiques.impayes)} MGA

DÉTAIL DES TABS
---------------
${data.tabs.map((tab: any, index: number) => `
${index + 1}. Tab #${tab.id}
    Client: ${tab.client}
    Statut: ${tab.statutFormate}
    Solde: ${tab.soldeFormate}
    Commandes: ${tab.nombreCommandes}
    Créé le: ${tab.dateCreation} à ${tab.heureCreation}
    ${tab.derniereModification !== 'N/A' ? `Dernière modification: ${tab.derniereModification}` : ''}
`).join('\n')}

---
Rapport généré automatiquement par Simply Hotel
Système de gestion hôtelière
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `rapport-pub-${data.metadata.periode}.txt`);
  };

  // Export JSON amélioré
  const exportToJSON = (data: any) => {
    const jsonData = {
      etablissement: "Simply Hotel - Pub/Bar",
      dateExport: new Date().toISOString(),
      periode: data.metadata.periode,
      totalTabs: data.metadata.totalTabs,
      statistiques: data.statistiques,
      tabs: data.tabs
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8' 
    });
    saveAs(blob, `rapport-pub-${data.metadata.periode}.json`);
  };

  // Gestion de l'export améliorée
  const exporterPub = async (formatType: string) => {
    if (tabs.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Il n'y a aucune tab à exporter",
        variant: "destructive"
      });
      return;
    }

    setExportPubLoading(true);
    setExportPubOpen(false);
    
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
        description: `${tabs.length} tab(s) exportée(s) en ${formatType.toUpperCase()}`
      });
    } catch (erreur) {
      console.error('Erreur lors de l\'export:', erreur);
      toast({
        title: 'Erreur exportation',
        description: String(erreur),
        variant: 'destructive'
      });
    } finally {
      setExportPubLoading(false);
    }
  };

  const openNewTab = async () => {
    const name = window.prompt('Nom client (optionnel)') || 'Client';
    createTab.mutate(name);
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
                Pub/Bar
              </h1>
              <p className="text-muted-foreground">
                Commandes • Inventaire • Gestion des tabs • Paiement uniquement dans Bar POS
              </p>
            </div>
            
            {/* Bouton d'exportation amélioré */}
            <div className="relative">
              <button
                onClick={() => setExportPubOpen(!exportPubOpen)}
                disabled={exportPubLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md font-semibold group"
              >
                {exportPubLoading ? (
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

              {exportPubOpen && (
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
                          onClick={() => exporterPub(option.format)}
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
                      {tabs.length} tab(s) • {new Date().toLocaleDateString('fr-FR')}
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
              value={stats.tablesOccupied}
              icon={Wine}
              variant="default"
            />
            <StatCard
              title="Tabs Ouvertes"
              value={String(stats.openTabs)}
              icon={Clock}
              variant="warning"
            />
            <StatCard
              title="CA Soirée"
              value={`${new Intl.NumberFormat('fr-FR').format(stats.dailyTotal)} Ar`}
              icon={DollarSign}
              variant="gold"
            />
            <StatCard
              title="Impayés"
              value={`${new Intl.NumberFormat('fr-FR').format(stats.unpaidTotal)} Ar`}
              icon={AlertTriangle}
              variant="warning"
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
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/bar')}>
                  <Wine className="mr-2 h-4 w-4" />
                  Nouvelle Commande
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/bar/pos')}>
                  Aller à Bar POS (paiement)
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  Inventaire Bar
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/bar')}>
                  <Users className="mr-2 h-4 w-4" />
                  Gestion Tables
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={openNewTab}>
                  Nouvelle Ardoise
                </Button>
              </CardContent>
            </Card>

            {/* Active Tabs */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  Tabs Actives ({tabs.length} tab{tabs.length > 1 ? 's' : ''})
                  {tabs.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      {stats.openTabs} ouvert{stats.openTabs > 1 ? 's' : ''}, {stats.paidTabs} payé{stats.paidTabs > 1 ? 's' : ''}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tabs.map((tab:any) => (
                    <div
                      key={tab.id}
                      className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Wine className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{tab.customerName || tab.customer_name || `Tab ${tab.id}`}</span>
                        </div>
                        {getStatusBadge(tab.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {tab.orders?.length ? `${tab.orders.length} commande${tab.orders.length > 1 ? 's' : ''}` : 'Aucune commande'}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Solde: {new Intl.NumberFormat('fr-FR').format(tab.balance || 0)} MGA</span>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline" onClick={()=> navigate('/bar/pos')} disabled={(tab.status || '') === 'paid'}>
                            {(tab.status || '') === 'paid' ? 'Déjà payé' : 'Payer dans Bar POS'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {tabs.length === 0 && <div className="text-sm text-muted-foreground">Aucune ardoise</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Pub;