import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Users,
  Gift,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Heart,
  Award,
  Plus,
  Search,
  MessageSquare,
  Download,
  ChevronDown,
  FileText,
  Table,
  FileCode,
  File,
  FileSpreadsheet
} from "lucide-react";
import { Trash } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface CrmCustomer {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  visitCount: number;
  lastVisit?: string | null;
  totalSpent: number;
  source?: "hotel" | "spa" | "bar" | "restaurant";
}

const CRM = () => {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("customers");
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("crmHiddenCustomers") || "[]"); } catch { return []; }
  });

  // États pour l'exportation améliorée
  const [exportCrmOpen, setExportCrmOpen] = useState(false);
  const [exportCrmLoading, setExportCrmLoading] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<CrmCustomer[]>("/crm/customers");
      setCustomers(data);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible de charger les clients", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try { localStorage.setItem("crmHiddenCustomers", JSON.stringify(hiddenIds)); } catch {}
  }, [hiddenIds]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = !term ? customers : customers.filter((c) =>
      c.fullName.toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term) ||
      String(c.id).toLowerCase().includes(term)
    );
    return base.filter((c) => !hiddenIds.includes(c.id));
  }, [customers, searchTerm, hiddenIds]);

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
    
    const donneesClients = filteredCustomers.map((client: CrmCustomer) => ({
      id: client.id,
      nomComplet: client.fullName,
      email: client.email || '',
      telephone: client.phone || '',
      nombreVisites: client.visitCount,
      montantDepense: client.totalSpent,
      montantDepenseFormate: `${new Intl.NumberFormat('fr-FR').format(client.totalSpent)} Ar`,
      derniereVisite: client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('fr-FR') : 'Jamais',
      source: client.source || 'Non spécifiée',
      notes: client.notes || ''
    }));

    const stats = useMemo(() => {
      const total = customers.length;
      const totalVisits = customers.reduce((s, c) => s + (c.visitCount || 0), 0);
      const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);
      const last = customers
        .map((c) => (c.lastVisit ? new Date(c.lastVisit) : null))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return { total, totalVisits, totalSpent, lastVisit: last ? last.toLocaleDateString() : "—" };
    }, [customers]);

    const statistiques = {
      totalClients: stats.total,
      totalVisites: stats.totalVisits,
      depenseTotale: stats.totalSpent,
      depenseTotaleFormate: `${new Intl.NumberFormat('fr-FR').format(stats.totalSpent)} Ar`,
      derniereVisite: stats.lastVisit,
      clientsMasques: hiddenIds.length,
      dateExport: new Date().toLocaleString('fr-FR')
    };

    return {
      metadata: {
        hotelName: "Simply Hotel - CRM",
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalClients: filteredCustomers.length
      },
      statistiques,
      clients: donneesClients
    };
  };

  // Export CSV avec séparateurs espaces
  const exportToCSV = (data: any) => {
    const csvContent = generateCSVContent(data);
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    saveAs(blob, `rapport-crm-${data.metadata.periode}.csv`);
  };

  const generateCSVContent = (data: any): string => {
    let csvContent = "\uFEFF"; // BOM UTF-8
    
    // En-tête du rapport
    csvContent += "RAPPORT CRM - SIMPLY HOTEL\n";
    csvContent += `Période: ${data.metadata.periode}\n`;
    csvContent += `Exporté le: ${data.metadata.exportDate}\n`;
    csvContent += `Total clients: ${data.metadata.totalClients}\n\n`;

    // Section statistiques avec séparateur espace
    csvContent += "SYNTHÈSE DES STATISTIQUES\n";
    csvContent += "Métrique          Valeur\n";
    csvContent += `Total clients     ${data.statistiques.totalClients}\n`;
    csvContent += `Total visites     ${data.statistiques.totalVisites}\n`;
    csvContent += `Dépense totale    ${data.statistiques.depenseTotaleFormate}\n`;
    csvContent += `Dernière visite   ${data.statistiques.derniereVisite}\n`;
    csvContent += `Clients masqués   ${data.statistiques.clientsMasques}\n\n`;

    // Section clients avec formatage aligné
    csvContent += "BASE CLIENTS\n";
    csvContent += "ID        Nom Complet              Email                   Téléphone      Visites  Dépensé (Ar)    Dernière Visite  Source          Notes\n";
    
    data.clients.forEach((client: any) => {
      const ligne = [
        client.id.toString().padEnd(9),
        client.nomComplet.padEnd(24),
        (client.email || '').padEnd(22),
        (client.telephone || '').padEnd(14),
        client.nombreVisites.toString().padEnd(8),
        new Intl.NumberFormat('fr-FR').format(client.montantDepense).padEnd(15),
        client.derniereVisite.padEnd(16),
        client.source.padEnd(14),
        (client.notes || '').substring(0, 30)
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
      ["RAPPORT CRM - SIMPLY HOTEL", ""],
      ["Période", data.metadata.periode],
      ["Exporté le", data.metadata.exportDate],
      ["Total clients", data.metadata.totalClients],
      ["", ""],
      ["SYNTHÈSE DES STATISTIQUES", ""],
      ["Total clients", data.statistiques.totalClients],
      ["Total visites", data.statistiques.totalVisites],
      ["Dépense totale", data.statistiques.depenseTotale],
      ["Dernière visite", data.statistiques.derniereVisite],
      ["Clients masqués", data.statistiques.clientsMasques]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, "Synthèse");

    // Feuille des clients
    const clientsHeaders = ["ID", "Nom Complet", "Email", "Téléphone", "Nombre Visites", "Montant Dépensé (Ar)", "Dernière Visite", "Source", "Notes"];
    const clientsData = data.clients.map((client: any) => [
      client.id,
      client.nomComplet,
      client.email,
      client.telephone,
      client.nombreVisites,
      client.montantDepense,
      client.derniereVisite,
      client.source,
      client.notes
    ]);

    const clientsWorksheet = XLSX.utils.aoa_to_sheet([clientsHeaders, ...clientsData]);
    clientsWorksheet['!cols'] = [
      { wch: 12 },  // ID
      { wch: 25 },  // Nom Complet
      { wch: 25 },  // Email
      { wch: 15 },  // Téléphone
      { wch: 12 },  // Nombre Visites
      { wch: 15 },  // Montant Dépensé
      { wch: 15 },  // Dernière Visite
      { wch: 12 },  // Source
      { wch: 30 }   // Notes
    ];
    XLSX.utils.book_append_sheet(workbook, clientsWorksheet, "Clients");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `rapport-crm-${data.metadata.periode}.xlsx`);
  };

  // Export TXT amélioré
  const exportToTXT = (data: any) => {
    const textContent = `
RAPPORT CRM - SIMPLY HOTEL
===========================

INFORMATIONS GÉNÉRALES
-----------------------
Hôtel : ${data.metadata.hotelName}
Période : ${data.metadata.periode}
Exporté le : ${data.metadata.exportDate}
Total clients : ${data.metadata.totalClients}

SYNTHÈSE DES STATISTIQUES
-------------------------
• Total clients : ${data.statistiques.totalClients}
• Total visites : ${data.statistiques.totalVisites}
• Dépense totale : ${data.statistiques.depenseTotaleFormate}
• Dernière visite : ${data.statistiques.derniereVisite}
• Clients masqués : ${data.statistiques.clientsMasques}

BASE CLIENTS (${data.clients.length})
=====================================
${data.clients.map((client: any, index: number) => `
${index + 1}. ${client.nomComplet}
    ID: ${client.id}
    Email: ${client.email || 'Non renseigné'}
    Téléphone: ${client.telephone || 'Non renseigné'}
    Visites: ${client.nombreVisites}
    Dépensé: ${client.montantDepenseFormate}
    Dernière visite: ${client.derniereVisite}
    Source: ${client.source}
    ${client.notes ? `Notes: ${client.notes}` : ''}
`).join('\n')}

---
Rapport généré automatiquement par Simply Hotel CRM
Système de gestion de la relation client
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `rapport-crm-${data.metadata.periode}.txt`);
  };

  // Export JSON amélioré
  const exportToJSON = (data: any) => {
    const jsonData = {
      entreprise: "Simply Hotel",
      service: "CRM & Relation Client",
      dateExport: new Date().toISOString(),
      periode: data.metadata.periode,
      totalClients: data.metadata.totalClients,
      statistiques: {
        totalClients: data.statistiques.totalClients,
        totalVisites: data.statistiques.totalVisites,
        depenseTotale: data.statistiques.depenseTotale,
        derniereVisite: data.statistiques.derniereVisite,
        clientsMasques: data.statistiques.clientsMasques
      },
      clients: data.clients
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
      type: 'application/json;charset=utf-8' 
    });
    saveAs(blob, `rapport-crm-${data.metadata.periode}.json`);
  };

  // Gestion de l'export améliorée
  const exporterCRM = async (formatType: string) => {
    if (filteredCustomers.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Il n'y a aucun client à exporter",
        variant: "destructive"
      });
      return;
    }

    setExportCrmLoading(true);
    setExportCrmOpen(false);
    
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
        description: `${data.metadata.totalClients} client(s) exporté(s) en ${formatType.toUpperCase()}`
      });
    } catch (erreur) {
      console.error('Erreur lors de l\'export:', erreur);
      toast({
        title: 'Erreur exportation',
        description: String(erreur),
        variant: 'destructive'
      });
    } finally {
      setExportCrmLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    const fullName = `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
    if (!fullName || !newCustomer.email) {
      toast({ title: "Champs manquants", description: "Nom complet et email requis", variant: "destructive" });
      return;
    }
    try {
      const created = await api.post<CrmCustomer>("/crm/customers", {
        fullName,
        email: newCustomer.email || undefined,
        phone: newCustomer.phone || undefined,
        notes: newCustomer.notes || undefined,
      });
      setCustomers((prev) => [created, ...prev]);
      toast({ title: "Client créé", description: created.fullName });
      setNewCustomer({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
      setShowNewCustomer(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible de créer le client", variant: "destructive" });
    }
  };

  const handleDelete = async (row: CrmCustomer) => {
    const idStr = String(row.id);
    if (!idStr.startsWith("hotel:")) {
      handleHide(row);
      return;
    }
    const idNum = Number(idStr.split(":")[1]);
    try {
      await api.del<void>(`/hotel/guests/${idNum}`);
      setCustomers((prev) => prev.filter((c) => c.id !== row.id));
      if (selectedCustomer && selectedCustomer.id === row.id) setSelectedCustomer(null);
      toast({ title: "Client supprimé", description: row.fullName });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible de supprimer le client", variant: "destructive" });
    }
  };

  const handleHide = (row: CrmCustomer) => {
    setHiddenIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    if (selectedCustomer && selectedCustomer.id === row.id) setSelectedCustomer(null);
    toast({ title: "Masqué", description: `${row.fullName} est masqué dans le CRM` });
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const totalVisits = customers.reduce((s, c) => s + (c.visitCount || 0), 0);
    const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);
    const last = customers
      .map((c) => (c.lastVisit ? new Date(c.lastVisit) : null))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return { total, totalVisits, totalSpent, lastVisit: last ? last.toLocaleDateString() : "—" };
  }, [customers]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">CRM & Relation Client</h1>
                <p className="text-muted-foreground">Base clients • Séjours • Communications</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Bouton d'exportation amélioré */}
                <div className="relative">
                  <button
                    onClick={() => setExportCrmOpen(!exportCrmOpen)}
                    disabled={exportCrmLoading || filteredCustomers.length === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-md font-semibold group"
                  >
                    {exportCrmLoading ? (
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

                  {exportCrmOpen && (
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
                              onClick={() => exporterCRM(option.format)}
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
                          {filteredCustomers.length} client(s) • {new Date().toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary">
                      <Plus className="mr-2 h-4 w-4" />
                      Nouveau Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Créer un Nouveau Client</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Prénom *</Label>
                          <Input id="firstName" value={newCustomer.firstName} onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })} placeholder="Prénom" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Nom *</Label>
                          <Input id="lastName" value={newCustomer.lastName} onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })} placeholder="Nom de famille" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input id="email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="email@exemple.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Téléphone</Label>
                          <Input id="phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+261 34 12 345 67" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" value={newCustomer.notes} onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })} placeholder="Préférences, historique, informations importantes..." rows={3} />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowNewCustomer(false)}>Annuler</Button>
                        <Button onClick={handleCreateCustomer}>Créer le Client</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard title="Total Clients" value={String(stats.total)} icon={Users} variant="default" />
            <StatCard title="Total Séjours" value={String(stats.totalVisits)} icon={Calendar} variant="default" />
            <StatCard title="Dépense Totale" value={`${new Intl.NumberFormat("fr-FR").format(stats.totalSpent)} Ar`} icon={TrendingUp} variant="default" />
            <StatCard title="Dernière visite" value={stats.lastVisit} icon={Award} variant="gold" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="customers">Clients</TabsTrigger>
              <TabsTrigger value="loyalty">Fidélité</TabsTrigger>
              <TabsTrigger value="marketing">Marketing</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Rechercher par nom, email ou ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-80" />
                    </div>
                    {loading && <Badge variant="outline">Chargement…</Badge>}
                    <div className="text-sm text-muted-foreground">
                      {filteredCustomers.length} client{filteredCustomers.length > 1 ? 's' : ''} trouvé{filteredCustomers.length > 1 ? 's' : ''}
                      {hiddenIds.length > 0 && ` (${hiddenIds.length} masqué${hiddenIds.length > 1 ? 's' : ''})`}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="hover:shadow-elegant transition-all duration-200">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Users className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{customer.fullName}</CardTitle>
                            <p className="text-sm text-muted-foreground">ID: {customer.id}</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{customer.email || "—"}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.phone || "—"}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{customer.visitCount} séjour(s)</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Gift className="h-4 w-4 text-muted-foreground" />
                          <span>{new Intl.NumberFormat("fr-FR").format(customer.totalSpent)} Ar dépensés</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                          Voir Profil
                        </Button>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="ghost">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                <Trash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{String(customer.id).startsWith("hotel:") ? "Supprimer ce client ?" : "Masquer ce client ?"}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {String(customer.id).startsWith("hotel:")
                                    ? "Cette action est irréversible. Le client sera définitivement supprimé."
                                    : "Ce client sera masqué dans la vue CRM. Les données sources ne seront pas supprimées."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(customer)}>
                                  {String(customer.id).startsWith("hotel:") ? "Supprimer" : "Masquer"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Dialog open={!!selectedCustomer} onOpenChange={(o) => { if (!o) setSelectedCustomer(null); }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Profil Client</DialogTitle>
                  </DialogHeader>
                  {selectedCustomer && (
                    <div className="grid gap-2 py-2 text-sm">
                      <div className="font-semibold text-lg">{selectedCustomer.fullName}</div>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedCustomer.email || "—"}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedCustomer.phone || "—"}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedCustomer.visitCount} séjour(s)</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Gift className="h-4 w-4 text-muted-foreground" />
                        <span>{new Intl.NumberFormat("fr-FR").format(selectedCustomer.totalSpent)} Ar dépensés</span>
                      </div>
                      <div className="text-muted-foreground">
                        Dernière visite: {selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleString("fr-FR") : "—"}
                      </div>
                      {selectedCustomer.notes ? (
                        <div className="text-muted-foreground">Notes: {selectedCustomer.notes}</div>
                      ) : null}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Gift className="mr-2 h-5 w-5 text-orange-500" />
                      Programme Bronze
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">0 - 999 points</p>
                      <div className="text-2xl font-bold">—</div>
                      <p className="text-xs text-muted-foreground">membres actifs</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Award className="mr-2 h-5 w-5 text-yellow-500" />
                      Programme Gold
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">2500+ points</p>
                      <div className="text-2xl font-bold">—</div>
                      <p className="text-xs text-muted-foreground">membres actifs</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Heart className="mr-2 h-5 w-5 text-primary" />
                      Fidélisation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Fonctionnalités avancées à venir</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="marketing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campagnes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Intégration emailing/SMS à configurer</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Taux de fidélisation" value="—" icon={Heart} trend={{ value: 0, isPositive: true }} variant="success" />
                <StatCard title="Panier moyen" value="—" icon={TrendingUp} trend={{ value: 0, isPositive: true }} variant="default" />
                <StatCard title="Fréquence de visite" value="—" icon={Calendar} trend={{ value: 0, isPositive: true }} variant="default" />
                <StatCard title="LTV moyen" value="—" icon={Award} trend={{ value: 0, isPositive: true }} variant="gold" />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default CRM;