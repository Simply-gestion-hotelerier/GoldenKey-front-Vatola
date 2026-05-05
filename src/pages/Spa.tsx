import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles,
  Calendar,
  Clock,
  Package,
  DollarSign,
  User,
  CheckCircle,
  AlertCircle,
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
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const Spa = () => {
  const qc = useQueryClient();
  const today = new Date();
  const ymd = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);

  // États pour l'exportation améliorée
  const [exportSpaOpen, setExportSpaOpen] = useState(false);
  const [exportSpaLoading, setExportSpaLoading] = useState(false);

  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0);
  const { data: appointments = [] } = useQuery({
    queryKey: ["spa", "appointments", ymd],
    queryFn: () => api.get<any[]>(`/spa/appointments?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["spa","services"],
    queryFn: () => api.get<any[]>(`/spa/services`),
    staleTime: 60000,
  });

  const { data: revenue = { total: 0 } } = useQuery({
    queryKey: ["reports", "spa", ymd],
    queryFn: () => api.get<{ total: number }>(`/reports/daily?dept=spa&date=${ymd}`),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const startMut = useMutation({
    mutationFn: (id: number) => api.patch(`/spa/appointments/${id}/status`, { status: "in_progress" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa","appointments", ymd] }); toast({ title: "RDV démarré" }); },
    onError: (e:any) => toast({ title: "Erreur", description: String(e), variant: "destructive" })
  });
  const completeMut = useMutation({
    mutationFn: (id: number) => api.patch(`/spa/appointments/${id}/status`, { status: "completed" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa","appointments", ymd] }); toast({ title: "RDV terminé" }); },
    onError: (e:any) => toast({ title: "Erreur", description: String(e), variant: "destructive" })
  });
  const noShowMut = useMutation({
    mutationFn: (id: number) => api.patch(`/spa/appointments/${id}/status`, { status: "no_show" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa","appointments", ymd] }); toast({ title: "No-show enregistré" }); },
    onError: (e:any) => toast({ title: "Erreur", description: String(e), variant: "destructive" })
  });
  const payMut = useMutation({
    mutationFn: (p: { id:number; amount:number; method:'cash'|'card'|'mobile'|'bank' }) => api.post(`/spa/appointments/${p.id}/pay`, { amount: p.amount, method: p.method }),
    onSuccess: () => { toast({ title: 'Encaissement', description: 'Paiement enregistré.' }); },
    onError: (e:any) => toast({ title: 'Erreur', description: String(e), variant: 'destructive' })
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/spa/appointments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa","appointments", ymd] }); toast({ title: "RDV supprimé" }); },
    onError: (e:any) => toast({ title: "Erreur", description: String(e), variant: "destructive" })
  });

  const [showNew, setShowNew] = useState(false);
  const [showDetails, setShowDetails] = useState<{ open: boolean; app: any | null }>({ open: false, app: null });
  const [newApp, setNewApp] = useState({
    clientName: "",
    serviceName: "",
    start: "",
    durationMin: 60,
    price: 0,
    room: "",
  });
  const createMut = useMutation({
    mutationFn: () => api.post(`/spa/appointments`, {
      clientName: newApp.clientName,
      serviceName: newApp.serviceName,
      start: new Date(newApp.start).toISOString(),
      durationMin: Number(newApp.durationMin),
      price: Math.max(0, Math.floor(Number(newApp.price))),
      room: newApp.room || undefined,
    }),
    onSuccess: () => {
      setShowNew(false);
      setNewApp({ clientName: "", serviceName: "", start: "", durationMin: 60, price: 0, room: "" });
      qc.invalidateQueries({ queryKey: ["spa","appointments", ymd] });
      toast({ title: "RDV créé" });
    },
    onError: (e:any) => toast({ title: "Erreur", description: String(e), variant: "destructive" })
  });

  const stats = useMemo(() => {
    const countToday = appointments.length;
    const inProgress = appointments.filter((a:any) => a.status === 'in_progress').length;
    const completed = appointments.filter((a:any) => a.status === 'completed').length;
    const noShow = appointments.filter((a:any) => a.status === 'no_show').length;
    const totalMinutes = appointments.reduce((s:number, a:any) => s + (a.durationMin || 0), 0);
    const capacityMin = 8 * 60; // journée de 8h
    const occupancy = capacityMin ? Math.min(100, Math.round((totalMinutes / capacityMin) * 100)) : 0;
    const totalRevenue = appointments
      .filter((a:any) => a.status === 'completed')
      .reduce((s:number, a:any) => s + (a.price || 0), 0);
    
    return { 
      countToday, 
      inProgress, 
      completed,
      noShow,
      occupancy, 
      totalRevenue,
      totalMinutes 
    };
  }, [appointments]);

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
    
    const donneesRDV = appointments.map((rdv: any) => ({
      id: rdv.id,
      client: rdv.clientName,
      prestation: rdv.serviceName,
      dateHeure: new Date(rdv.start).toLocaleString('fr-FR'),
      heure: new Date(rdv.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      duree: rdv.durationMin,
      prix: rdv.price || 0,
      prixFormate: `${(rdv.price || 0).toLocaleString('fr-FR')} Ar`,
      salle: rdv.room || 'Non spécifiée',
      statut: rdv.status,
      statutLibelle: getStatusLabel(rdv.status),
      dateCreation: new Date(rdv.createdAt || rdv.created_at || Date.now()).toLocaleDateString('fr-FR')
    }));

    const statistiques = {
      rdvTotal: stats.countToday,
      rdvEnCours: stats.inProgress,
      rdvTermines: stats.completed,
      rdvNoShow: stats.noShow,
      caTotal: stats.totalRevenue,
      tauxOccupation: stats.occupancy,
      totalMinutes: stats.totalMinutes,
      dateExport: new Date().toLocaleString('fr-FR')
    };

    return {
      metadata: {
        hotelName: "Simply Hotel - Spa & Onglerie",
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalRDV: appointments.length
      },
      statistiques,
      rendezVous: donneesRDV
    };
  };

  const getStatusLabel = (status: string): string => {
    const labels = {
      booked: "Confirmé",
      in_progress: "En cours",
      waiting: "En attente",
      completed: "Terminé",
      no_show: "No-show",
      cancelled: "Annulé",
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Export CSV avec séparateurs espaces
  const exportToCSV = (data: any) => {
    const csvContent = generateCSVContent(data);
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    saveAs(blob, `rapport-spa-${data.metadata.periode}.csv`);
  };

  const generateCSVContent = (data: any): string => {
    let csvContent = "\uFEFF"; // BOM UTF-8
    
    // En-tête du rapport
    csvContent += "RAPPORT SPA & ONGLERIE - SIMPLY HOTEL\n";
    csvContent += `Période: ${data.metadata.periode}\n`;
    csvContent += `Exporté le: ${data.metadata.exportDate}\n`;
    csvContent += `Total RDV: ${data.metadata.totalRDV}\n\n`;

    // Section statistiques avec séparateur espace
    csvContent += "SYNTHÈSE DES STATISTIQUES\n";
    csvContent += "Métrique          Valeur\n";
    csvContent += `RDV total         ${data.statistiques.rdvTotal}\n`;
    csvContent += `RDV en cours      ${data.statistiques.rdvEnCours}\n`;
    csvContent += `RDV terminés      ${data.statistiques.rdvTermines}\n`;
    csvContent += `RDV no-show       ${data.statistiques.rdvNoShow}\n`;
    csvContent += `CA total          ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caTotal)} Ar\n`;
    csvContent += `Taux occupation   ${data.statistiques.tauxOccupation}%\n`;
    csvContent += `Total minutes     ${data.statistiques.totalMinutes} min\n\n`;

    // Section rendez-vous avec formatage aligné
    csvContent += "RENDEZ-VOUS DU JOUR\n";
    csvContent += "ID    Client              Prestation                    Heure   Durée  Prix (Ar)    Salle              Statut\n";
    
    data.rendezVous.forEach((rdv: any) => {
      const ligne = [
        rdv.id.toString().padEnd(5),
        rdv.client.padEnd(19),
        rdv.prestation.padEnd(28),
        rdv.heure.padEnd(7),
        rdv.duree.toString().padEnd(6),
        new Intl.NumberFormat('fr-FR').format(rdv.prix).padEnd(12),
        rdv.salle.padEnd(18),
        rdv.statutLibelle
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
      ["RAPPORT SPA & ONGLERIE - SIMPLY HOTEL", ""],
      ["Période", data.metadata.periode],
      ["Exporté le", data.metadata.exportDate],
      ["Total RDV", data.metadata.totalRDV],
      ["", ""],
      ["SYNTHÈSE DES STATISTIQUES", ""],
      ["RDV total", data.statistiques.rdvTotal],
      ["RDV en cours", data.statistiques.rdvEnCours],
      ["RDV terminés", data.statistiques.rdvTermines],
      ["RDV no-show", data.statistiques.rdvNoShow],
      ["CA total", data.statistiques.caTotal],
      ["Taux occupation", `${data.statistiques.tauxOccupation}%`],
      ["Total minutes", data.statistiques.totalMinutes]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, "Synthèse");

    // Feuille des rendez-vous
    const rdvHeaders = ["ID", "Client", "Prestation", "Date/Heure", "Durée (min)", "Prix (Ar)", "Salle", "Statut"];
    const rdvData = data.rendezVous.map((rdv: any) => [
      rdv.id,
      rdv.client,
      rdv.prestation,
      rdv.dateHeure,
      rdv.duree,
      rdv.prix,
      rdv.salle,
      rdv.statutLibelle
    ]);

    const rdvWorksheet = XLSX.utils.aoa_to_sheet([rdvHeaders, ...rdvData]);
    rdvWorksheet['!cols'] = [
      { wch: 8 },   // ID
      { wch: 20 },  // Client
      { wch: 25 },  // Prestation
      { wch: 20 },  // Date/Heure
      { wch: 12 },  // Durée
      { wch: 12 },  // Prix
      { wch: 15 },  // Salle
      { wch: 12 }   // Statut
    ];
    XLSX.utils.book_append_sheet(workbook, rdvWorksheet, "Rendez-vous");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `rapport-spa-${data.metadata.periode}.xlsx`);
  };

  // Export TXT amélioré
  const exportToTXT = (data: any) => {
    const textContent = `
RAPPORT SPA & ONGLERIE - SIMPLY HOTEL
======================================

INFORMATIONS GÉNÉRALES
-----------------------
Établissement : ${data.metadata.hotelName}
Période : ${data.metadata.periode}
Exporté le : ${data.metadata.exportDate}
Total RDV : ${data.metadata.totalRDV}

SYNTHÈSE DES STATISTIQUES
-------------------------
• RDV total : ${data.statistiques.rdvTotal}
• RDV en cours : ${data.statistiques.rdvEnCours}
• RDV terminés : ${data.statistiques.rdvTermines}
• RDV no-show : ${data.statistiques.rdvNoShow}
• CA total : ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caTotal)} Ar
• Taux occupation : ${data.statistiques.tauxOccupation}%
• Total minutes : ${data.statistiques.totalMinutes} min

RENDEZ-VOUS DU JOUR (${data.rendezVous.length})
-----------------------------------------------
${data.rendezVous.map((rdv: any, index: number) => `
${index + 1}. RDV #${rdv.id}
    Client: ${rdv.client}
    Prestation: ${rdv.prestation}
    Horaire: ${rdv.dateHeure}
    Durée: ${rdv.duree} min
    Prix: ${rdv.prixFormate}
    Salle: ${rdv.salle}
    Statut: ${rdv.statutLibelle}
`).join('\n')}

---
Rapport généré automatiquement par Simply Hotel
Système de gestion hôtelière
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `rapport-spa-${data.metadata.periode}.txt`);
  };

  // Export JSON amélioré
  const exportToJSON = (data: any) => {
    const jsonData = {
      etablissement: "Simply Hotel - Spa & Onglerie",
      dateExport: new Date().toISOString(),
      periode: data.metadata.periode,
      totalRDV: data.metadata.totalRDV,
      statistiques: data.statistiques,
      rendezVous: data.rendezVous
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8' 
    });
    saveAs(blob, `rapport-spa-${data.metadata.periode}.json`);
  };

  // Gestion de l'export améliorée
  const exporterSpa = async (formatType: string) => {
    if (appointments.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Il n'y a aucun rendez-vous à exporter",
        variant: "destructive"
      });
      return;
    }

    setExportSpaLoading(true);
    setExportSpaOpen(false);
    
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
        description: `${appointments.length} RDV exporté(s) en ${formatType.toUpperCase()}`
      });
    } catch (erreur) {
      console.error('Erreur lors de l\'export:', erreur);
      toast({
        title: 'Erreur exportation',
        description: String(erreur),
        variant: 'destructive'
      });
    } finally {
      setExportSpaLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      booked: "bg-success/10 text-success border-success/20",
      in_progress: "bg-primary/10 text-primary border-primary/20",
      waiting: "bg-warning/10 text-warning border-warning/20",
      completed: "bg-muted text-muted-foreground border-muted",
      no_show: "bg-warning/20 text-warning border-warning/30",
      cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    } as Record<string,string>;

    const labels = {
      booked: "Confirmé",
      in_progress: "En cours",
      waiting: "En attente",
      completed: "Terminé",
      no_show: "No-show",
      cancelled: "Annulé",
    } as Record<string,string>;

    const k = status as keyof typeof styles;
    return (
      <Badge variant="outline" className={styles[k] || styles.booked}>
        {labels[k] || status}
      </Badge>
    );
  };

  const navigate = useNavigate();
  
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
                Spa & Onglerie
              </h1>
              <p className="text-muted-foreground">
                Planning • Prestations • Inventaire • Paiements
              </p>
            </div>
            
            {/* Bouton d'exportation amélioré */}
            <div className="relative">
              <button
                onClick={() => setExportSpaOpen(!exportSpaOpen)}
                disabled={exportSpaLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md font-semibold group"
              >
                {exportSpaLoading ? (
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

              {exportSpaOpen && (
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
                          onClick={() => exporterSpa(option.format)}
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
                      {appointments.length} RDV • {new Date().toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title="RDV Aujourd'hui" value={stats.countToday} icon={Calendar} variant="default" />
            <StatCard title="En cours" value={stats.inProgress} icon={Clock} variant="default" />
            <StatCard title="CA Journée" value={`${Math.round((revenue?.total||0)).toLocaleString('fr-FR')} Ar`} icon={DollarSign} variant="gold" />
            <StatCard title="Taux Occupation" value={`${stats.occupancy}%`} icon={CheckCircle} variant="success" />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={()=>setShowNew(true)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Nouveau RDV
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/spa/agenda')}>
                  <User className="mr-2 h-4 w-4" />
                  Fiche Client
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  Inventaire Produits
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/cash')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Encaissement
                </Button>
              </CardContent>
            </Card>

            {/* Today's Appointments */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  Planning du Jour ({appointments.length} RDV)
                  {appointments.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      {stats.inProgress} en cours, {stats.completed} terminé{stats.completed > 1 ? 's' : ''}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {appointments.map((a: any) => {
                    const time = new Date(a.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={a.id} className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{time} - {a.clientName}</span>
                          </div>
                          {getStatusBadge(a.status)}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          <div>{a.serviceName}{a.room ? ` • Salle: ${a.room}` : ''}</div>
                          <div>Durée: {a.durationMin} min</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gold">{`${(a.price||0).toLocaleString('fr-FR')} Ar`}</span>
                          <div className="flex items-center space-x-2">
                            {a.status === "waiting" && (
                              <Button size="sm" variant="outline" onClick={()=>startMut.mutate(a.id)}>Commencer</Button>
                            )}
                            {a.status === "in_progress" && (
                              <Button size="sm" variant="outline" onClick={()=>completeMut.mutate(a.id)}>Terminer</Button>
                            )}
                            {a.status === "booked" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={()=>startMut.mutate(a.id)}>Démarrer</Button>
                                <Button size="sm" variant="outline" onClick={()=>noShowMut.mutate(a.id)}>No-show</Button>
                              </>
                            )}
                            {(a.status === "in_progress" || a.status === "completed") && (
                              <Button size="sm" variant="outline" onClick={()=>payMut.mutate({ id: a.id, amount: a.price || 0, method: 'cash' })}>Encaisser</Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={()=>setShowDetails({ open: true, app: a })}>Détails</Button>
                            {((['completed','cancelled','no_show'] as const).includes(a.status) || (new Date(a.start).getTime() + (a.durationMin||0)*60000) < Date.now()) && (
                              <Button size="sm" variant="destructive" onClick={()=>{
                                if (confirm('Supprimer ce RDV ?')) deleteMut.mutate(a.id);
                              }}>
                                <Trash2 className="h-4 w-4 mr-1"/> Supprimer
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Nouveau RDV</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client</Label>
                  <Input id="clientName" value={newApp.clientName} onChange={(e)=>setNewApp({ ...newApp, clientName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceName">Prestation</Label>
                  {services.length ? (
                    <Select onValueChange={(id)=>{
                      const s = services.find((x:any)=> String(x.id) === id);
                      if (s) setNewApp({ ...newApp, serviceName: s.name, durationMin: s.durationMin, price: s.salePrice });
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={newApp.serviceName || 'Choisir un service'} />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s:any)=>(
                          <SelectItem key={s.id} value={String(s.id)}>{s.name} • {s.salePrice.toLocaleString('fr-FR')} Ar</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input id="serviceName" value={newApp.serviceName} onChange={(e)=>setNewApp({ ...newApp, serviceName: e.target.value })} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Date & heure</Label>
                    <Input id="start" type="datetime-local" value={newApp.start} onChange={(e)=>setNewApp({ ...newApp, start: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Durée (min)</Label>
                    <Input min={0} id="duration" type="number" value={newApp.durationMin} onChange={(e)=>setNewApp({ ...newApp, durationMin: Number(e.target.value)||0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Prix (MGA)</Label>
                    <Input min={0} id="price" type="number" value={newApp.price} onChange={(e)=>setNewApp({ ...newApp, price: Number(e.target.value)||0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">Salle</Label>
                    <Input id="room" value={newApp.room} onChange={(e)=>setNewApp({ ...newApp, room: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={()=>setShowNew(false)}>Annuler</Button>
                  <Button onClick={()=>createMut.mutate()} disabled={!newApp.clientName || !newApp.serviceName || !newApp.start || !newApp.durationMin || !newApp.price}>Créer</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showDetails.open} onOpenChange={(o)=>setShowDetails(({ app })=>({ open: o, app }))}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Fiche Client</DialogTitle>
              </DialogHeader>
              {showDetails.app && (
                <div className="grid gap-2 py-2 text-sm">
                  <div className="font-semibold text-lg">{showDetails.app.clientName}</div>
                  <div>Prestation: {showDetails.app.serviceName}</div>
                  <div>Date: {new Date(showDetails.app.start).toLocaleString('fr-FR')}</div>
                  <div>Durée: {showDetails.app.durationMin} min</div>
                  {showDetails.app.room && <div>Salle: {showDetails.app.room}</div>}
                  <div>Prix: {(showDetails.app.price||0).toLocaleString('fr-FR')} Ar</div>
                  <div>Statut: {getStatusBadge(showDetails.app.status)}</div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default Spa;