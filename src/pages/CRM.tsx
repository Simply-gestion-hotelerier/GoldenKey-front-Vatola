// src/pages/crm/CRM.tsx
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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("customers");
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("crmHiddenCustomers") || "[]"); } catch { return []; }
  });

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
      toast({ title: t('common.error'), description: e?.message || t('crm.loadingError'), variant: "destructive" });
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

  const exportOptions = [
    { format: 'excel', label: t('export.excel'), extension: '.xlsx', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', hoverColor: 'hover:bg-green-100', description: t('export.excelDescription') },
    { format: 'csv', label: t('export.csv'), extension: '.csv', icon: Table, color: 'text-blue-600', bgColor: 'bg-blue-50', hoverColor: 'hover:bg-blue-100', description: t('export.csvDescription') },
    { format: 'txt', label: t('export.txt'), extension: '.txt', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', hoverColor: 'hover:bg-purple-100', description: t('export.txtDescription') },
    { format: 'json', label: t('export.json'), extension: '.json', icon: FileCode, color: 'text-orange-600', bgColor: 'bg-orange-50', hoverColor: 'hover:bg-orange-100', description: t('export.jsonDescription') }
  ];

  const getSourceLabel = (source?: string) => {
    const labels: Record<string, string> = {
      hotel: t('crm.sourceHotel'),
      spa: t('crm.sourceSpa'),
      bar: t('crm.sourceBar'),
      restaurant: t('crm.sourceRestaurant')
    };
    return source ? labels[source] || source : t('common.none');
  };

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
      derniereVisite: client.lastVisit ? new Date(client.lastVisit).toLocaleDateString('fr-FR') : t('common.none'),
      source: getSourceLabel(client.source),
      notes: client.notes || ''
    }));

    const stats = {
      total: customers.length,
      totalVisits: customers.reduce((s, c) => s + (c.visitCount || 0), 0),
      totalSpent: customers.reduce((s, c) => s + (c.totalSpent || 0), 0),
      lastVisit: customers.map(c => c.lastVisit ? new Date(c.lastVisit) : null).filter(d => d).sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0]
    };

    const statistiques = {
      totalClients: stats.total,
      totalVisites: stats.totalVisits,
      depenseTotale: stats.totalSpent,
      depenseTotaleFormate: `${new Intl.NumberFormat('fr-FR').format(stats.totalSpent)} Ar`,
      derniereVisite: stats.lastVisit ? stats.lastVisit.toLocaleDateString() : t('common.none'),
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

  const exportToCSV = (data: any) => {
    let csvContent = "\uFEFF";
    csvContent += `CRM REPORT - SIMPLY HOTEL\n`;
    csvContent += `${t('common.date')}: ${data.metadata.periode}\n`;
    csvContent += `${t('export.title')}: ${data.metadata.exportDate}\n`;
    csvContent += `${t('crm.totalCustomers')}: ${data.metadata.totalClients}\n\n`;

    csvContent += `${t('crm.loyalty')}\n`;
    csvContent += `${t('crm.totalCustomers')},${data.statistiques.totalClients}\n`;
    csvContent += `${t('crm.totalVisits')},${data.statistiques.totalVisites}\n`;
    csvContent += `${t('crm.totalSpent')},${data.statistiques.depenseTotaleFormate}\n`;
    csvContent += `${t('crm.lastVisit')},${data.statistiques.derniereVisite}\n\n`;

    csvContent += `${t('crm.customers')}\n`;
    csvContent += `${t('common.name')},${t('common.email')},${t('common.phone')},${t('crm.visitCount')},${t('crm.totalSpent')},${t('crm.lastVisit')},${t('crm.source')},${t('common.notes')}\n`;
    
    data.clients.forEach((client: any) => {
      csvContent += `"${client.nomComplet}","${client.email}","${client.telephone}",${client.nombreVisites},${client.montantDepense},"${client.derniereVisite}","${client.source}","${client.notes}"\n`;
    });

    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), `crm-export-${data.metadata.periode}.csv`);
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();
    
    const syntheseData = [
      ["CRM REPORT - SIMPLY HOTEL", ""],
      [t('common.date'), data.metadata.periode],
      [t('export.title'), data.metadata.exportDate],
      [t('crm.totalCustomers'), data.metadata.totalClients],
      ["", ""],
      [t('crm.loyalty'), ""],
      [t('crm.totalCustomers'), data.statistiques.totalClients],
      [t('crm.totalVisits'), data.statistiques.totalVisites],
      [t('crm.totalSpent'), data.statistiques.depenseTotale],
      [t('crm.lastVisit'), data.statistiques.derniereVisite]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, t('crm.loyalty'));

    const clientsHeaders = [t('common.name'), t('common.email'), t('common.phone'), t('crm.visitCount'), t('crm.totalSpent'), t('crm.lastVisit'), t('crm.source'), t('common.notes')];
    const clientsData = data.clients.map((client: any) => [client.nomComplet, client.email, client.telephone, client.nombreVisites, client.montantDepense, client.derniereVisite, client.source, client.notes]);
    const clientsWorksheet = XLSX.utils.aoa_to_sheet([clientsHeaders, ...clientsData]);
    XLSX.utils.book_append_sheet(workbook, clientsWorksheet, t('crm.customers'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `crm-export-${data.metadata.periode}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const textContent = `
CRM REPORT - SIMPLY HOTEL
${"=".repeat(50)}

${t('common.date')}: ${data.metadata.periode}
${t('export.title')}: ${data.metadata.exportDate}
${t('crm.totalCustomers')}: ${data.metadata.totalClients}

${t('crm.loyalty')}
${"=".repeat(30)}
${t('crm.totalCustomers')}: ${data.statistiques.totalClients}
${t('crm.totalVisits')}: ${data.statistiques.totalVisites}
${t('crm.totalSpent')}: ${data.statistiques.depenseTotaleFormate}
${t('crm.lastVisit')}: ${data.statistiques.derniereVisite}

${t('crm.customers')}
${"=".repeat(30)}
${data.clients.map((client: any, index: number) => `
${index + 1}. ${client.nomComplet}
   ${t('common.email')}: ${client.email || t('common.none')}
   ${t('common.phone')}: ${client.telephone || t('common.none')}
   ${t('crm.visitCount')}: ${client.nombreVisites}
   ${t('crm.totalSpent')}: ${client.montantDepenseFormate}
   ${t('crm.lastVisit')}: ${client.derniereVisite}
   ${t('crm.source')}: ${client.source}
   ${t('common.notes')}: ${client.notes || t('common.none')}
`).join('\n')}
    `.trim();

    saveAs(new Blob([textContent], { type: 'text/plain;charset=utf-8' }), `crm-export-${data.metadata.periode}.txt`);
  };

  const exportToJSON = (data: any) => {
    const jsonData = {
      hotel: "Simply Hotel",
      service: "CRM",
      exportDate: new Date().toISOString(),
      period: data.metadata.periode,
      statistics: {
        totalCustomers: data.statistiques.totalClients,
        totalVisits: data.statistiques.totalVisites,
        totalSpent: data.statistiques.depenseTotale,
        lastVisit: data.statistiques.derniereVisite
      },
      customers: data.clients
    };
    saveAs(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), `crm-export-${data.metadata.periode}.json`);
  };

  const exporterCRM = async (formatType: string) => {
    if (filteredCustomers.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportCrmLoading(true);
    setExportCrmOpen(false);
    
    try {
      const data = prepareExportData();
      switch (formatType) {
        case 'csv': exportToCSV(data); break;
        case 'excel': exportToExcel(data); break;
        case 'txt': exportToTXT(data); break;
        case 'json': exportToJSON(data); break;
      }
      toast({ title: t('export.exportSuccess'), description: t('export.customersExported', { format: formatType.toUpperCase() }) });
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportCrmLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    const fullName = `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
    if (!fullName || !newCustomer.email) {
      toast({ title: t('common.error'), description: t('crm.emailRequired'), variant: "destructive" });
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
      toast({ title: t('crm.customerCreated'), description: created.fullName });
      setNewCustomer({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
      setShowNewCustomer(false);
    } catch (e: any) {
      toast({ title: t('common.error'), description: e?.message || t('crm.createError'), variant: "destructive" });
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
      toast({ title: t('crm.customerDeleted'), description: row.fullName });
    } catch (e: any) {
      toast({ title: t('common.error'), description: e?.message || t('crm.deleteError'), variant: "destructive" });
    }
  };

  const handleHide = (row: CrmCustomer) => {
    setHiddenIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    if (selectedCustomer && selectedCustomer.id === row.id) setSelectedCustomer(null);
    toast({ title: t('crm.customerHidden'), description: `${row.fullName} ${t('crm.customerHiddenMessage')}` });
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const totalVisits = customers.reduce((s, c) => s + (c.visitCount || 0), 0);
    const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);
    const last = customers.map(c => c.lastVisit ? new Date(c.lastVisit) : null).filter(d => d).sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];
    return { total, totalVisits, totalSpent, lastVisit: last ? last.toLocaleDateString() : t('common.none') };
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
                <h1 className="text-3xl font-bold text-foreground mb-2">{t('crm.title')}</h1>
                <p className="text-muted-foreground">{t('crm.subtitle')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setExportCrmOpen(!exportCrmOpen)}
                    disabled={exportCrmLoading || filteredCustomers.length === 0}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold"
                  >
                    {exportCrmLoading ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{t('export.exporting')}</span></>
                    ) : (
                      <><Download className="w-4 h-4" /><span>{t('common.export')}</span><ChevronDown className="w-4 h-4" /></>
                    )}
                  </button>

                  {exportCrmOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10">
                      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                        <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {exportOptions.map((option) => {
                          const IconComponent = option.icon;
                          return (
                            <button
                              key={option.format}
                              onClick={() => exporterCRM(option.format)}
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
                        <p className="text-xs text-gray-500 text-center">{filteredCustomers.length} {t('crm.customersFound')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('crm.newCustomer')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{t('crm.newCustomer')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">{t('crm.firstName')} *</Label>
                          <Input id="firstName" value={newCustomer.firstName} onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })} placeholder={t('crm.firstName')} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">{t('crm.lastName')} *</Label>
                          <Input id="lastName" value={newCustomer.lastName} onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })} placeholder={t('crm.lastName')} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">{t('common.email')} *</Label>
                          <Input id="email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="email@example.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t('common.phone')}</Label>
                          <Input id="phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="+261 34 12 345 67" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">{t('common.notes')}</Label>
                        <Textarea id="notes" value={newCustomer.notes} onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })} placeholder={t('common.notes')} rows={3} />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowNewCustomer(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleCreateCustomer}>{t('crm.newCustomer')}</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard title={t('crm.totalCustomers')} value={String(stats.total)} icon={Users} variant="default" />
            <StatCard title={t('crm.totalVisits')} value={String(stats.totalVisits)} icon={Calendar} variant="default" />
            <StatCard title={t('crm.totalSpent')} value={`${new Intl.NumberFormat("fr-FR").format(stats.totalSpent)} Ar`} icon={TrendingUp} variant="default" />
            <StatCard title={t('crm.lastVisit')} value={stats.lastVisit} icon={Award} variant="gold" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="customers">{t('crm.customers')}</TabsTrigger>
              <TabsTrigger value="loyalty">{t('crm.loyalty')}</TabsTrigger>
              <TabsTrigger value="marketing">{t('crm.marketing')}</TabsTrigger>
              <TabsTrigger value="analytics">{t('crm.analytics')}</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input placeholder={t('crm.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-80" />
                    </div>
                    {loading && <Badge variant="outline">{t('common.loading')}</Badge>}
                    <div className="text-sm text-muted-foreground">
                      {filteredCustomers.length} {t('crm.customersFound')}
                      {hiddenIds.length > 0 && ` (${hiddenIds.length} ${t('crm.hiddenCount')})`}
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
                          <span>{customer.visitCount} {t('crm.visitCount')}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Gift className="h-4 w-4 text-muted-foreground" />
                          <span>{new Intl.NumberFormat("fr-FR").format(customer.totalSpent)} Ar {t('crm.spent')}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                          {t('crm.viewProfile')}
                        </Button>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="ghost"><Mail className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost"><MessageSquare className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                <Trash className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{String(customer.id).startsWith("hotel:") ? t('crm.deleteConfirm') : t('crm.hideConfirm')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {String(customer.id).startsWith("hotel:") ? t('crm.deleteWarning') : t('crm.hideWarning')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(customer)}>
                                  {String(customer.id).startsWith("hotel:") ? t('common.delete') : t('crm.customerHidden')}
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
                    <DialogTitle>{t('crm.customerProfile')}</DialogTitle>
                  </DialogHeader>
                  {selectedCustomer && (
                    <div className="grid gap-2 py-2 text-sm">
                      <div className="font-semibold text-lg">{selectedCustomer.fullName}</div>
                      <div className="flex items-center space-x-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selectedCustomer.email || "—"}</span></div>
                      <div className="flex items-center space-x-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedCustomer.phone || "—"}</span></div>
                      <div className="flex items-center space-x-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{selectedCustomer.visitCount} {t('crm.visitCount')}</span></div>
                      <div className="flex items-center space-x-2"><Gift className="h-4 w-4 text-muted-foreground" /><span>{new Intl.NumberFormat("fr-FR").format(selectedCustomer.totalSpent)} Ar {t('crm.spent')}</span></div>
                      <div className="text-muted-foreground">{t('crm.lastVisit')}: {selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleString("fr-FR") : t('common.none')}</div>
                      {selectedCustomer.notes && <div className="text-muted-foreground">{t('common.notes')}: {selectedCustomer.notes}</div>}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><Gift className="mr-2 h-5 w-5 text-orange-500" />{t('crm.bronzeProgram')}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{t('crm.bronzePoints')}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><Award className="mr-2 h-5 w-5 text-yellow-500" />{t('crm.goldProgram')}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{t('crm.goldPoints')}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><Heart className="mr-2 h-5 w-5 text-primary" />{t('crm.loyalty')}</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{t('crm.loyaltyFeatures')}</p></CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="marketing" className="space-y-6">
              <Card><CardHeader><CardTitle>{t('crm.campaigns')}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{t('crm.emailingSms')}</p></CardContent></Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title={t('crm.retentionRate')} value="—" icon={Heart} variant="success" />
                <StatCard title={t('crm.averageBasket')} value="—" icon={TrendingUp} variant="default" />
                <StatCard title={t('crm.visitFrequency')} value="—" icon={Calendar} variant="default" />
                <StatCard title={t('crm.averageLtv')} value="—" icon={Award} variant="gold" />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default CRM;