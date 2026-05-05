import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bed,
  Users,
  ClipboardCheck,
  Package,
  UserPlus,
  UserMinus,
  AlertCircle,
  CheckCircle,
  Download,
  ChevronDown,
  FileText,
  Table,
  FileCode,
  FileSpreadsheet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useAuth } from "@/lib/rbac";

const hotel = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: chambres = [] } = useQuery({ queryKey: ["hotel","chambres"], queryFn: () => api.get<any[]>("/hotel/rooms") });

  // États pour l'exportation améliorée
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getBadgeStatut = (statut: string) => {
    const styles = {
      occupied: "bg-destructive/10 text-destructive border-destructive/20",
      available: "bg-success/10 text-success border-success/20",
      cleaning: "bg-warning/10 text-warning border-warning/20",
      maintenance: "bg-muted text-muted-foreground border-muted",
      out_of_order: "bg-muted text-muted-foreground border-muted",
    } as Record<string,string>;

    const libelles: Record<string,string> = {
      occupied: "Occupée",
      available: "Disponible",
      cleaning: "Nettoyage",
      maintenance: "Maintenance",
      out_of_order: "Hors service",
    };

    const cle = statut as string;
    return (
      <Badge variant="outline" className={styles[cle] || styles.available}>
        {libelles[cle] || libelles.available}
      </Badge>
    );
  };

  const mutationReservation = useMutation({
    mutationFn: async (p: { roomId: number; guestName?: string; checkinNow?: boolean }) => {
      const maintenant = new Date();
      const demain = new Date(maintenant.getTime() + 24*3600*1000);
      const cree = await api.post(`/hotel/reservations`, {
        roomId: p.roomId,
        guest: { fullName: p.guestName || "Client" },
        checkIn: maintenant.toISOString(),
        checkOut: demain.toISOString(),
        status: "booked",
        rate: 0,
      });
      const id = (cree as any).reservation?.id ?? (cree as any).id ?? (cree as any).reservationId ?? cree;
      if (p.checkinNow) {
        await api.post(`/hotel/reservations/${id}/checkin`);
      }
      return id;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hotel","chambres"] }); toast({ title: 'Réservation créée' }); },
    onError: (e:any) => toast({ title: 'Erreur réservation', description: String(e), variant: 'destructive' }),
  });

  const statistiquesRapides = {
    occupees: chambres.filter((r:any)=>r.status === 'occupied').length,
    disponibles: chambres.filter((r:any)=>r.status === 'available').length,
    nettoyage: chambres.filter((r:any)=>r.status === 'cleaning').length,
    maintenance: chambres.filter((r:any)=>r.status === 'maintenance' || r.status === 'out_of_order').length,
    total: chambres.length
  };

  const [nomClient, setNomClient] = useState('');
  const [afficherNouvelleReservation, setAfficherNouvelleReservation] = useState(false);
  const [chambreSelectionnee, setChambreSelectionnee] = useState<any | null>(null);
  const [nouvelleRes, setNouvelleRes] = useState({
    nomClient: "",
    email: "",
    telephone: "",
    dateArrivee: "",
    dateDepart: "",
    tarif: 0,
    checkinImmediat: false,
  });

  // Options d'exportation avec icônes et couleurs
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
    
    const chambresData = chambres.map((chambre: any) => ({
      numero: chambre.number,
      type: chambre.type,
      statut: getStatusLabel(chambre.status),
      prix: chambre.rate || 0,
      capacite: chambre.capacity || 2,
      etage: chambre.floor || 'RDC',
      equipements: chambre.amenities?.join(', ') || 'Standard',

    }));

    return {
      metadata: {
        hotelName: "Simply Hotel",
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        exportPar: user?.name || user?.email || "Utilisateur",
        totalChambres: chambres.length
      },
      statistiques: statistiquesRapides,
      chambres: chambresData
    };
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      occupied: 'Occupée',
      available: 'Disponible',
      cleaning: 'Nettoyage',
      maintenance: 'Maintenance',
      out_of_order: 'Hors service'
    };
    return labels[status] || status;
  };

  // Export CSV avec séparateurs espaces
  const exportToCSV = (data: any) => {
    const csvContent = generateCSVContent(data);
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    saveAs(blob, `gestion-hotel-${data.metadata.periode}.csv`);
  };

  const generateCSVContent = (data: any): string => {
    let csvContent = "\uFEFF"; // BOM UTF-8
    
    // En-tête du rapport
    csvContent += "RAPPORT DE GESTION HÔTELIÈRE - SIMPLY HOTEL\n";
    csvContent += `Période: ${data.metadata.periode}\n`;
    csvContent += `Exporté le: ${data.metadata.exportDate}\n`;
    csvContent += `Par: ${data.metadata.exportPar}\n`;
    csvContent += `Total chambres: ${data.metadata.totalChambres}\n\n`;

    // Section statistiques avec séparateur espace
    csvContent += "SYNTHÈSE DES STATISTIQUES\n";
    csvContent += "Métrique          Valeur\n";
    csvContent += `Chambres occupées ${data.statistiques.occupees}\n`;
    csvContent += `Chambres disponibles ${data.statistiques.disponibles}\n`;
    csvContent += `En nettoyage      ${data.statistiques.nettoyage}\n`;
    csvContent += `En maintenance    ${data.statistiques.maintenance}\n`;
    csvContent += `Taux d'occupation ${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%\n\n`;

    // Section détail des chambres avec formatage aligné
    csvContent += "DÉTAIL DES CHAMBRES\n";
    // En-têtes avec largeur fixe
    csvContent += "Numéro  Type            Statut      Prix      Capacité  Étage    Équipements           \n";
    
    data.chambres.forEach((chambre: any) => {
      // Formater chaque champ avec une largeur fixe et double espace comme séparateur
      const ligne = [
        chambre.numero.toString().padEnd(7),
        chambre.type.padEnd(15),
        chambre.statut.padEnd(11),
        chambre.prix.toString().padEnd(9),
        chambre.capacite.toString().padEnd(10),
        chambre.etage.padEnd(8),
        chambre.equipements.padEnd(22),
  
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
      ["RAPPORT DE GESTION HÔTELIÈRE - SIMPLY HOTEL", ""],
      ["Période", data.metadata.periode],
      ["Exporté le", data.metadata.exportDate],
      ["Par", data.metadata.exportPar],
      ["Total chambres", data.metadata.totalChambres],
      ["", ""],
      ["SYNTHÈSE DES STATISTIQUES", ""],
      ["Chambres occupées", data.statistiques.occupees],
      ["Chambres disponibles", data.statistiques.disponibles],
      ["En nettoyage", data.statistiques.nettoyage],
      ["En maintenance", data.statistiques.maintenance],
      ["Taux d'occupation", `${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%`],
      ["", ""],
      ["PERFORMANCE", ""],
      ["Disponibilité", `${data.metadata.totalChambres > 0 ? Math.round(((data.statistiques.disponibles + data.statistiques.occupees) / data.metadata.totalChambres) * 100) : 0}%`]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, "Synthèse");

    // Feuille des détails des chambres
    const detailsHeaders = ["Numéro", "Type", "Statut", "Prix (MGA)", "Capacité", "Étage", "Équipements"];
    const detailsData = data.chambres.map((chambre: any) => [
      chambre.numero,
      chambre.type,
      chambre.statut,
      chambre.prix,
      chambre.capacite,
      chambre.etage,
      chambre.equipements,

    ]);

    const detailsWorksheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsData]);
    detailsWorksheet['!cols'] = [
      { wch: 8 },  // Numéro
      { wch: 15 }, // Type
      { wch: 12 }, // Statut
      { wch: 12 }, // Prix
      { wch: 10 }, // Capacité
      { wch: 8 },  // Étage
      { wch: 25 }, // Équipements

    ];
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, "Détails Chambres");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `gestion-hotel-${data.metadata.periode}.xlsx`);
  };

  // Export TXT amélioré
  const exportToTXT = (data: any) => {
    const textContent = `
RAPPORT DE GESTION HÔTELIÈRE - SIMPLY HOTEL
=============================================

INFORMATIONS GÉNÉRALES
-----------------------
Hôtel : ${data.metadata.hotelName}
Période : ${data.metadata.periode}
Exporté le : ${data.metadata.exportDate}
Par : ${data.metadata.exportPar}
Total chambres : ${data.metadata.totalChambres}

SYNTHÈSE DES STATISTIQUES
-------------------------
• Chambres occupées : ${data.statistiques.occupees}
• Chambres disponibles : ${data.statistiques.disponibles}
• En nettoyage : ${data.statistiques.nettoyage}
• En maintenance : ${data.statistiques.maintenance}
• Taux d'occupation : ${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%

DÉTAIL DES CHAMBRES
-------------------
${data.chambres.map((chambre: any, index: number) => `
${index + 1}. Chambre ${chambre.numero}
    Type: ${chambre.type}
    Statut: ${chambre.statut}
    Prix: ${new Intl.NumberFormat('fr-FR').format(chambre.prix)} MGA
    Capacité: ${chambre.capacite} personnes
    Étage: ${chambre.etage}
    Équipements: ${chambre.equipements}

`).join('\n')}

---
Rapport généré automatiquement par Simply Hotel
Système de gestion hôtelière
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `gestion-hotel-${data.metadata.periode}.txt`);
  };

  // Export JSON amélioré
  const exportToJSON = (data: any) => {
    const jsonData = {
      hotel: "Simply Hotel",
      dateExport: new Date().toISOString(),
      periode: data.metadata.periode,
      exportPar: data.metadata.exportPar,
      totalChambres: data.metadata.totalChambres,
      statistiques: data.statistiques,
      chambres: data.chambres
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8' 
    });
    saveAs(blob, `gestion-hotel-${data.metadata.periode}.json`);
  };

  // Gestion de l'export
  const exportData = async (format: string) => {
    if (chambres.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Il n'y a aucune chambre à exporter",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    setIsExportOpen(false);
    
    try {
      const data = prepareExportData();

      switch (format) {
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
        description: `${chambres.length} chambre(s) exportée(s) en ${format.toUpperCase()}`
      });
    } catch (error) {
      console.error('Erreur export:', error);
      toast({
        title: 'Erreur lors de l\'exportation',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const creerReservation = async () => {
    try {
      if (!chambreSelectionnee?.id) {
        toast({ title: 'Erreur', description: 'Aucune chambre sélectionnée', variant: 'destructive' });
        return;
      }
      if (!nouvelleRes.nomClient || !nouvelleRes.dateArrivee || !nouvelleRes.dateDepart || !nouvelleRes.tarif) {
        toast({ title: 'Champs manquants', description: 'Nom, arrivée, départ et tarif sont requis', variant: 'destructive' });
        return;
      }
      const payload = {
        roomId: Number(chambreSelectionnee.id),
        guest: { fullName: nouvelleRes.nomClient, email: nouvelleRes.email || undefined, phone: nouvelleRes.telephone || undefined },
        checkIn: new Date(nouvelleRes.dateArrivee).toISOString(),
        checkOut: new Date(nouvelleRes.dateDepart).toISOString(),
        status: 'booked' as const,
        rate: Math.max(0, Math.floor(Number(nouvelleRes.tarif)))
      };
      const cree: any = await api.post('/hotel/reservations', payload);
      const id = cree?.reservation?.id ?? cree?.id ?? cree;
      if (nouvelleRes.checkinImmediat && id) {
        await api.post(`/hotel/reservations/${id}/checkin`);
      }
      setAfficherNouvelleReservation(false);
      setChambreSelectionnee(null);
      setNouvelleRes({ nomClient: "", email: "", telephone: "", dateArrivee: "", dateDepart: "", tarif: 0, checkinImmediat: false });
      qc.invalidateQueries({ queryKey: ["hotel","chambres"] });
      qc.invalidateQueries({ queryKey: ["hotel","reservations"] });
      toast({ title: 'Réservation créée' });
    } catch (e:any) {
      toast({ title: 'Erreur', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {/* En-tête avec bouton d'exportation amélioré */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Gestion Hôtel
              </h1>
              <p className="text-muted-foreground">
                Arrivées • Départs • États des lieux • Inventaire
              </p>
            </div>
            
            {/* Bouton d'exportation amélioré */}
            {user?.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md font-semibold group"
                >
                  {isExporting ? (
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

                {isExportOpen && (
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
                            onClick={() => exportData(option.format)}
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
                        {chambres.length} chambre(s) • {new Date().toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Chambres Occupées"
              value={`${statistiquesRapides.occupees}`}
              icon={Bed}
              variant="default"
            />
            <StatCard
              title="Chambres Disponibles"
              value={`${statistiquesRapides.disponibles}`}
              icon={UserPlus}
              variant="success"
            />
            <StatCard
              title="En Nettoyage"
              value={`${statistiquesRapides.nettoyage}`}
              icon={UserMinus}
              variant="warning"
            />
            <StatCard
              title="Maintenance"
              value={`${statistiquesRapides.maintenance}`}
              icon={AlertCircle}
              variant="warning"
            />
          </div>

          {/* Actions & Statut des Chambres */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Actions Rapides */}
            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/hotel/plan')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nouvelle Arrivée
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/hotel/plan')}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Nouveau Départ
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/room-inspection')}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  État des Lieux
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={()=>navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  Gestion Stock
                </Button>
              </CardContent>
            </Card>

            {/* Statut des Chambres */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>État des Chambres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chambres.map((chambre) => (
                    <div 
                      key={chambre.number}
                      className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Bed className="h-4 w-4 text-primary" />
                          <span className="font-semibold">Chambre {chambre.number}</span>
                        </div>
                        {getBadgeStatut(chambre.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Type: {chambre.type}</div>
                        {chambre.guest && <div>Client: {chambre.guest}</div>}
                        {chambre.checkout && <div>Départ: {chambre.checkout}</div>}
                      </div>
                      {chambre.status === "available" && (
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          variant="outline"
                          onClick={() => {
                            setChambreSelectionnee(chambre);
                            const aujourdhui = new Date();
                            const demain = new Date(Date.now() + 24*3600*1000);
                            const versYmd = (d: Date) => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
                            setNouvelleRes((r) => ({
                              ...r,
                              nomClient: '',
                              email: '',
                              telephone: '',
                              dateArrivee: versYmd(aujourdhui),
                              dateDepart: versYmd(demain),
                              tarif: 0,
                              checkinImmediat: false,
                            }));
                            setAfficherNouvelleReservation(true);
                          }}
                        >
                          Réserver
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Dialog open={afficherNouvelleReservation} onOpenChange={setAfficherNouvelleReservation}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Nouvelle Réservation — {chambreSelectionnee ? `Chambre ${chambreSelectionnee.number} • ${chambreSelectionnee.type}` : 'Sélectionner une chambre'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="nomClient">Nom du client</Label>
                  <Input id="nomClient" value={nouvelleRes.nomClient} onChange={(e)=>setNouvelleRes({...nouvelleRes, nomClient: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateArrivee">Arrivée</Label>
                    <Input id="dateArrivee" type="date" value={nouvelleRes.dateArrivee} onChange={(e)=>setNouvelleRes({...nouvelleRes, dateArrivee: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateDepart">Départ</Label>
                    <Input id="dateDepart" type="date" value={nouvelleRes.dateDepart} onChange={(e)=>setNouvelleRes({...nouvelleRes, dateDepart: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tarif">Tarif (MGA)</Label>
                    <Input min={0} id="tarif" type="number" value={nouvelleRes.tarif} onChange={(e)=>setNouvelleRes({...nouvelleRes, tarif: Number(e.target.value) || 0})} />
                  </div>
                  <div className="flex items-end space-x-2">
                    <Checkbox id="checkinImmediat" checked={nouvelleRes.checkinImmediat} onCheckedChange={(v)=>setNouvelleRes({...nouvelleRes, checkinImmediat: Boolean(v)})} />
                    <Label htmlFor="checkinImmediat">Check-in immédiat</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={nouvelleRes.email} onChange={(e)=>setNouvelleRes({...nouvelleRes, email: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input id="telephone" value={nouvelleRes.telephone} onChange={(e)=>setNouvelleRes({...nouvelleRes, telephone: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={()=>setAfficherNouvelleReservation(false)}>Annuler</Button>
                  <Button onClick={creerReservation}>Créer</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default hotel;