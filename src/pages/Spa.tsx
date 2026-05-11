// src/pages/spa/Spa.tsx
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
import { useTranslation } from "react-i18next";

const Spa = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = new Date();
  const ymd = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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
    queryKey: ["spa", "services"],
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
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["spa", "appointments", ymd] }); 
      toast({ title: t('spa.appointmentStarted') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" })
  });
  
  const completeMut = useMutation({
    mutationFn: (id: number) => api.patch(`/spa/appointments/${id}/status`, { status: "completed" }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["spa", "appointments", ymd] }); 
      toast({ title: t('spa.appointmentCompleted') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" })
  });
  
  const noShowMut = useMutation({
    mutationFn: (id: number) => api.patch(`/spa/appointments/${id}/status`, { status: "no_show" }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["spa", "appointments", ymd] }); 
      toast({ title: t('spa.noShowRecorded') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" })
  });
  
  const payMut = useMutation({
    mutationFn: (p: { id: number; amount: number; method: 'cash' | 'card' | 'mobile' | 'bank' }) => 
      api.post(`/spa/appointments/${p.id}/pay`, { amount: p.amount, method: p.method }),
    onSuccess: () => { 
      toast({ title: t('spa.paymentRecorded'), description: t('spa.paymentRecordedDesc') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: 'destructive' })
  });
  
  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/spa/appointments/${id}`),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["spa", "appointments", ymd] }); 
      toast({ title: t('spa.appointmentDeleted') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" })
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
      qc.invalidateQueries({ queryKey: ["spa", "appointments", ymd] });
      toast({ title: t('spa.appointmentCreated') });
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" })
  });

  const stats = useMemo(() => {
    const countToday = appointments.length;
    const inProgress = appointments.filter((a: any) => a.status === 'in_progress').length;
    const completed = appointments.filter((a: any) => a.status === 'completed').length;
    const noShow = appointments.filter((a: any) => a.status === 'no_show').length;
    const totalMinutes = appointments.reduce((s: number, a: any) => s + (a.durationMin || 0), 0);
    const capacityMin = 8 * 60; // 8 hour day
    const occupancy = capacityMin ? Math.min(100, Math.round((totalMinutes / capacityMin) * 100)) : 0;
    const totalRevenue = appointments
      .filter((a: any) => a.status === 'completed')
      .reduce((s: number, a: any) => s + (a.price || 0), 0);
    
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

  // Export options
  const exportOptions = [
    { format: 'excel', label: t('export.excel'), extension: '.xlsx', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', hoverColor: 'hover:bg-green-100', description: t('export.excelDescription') },
    { format: 'csv', label: t('export.csv'), extension: '.csv', icon: Table, color: 'text-blue-600', bgColor: 'bg-blue-50', hoverColor: 'hover:bg-blue-100', description: t('export.csvDescription') },
    { format: 'txt', label: t('export.txt'), extension: '.txt', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', hoverColor: 'hover:bg-purple-100', description: t('export.txtDescription') },
    { format: 'json', label: t('export.json'), extension: '.json', icon: FileCode, color: 'text-orange-600', bgColor: 'bg-orange-50', hoverColor: 'hover:bg-orange-100', description: t('export.jsonDescription') }
  ];

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
      salle: rdv.room || t('spa.notSpecified'),
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
        hotelName: t('spa.hotelName'),
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalRDV: appointments.length
      },
      statistiques,
      rendezVous: donneesRDV
    };
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      booked: t('spa.statusBooked'),
      in_progress: t('spa.statusInProgress'),
      waiting: t('spa.statusWaiting'),
      completed: t('spa.statusCompleted'),
      no_show: t('spa.statusNoShow'),
      cancelled: t('spa.statusCancelled'),
    };
    return labels[status] || status;
  };

  const exportToCSV = (data: any) => {
    let csvContent = "\uFEFF";
    csvContent += `${t('spa.exportReport')}\n`;
    csvContent += `${t('common.period')}: ${data.metadata.periode}\n`;
    csvContent += `${t('export.title')}: ${data.metadata.exportDate}\n`;
    csvContent += `${t('spa.totalAppointments')}: ${data.metadata.totalRDV}\n\n`;

    csvContent += `${t('spa.statisticsSummary')}\n`;
    csvContent += `${t('spa.metric')},${t('spa.value')}\n`;
    csvContent += `${t('spa.totalAppointments')},${data.statistiques.rdvTotal}\n`;
    csvContent += `${t('spa.inProgress')},${data.statistiques.rdvEnCours}\n`;
    csvContent += `${t('spa.completed')},${data.statistiques.rdvTermines}\n`;
    csvContent += `${t('spa.noShow')},${data.statistiques.rdvNoShow}\n`;
    csvContent += `${t('spa.totalRevenue')},${new Intl.NumberFormat('fr-FR').format(data.statistiques.caTotal)} Ar\n`;
    csvContent += `${t('spa.occupancyRate')},${data.statistiques.tauxOccupation}%\n`;
    csvContent += `${t('spa.totalMinutes')},${data.statistiques.totalMinutes} min\n\n`;

    csvContent += `${t('spa.todaysAppointments')}\n`;
    csvContent += `${t('spa.id')},${t('spa.client')},${t('spa.service')},${t('spa.time')},${t('spa.duration')},${t('spa.price')},${t('spa.room')},${t('common.status')}\n`;
    
    data.rendezVous.forEach((rdv: any) => {
      csvContent += `${rdv.id},${rdv.client},${rdv.prestation},${rdv.heure},${rdv.duree},${rdv.prix},${rdv.salle},${rdv.statutLibelle}\n`;
    });

    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `spa-report-${data.metadata.periode}.csv`);
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();
    
    const syntheseData = [
      [t('spa.exportReport'), ""],
      [t('common.period'), data.metadata.periode],
      [t('export.title'), data.metadata.exportDate],
      [t('spa.totalAppointments'), data.metadata.totalRDV],
      ["", ""],
      [t('spa.statisticsSummary'), ""],
      [t('spa.totalAppointments'), data.statistiques.rdvTotal],
      [t('spa.inProgress'), data.statistiques.rdvEnCours],
      [t('spa.completed'), data.statistiques.rdvTermines],
      [t('spa.noShow'), data.statistiques.rdvNoShow],
      [t('spa.totalRevenue'), data.statistiques.caTotal],
      [t('spa.occupancyRate'), `${data.statistiques.tauxOccupation}%`],
      [t('spa.totalMinutes'), data.statistiques.totalMinutes]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, t('spa.summary'));

    const rdvHeaders = [t('spa.id'), t('spa.client'), t('spa.service'), t('spa.dateTime'), t('spa.durationMin'), t('spa.priceAr'), t('spa.room'), t('common.status')];
    const rdvData = data.rendezVous.map((rdv: any) => [rdv.id, rdv.client, rdv.prestation, rdv.dateHeure, rdv.duree, rdv.prix, rdv.salle, rdv.statutLibelle]);
    const rdvWorksheet = XLSX.utils.aoa_to_sheet([rdvHeaders, ...rdvData]);
    rdvWorksheet['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, rdvWorksheet, t('spa.appointments'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `spa-report-${data.metadata.periode}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const textContent = `
${t('spa.exportReport')}
${"=".repeat(50)}

${t('spa.generalInfo')}
${t('spa.establishment')}: ${data.metadata.hotelName}
${t('common.period')}: ${data.metadata.periode}
${t('export.title')}: ${data.metadata.exportDate}
${t('spa.totalAppointments')}: ${data.metadata.totalRDV}

${t('spa.statisticsSummary')}
• ${t('spa.totalAppointments')}: ${data.statistiques.rdvTotal}
• ${t('spa.inProgress')}: ${data.statistiques.rdvEnCours}
• ${t('spa.completed')}: ${data.statistiques.rdvTermines}
• ${t('spa.noShow')}: ${data.statistiques.rdvNoShow}
• ${t('spa.totalRevenue')}: ${new Intl.NumberFormat('fr-FR').format(data.statistiques.caTotal)} Ar
• ${t('spa.occupancyRate')}: ${data.statistiques.tauxOccupation}%
• ${t('spa.totalMinutes')}: ${data.statistiques.totalMinutes} min

${t('spa.todaysAppointments')} (${data.rendezVous.length})
${data.rendezVous.map((rdv: any, index: number) => `
${index + 1}. ${t('spa.appointment')} #${rdv.id}
   ${t('spa.client')}: ${rdv.client}
   ${t('spa.service')}: ${rdv.prestation}
   ${t('spa.dateTime')}: ${rdv.dateHeure}
   ${t('spa.duration')}: ${rdv.duree} min
   ${t('spa.price')}: ${rdv.prixFormate}
   ${t('spa.room')}: ${rdv.salle}
   ${t('common.status')}: ${rdv.statutLibelle}
`).join('\n')}

---
${t('spa.reportFooter')}
    `.trim();

    saveAs(new Blob([textContent], { type: 'text/plain;charset=utf-8' }), `spa-report-${data.metadata.periode}.txt`);
  };

  const exportToJSON = (data: any) => {
    const jsonData = {
      establishment: t('spa.hotelName'),
      exportDate: new Date().toISOString(),
      period: data.metadata.periode,
      totalAppointments: data.metadata.totalRDV,
      statistics: data.statistiques,
      appointments: data.rendezVous
    };
    saveAs(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), `spa-report-${data.metadata.periode}.json`);
  };

  const exporterSpa = async (formatType: string) => {
    if (appointments.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportSpaLoading(true);
    setExportSpaOpen(false);
    
    try {
      const data = prepareExportData();

      switch (formatType) {
        case 'csv': exportToCSV(data); break;
        case 'excel': exportToExcel(data); break;
        case 'txt': exportToTXT(data); break;
        case 'json': exportToJSON(data); break;
      }

      toast({ title: t('export.exportSuccess'), description: `${appointments.length} ${t('spa.appointmentsExported')} ${formatType.toUpperCase()}` });
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportSpaLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      booked: "bg-success/10 text-success border-success/20",
      in_progress: "bg-primary/10 text-primary border-primary/20",
      waiting: "bg-warning/10 text-warning border-warning/20",
      completed: "bg-muted text-muted-foreground border-muted",
      no_show: "bg-warning/20 text-warning border-warning/30",
      cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    };

    const labels: Record<string, string> = {
      booked: t('spa.statusBooked'),
      in_progress: t('spa.statusInProgress'),
      waiting: t('spa.statusWaiting'),
      completed: t('spa.statusCompleted'),
      no_show: t('spa.statusNoShow'),
      cancelled: t('spa.statusCancelled'),
    };

    return (
      <Badge variant="outline" className={styles[status] || styles.booked}>
        {labels[status] || status}
      </Badge>
    );
  };
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {/* Header avec bouton d'exportation */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {t('nav.spa')}
              </h1>
              <p className="text-muted-foreground">
                {t('spa.subtitle')}
              </p>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setExportSpaOpen(!exportSpaOpen)}
                disabled={exportSpaLoading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold group"
              >
                {exportSpaLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{t('export.exporting')}</span></>
                ) : (
                  <><Download className="w-4 h-4 group-hover:scale-110 transition-transform" /><span>{t('common.export')}</span><ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" /></>
                )}
              </button>

              {exportSpaOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10">
                  <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                    <p className="text-xs text-blue-600 mt-1">{t('spa.chooseFormat')}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {exportOptions.map((option) => {
                      const IconComponent = option.icon;
                      return (
                        <button
                          key={option.format}
                          onClick={() => exporterSpa(option.format)}
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
                    <p className="text-xs text-gray-500 text-center">{appointments.length} {t('spa.appointments')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title={t('spa.todaysAppointments')} value={stats.countToday} icon={Calendar} variant="default" />
            <StatCard title={t('spa.inProgress')} value={stats.inProgress} icon={Clock} variant="default" />
            <StatCard title={t('spa.dailyRevenue')} value={`${Math.round((revenue?.total || 0)).toLocaleString('fr-FR')} Ar`} icon={DollarSign} variant="gold" />
            <StatCard title={t('spa.occupancyRate')} value={`${stats.occupancy}%`} icon={CheckCircle} variant="success" />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>{t('spa.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => setShowNew(true)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {t('spa.newAppointment')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/spa/agenda')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('spa.clientFile')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />
                  {t('spa.productInventory')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/cash')}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t('spa.cashRegister')}
                </Button>
              </CardContent>
            </Card>

            {/* Today's Appointments */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {t('spa.todaysSchedule')} ({appointments.length} {t('spa.appointments')})
                  {appointments.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      {stats.inProgress} {t('spa.inProgress').toLowerCase()}, {stats.completed} {t('spa.completed').toLowerCase()}
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
                          <div>{a.serviceName}{a.room ? ` • ${t('spa.room')}: ${a.room}` : ''}</div>
                          <div>{t('spa.duration')}: {a.durationMin} min</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gold">{`${(a.price || 0).toLocaleString('fr-FR')} Ar`}</span>
                          <div className="flex items-center space-x-2">
                            {a.status === "waiting" && (
                              <Button size="sm" variant="outline" onClick={() => startMut.mutate(a.id)}>
                                {t('spa.start')}
                              </Button>
                            )}
                            {a.status === "in_progress" && (
                              <Button size="sm" variant="outline" onClick={() => completeMut.mutate(a.id)}>
                                {t('spa.complete')}
                              </Button>
                            )}
                            {a.status === "booked" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => startMut.mutate(a.id)}>
                                  {t('spa.start')}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => noShowMut.mutate(a.id)}>
                                  {t('spa.noShow')}
                                </Button>
                              </>
                            )}
                            {(a.status === "in_progress" || a.status === "completed") && (
                              <Button size="sm" variant="outline" onClick={() => payMut.mutate({ id: a.id, amount: a.price || 0, method: 'cash' })}>
                                {t('spa.collect')}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setShowDetails({ open: true, app: a })}>
                              {t('spa.details')}
                            </Button>
                            {((['completed', 'cancelled', 'no_show'] as const).includes(a.status) || (new Date(a.start).getTime() + (a.durationMin || 0) * 60000) < Date.now()) && (
                              <Button size="sm" variant="destructive" onClick={() => {
                                if (confirm(t('spa.deleteConfirm'))) deleteMut.mutate(a.id);
                              }}>
                                <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
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

          {/* New Appointment Dialog */}
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{t('spa.newAppointment')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">{t('spa.client')}</Label>
                  <Input id="clientName" value={newApp.clientName} onChange={(e) => setNewApp({ ...newApp, clientName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceName">{t('spa.service')}</Label>
                  {services.length ? (
                    <Select onValueChange={(id) => {
                      const s = services.find((x: any) => String(x.id) === id);
                      if (s) setNewApp({ ...newApp, serviceName: s.name, durationMin: s.durationMin, price: s.salePrice });
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={newApp.serviceName || t('spa.selectService')} />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} • {s.salePrice.toLocaleString('fr-FR')} Ar
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input id="serviceName" value={newApp.serviceName} onChange={(e) => setNewApp({ ...newApp, serviceName: e.target.value })} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">{t('spa.dateTime')}</Label>
                    <Input id="start" type="datetime-local" value={newApp.start} onChange={(e) => setNewApp({ ...newApp, start: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">{t('spa.durationMin')}</Label>
                    <Input min={0} id="duration" type="number" value={newApp.durationMin} onChange={(e) => setNewApp({ ...newApp, durationMin: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">{t('spa.priceAr')}</Label>
                    <Input min={0} id="price" type="number" value={newApp.price} onChange={(e) => setNewApp({ ...newApp, price: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="room">{t('spa.room')}</Label>
                    <Input id="room" value={newApp.room} onChange={(e) => setNewApp({ ...newApp, room: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNew(false)}>{t('common.cancel')}</Button>
                  <Button onClick={() => createMut.mutate()} disabled={!newApp.clientName || !newApp.serviceName || !newApp.start || !newApp.durationMin || !newApp.price}>
                    {t('spa.create')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Details Dialog */}
          <Dialog open={showDetails.open} onOpenChange={(o) => setShowDetails(({ app }) => ({ open: o, app }))}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('spa.clientFile')}</DialogTitle>
              </DialogHeader>
              {showDetails.app && (
                <div className="grid gap-2 py-2 text-sm">
                  <div className="font-semibold text-lg">{showDetails.app.clientName}</div>
                  <div>{t('spa.service')}: {showDetails.app.serviceName}</div>
                  <div>{t('spa.date')}: {new Date(showDetails.app.start).toLocaleString('fr-FR')}</div>
                  <div>{t('spa.duration')}: {showDetails.app.durationMin} min</div>
                  {showDetails.app.room && <div>{t('spa.room')}: {showDetails.app.room}</div>}
                  <div>{t('spa.price')}: {(showDetails.app.price || 0).toLocaleString('fr-FR')} Ar</div>
                  <div>{t('common.status')}: {getStatusBadge(showDetails.app.status)}</div>
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