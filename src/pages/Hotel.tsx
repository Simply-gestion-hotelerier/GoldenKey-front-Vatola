// src/pages/hotel/Hotel.tsx
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
import { useTranslation } from "react-i18next";

const Hotel = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: chambres = [] } = useQuery({ 
    queryKey: ["hotel", "chambres"], 
    queryFn: () => api.get<any[]>("/hotel/rooms") 
  });

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getBadgeStatut = (statut: string) => {
    const styles = {
      occupied: "bg-destructive/10 text-destructive border-destructive/20",
      available: "bg-success/10 text-success border-success/20",
      cleaning: "bg-warning/10 text-warning border-warning/20",
      maintenance: "bg-muted text-muted-foreground border-muted",
      out_of_order: "bg-muted text-muted-foreground border-muted",
    } as Record<string, string>;

    const libelles: Record<string, string> = {
      occupied: t('hotel.statusOccupied'),
      available: t('hotel.statusAvailable'),
      cleaning: t('hotel.statusCleaning'),
      maintenance: t('hotel.statusMaintenance'),
      out_of_order: t('hotel.statusOutOfOrder'),
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
      const demain = new Date(maintenant.getTime() + 24 * 3600 * 1000);
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
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["hotel", "chambres"] }); 
      toast({ title: t('common.success') }); 
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: 'destructive' }),
  });

  const statistiquesRapides = {
    occupees: chambres.filter((r: any) => r.status === 'occupied').length,
    disponibles: chambres.filter((r: any) => r.status === 'available').length,
    nettoyage: chambres.filter((r: any) => r.status === 'cleaning').length,
    maintenance: chambres.filter((r: any) => r.status === 'maintenance' || r.status === 'out_of_order').length,
    total: chambres.length
  };

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

  const exportOptions = [
    { format: 'excel', label: t('export.excel'), extension: '.xlsx', icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50', hoverColor: 'hover:bg-green-100', description: t('export.excelDescription') },
    { format: 'csv', label: t('export.csv'), extension: '.csv', icon: Table, color: 'text-blue-600', bgColor: 'bg-blue-50', hoverColor: 'hover:bg-blue-100', description: t('export.csvDescription') },
    { format: 'txt', label: t('export.txt'), extension: '.txt', icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-50', hoverColor: 'hover:bg-purple-100', description: t('export.txtDescription') },
    { format: 'json', label: t('export.json'), extension: '.json', icon: FileCode, color: 'text-orange-600', bgColor: 'bg-orange-50', hoverColor: 'hover:bg-orange-100', description: t('export.jsonDescription') }
  ];

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
      occupied: t('hotel.statusOccupied'),
      available: t('hotel.statusAvailable'),
      cleaning: t('hotel.statusCleaning'),
      maintenance: t('hotel.statusMaintenance'),
      out_of_order: t('hotel.statusOutOfOrder')
    };
    return labels[status] || status;
  };

  const exportToCSV = (data: any) => {
    let csvContent = "\uFEFF";
    csvContent += `HOTEL MANAGEMENT REPORT - SIMPLY HOTEL\n`;
    csvContent += `${t('common.date')}: ${data.metadata.periode}\n`;
    csvContent += `${t('export.title')}: ${data.metadata.exportDate}\n`;
    csvContent += `${t('common.user')}: ${data.metadata.exportPar}\n`;
    csvContent += `${t('hotel.totalRooms')}: ${data.metadata.totalChambres}\n\n`;

    csvContent += `${t('common.status')}\n`;
    csvContent += `${t('hotel.occupiedRooms')},${data.statistiques.occupees}\n`;
    csvContent += `${t('hotel.availableRooms')},${data.statistiques.disponibles}\n`;
    csvContent += `${t('hotel.cleaning')},${data.statistiques.nettoyage}\n`;
    csvContent += `${t('hotel.maintenance')},${data.statistiques.maintenance}\n`;
    csvContent += `${t('hotel.occupancyRate')},${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%\n\n`;

    csvContent += `${t('hotel.roomStatus')}\n`;
    csvContent += `${t('hotel.room')},${t('hotel.type')},${t('common.status')},${t('common.price')},${t('common.capacity')}\n`;

    data.chambres.forEach((chambre: any) => {
      csvContent += `${chambre.numero},${chambre.type},${chambre.statut},${chambre.prix},${chambre.capacite}\n`;
    });

    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), `hotel-export-${data.metadata.periode}.csv`);
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();

    const syntheseData = [
      ["HOTEL MANAGEMENT REPORT - SIMPLY HOTEL", ""],
      [t('common.date'), data.metadata.periode],
      [t('export.title'), data.metadata.exportDate],
      [t('common.user'), data.metadata.exportPar],
      [t('hotel.totalRooms'), data.metadata.totalChambres],
      ["", ""],
      [t('common.status'), ""],
      [t('hotel.occupiedRooms'), data.statistiques.occupees],
      [t('hotel.availableRooms'), data.statistiques.disponibles],
      [t('hotel.cleaning'), data.statistiques.nettoyage],
      [t('hotel.maintenance'), data.statistiques.maintenance],
      [t('hotel.occupancyRate'), `${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%`]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, t('common.status'));

    const detailsHeaders = [t('hotel.room'), t('hotel.type'), t('common.status'), t('common.price'), t('common.capacity')];
    const detailsData = data.chambres.map((chambre: any) => [chambre.numero, chambre.type, chambre.statut, chambre.prix, chambre.capacite]);
    const detailsWorksheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsData]);
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, t('hotel.rooms'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `hotel-export-${data.metadata.periode}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const textContent = `
HOTEL MANAGEMENT REPORT - SIMPLY HOTEL
${"=".repeat(50)}

${t('common.date')}: ${data.metadata.periode}
${t('export.title')}: ${data.metadata.exportDate}
${t('common.user')}: ${data.metadata.exportPar}
${t('hotel.totalRooms')}: ${data.metadata.totalChambres}

${t('common.status')}
${t('hotel.occupiedRooms')}: ${data.statistiques.occupees}
${t('hotel.availableRooms')}: ${data.statistiques.disponibles}
${t('hotel.cleaning')}: ${data.statistiques.nettoyage}
${t('hotel.maintenance')}: ${data.statistiques.maintenance}
${t('hotel.occupancyRate')}: ${data.metadata.totalChambres > 0 ? Math.round((data.statistiques.occupees / data.metadata.totalChambres) * 100) : 0}%

${t('hotel.rooms')}
${data.chambres.map((chambre: any, index: number) => `
${index + 1}. ${t('hotel.room')} ${chambre.numero}
   ${t('hotel.type')}: ${chambre.type}
   ${t('common.status')}: ${chambre.statut}
   ${t('common.price')}: ${new Intl.NumberFormat('fr-FR').format(chambre.prix)} Ar
   ${t('common.capacity')}: ${chambre.capacite} ${t('common.people')}
`).join('\n')}
    `.trim();

    saveAs(new Blob([textContent], { type: 'text/plain;charset=utf-8' }), `hotel-export-${data.metadata.periode}.txt`);
  };

  const exportToJSON = (data: any) => {
    const jsonData = {
      hotel: "Simply Hotel",
      exportDate: new Date().toISOString(),
      period: data.metadata.periode,
      exportedBy: data.metadata.exportPar,
      statistics: data.statistiques,
      rooms: data.chambres
    };
    saveAs(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), `hotel-export-${data.metadata.periode}.json`);
  };

  const exportData = async (format: string) => {
    if (chambres.length === 0) {
      toast({ title: t('hotel.noDataToExport'), variant: "destructive" });
      return;
    }

    setIsExporting(true);
    setIsExportOpen(false);

    try {
      const data = prepareExportData();
      switch (format) {
        case 'csv': exportToCSV(data); break;
        case 'excel': exportToExcel(data); break;
        case 'txt': exportToTXT(data); break;
        case 'json': exportToJSON(data); break;
      }
      toast({ title: t('hotel.exportSuccess'), description: `${chambres.length} ${t('hotel.rooms')} ${t('export.exportSuccess')}` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: t('hotel.exportError'), description: String(error), variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const creerReservation = async () => {
    try {
      if (!chambreSelectionnee?.id) {
        toast({ title: t('common.error'), description: t('hotel.selectRoom'), variant: 'destructive' });
        return;
      }
      if (!nouvelleRes.nomClient || !nouvelleRes.dateArrivee || !nouvelleRes.dateDepart || !nouvelleRes.tarif) {
        toast({ title: t('common.error'), description: t('common.required'), variant: 'destructive' });
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
      qc.invalidateQueries({ queryKey: ["hotel", "chambres"] });
      qc.invalidateQueries({ queryKey: ["hotel", "reservations"] });
      toast({ title: t('common.success') });
    } catch (e: any) {
      toast({ title: t('common.error'), description: String(e), variant: 'destructive' });
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
              <h1 className="text-3xl font-bold text-foreground mb-2">{t('hotel.title')}</h1>
              <p className="text-muted-foreground">{t('hotel.subtitle')}</p>
            </div>

            {user?.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold group"
                >
                  {isExporting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{t('export.exporting')}</span></>
                  ) : (
                    <><Download className="w-4 h-4 group-hover:scale-110 transition-transform" /><span>{t('common.export')}</span><ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" /></>
                  )}
                </button>

                {isExportOpen && (
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
                            onClick={() => exportData(option.format)}
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
                      <p className="text-xs text-gray-500 text-center">{chambres.length} {t('hotel.rooms')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard title={t('hotel.occupiedRooms')} value={`${statistiquesRapides.occupees}`} icon={Bed} variant="default" />
            <StatCard title={t('hotel.availableRooms')} value={`${statistiquesRapides.disponibles}`} icon={UserPlus} variant="success" />
            <StatCard title={t('hotel.cleaning')} value={`${statistiquesRapides.nettoyage}`} icon={UserMinus} variant="warning" />
            <StatCard title={t('hotel.maintenance')} value={`${statistiquesRapides.maintenance}`} icon={AlertCircle} variant="warning" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader><CardTitle>{t('hotel.quickActions')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/hotel/plan')}>
                  <UserPlus className="mr-2 h-4 w-4" />{t('hotel.newArrival')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/hotel/plan')}>
                  <UserMinus className="mr-2 h-4 w-4" />{t('hotel.newDeparture')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/room-inspection')}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />{t('hotel.roomInspection')}
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/inventory')}>
                  <Package className="mr-2 h-4 w-4" />{t('hotel.stockManagement')}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>{t('hotel.roomStatus')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {chambres.map((chambre) => (
                    <div key={chambre.number} className="p-4 border border-border rounded-lg hover:shadow-elegant transition-all duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Bed className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{t('hotel.room')} {chambre.number}</span>
                        </div>
                        {getBadgeStatut(chambre.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>{t('hotel.type')}: {chambre.type}</div>
                        {chambre.guest && <div>{t('hotel.guest')}: {chambre.guest}</div>}
                        {chambre.checkout && <div>{t('hotel.departure')}: {chambre.checkout}</div>}
                      </div>
                      {chambre.status === "available" && (
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          variant="outline"
                          onClick={() => {
                            setChambreSelectionnee(chambre);
                            const aujourdhui = new Date();
                            const demain = new Date(Date.now() + 24 * 3600 * 1000);
                            const versYmd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
                          {t('hotel.book')}
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
                <DialogTitle>{t('hotel.newReservation')} — {chambreSelectionnee ? `${t('hotel.roomNumber', { number: chambreSelectionnee.number })} • ${chambreSelectionnee.type}` : t('hotel.selectRoom')}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="nomClient">{t('hotel.guestName')}</Label>
                  <Input id="nomClient" value={nouvelleRes.nomClient} onChange={(e) => setNouvelleRes({ ...nouvelleRes, nomClient: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateArrivee">{t('hotel.arrivalDate')}</Label>
                    <Input id="dateArrivee" type="date" value={nouvelleRes.dateArrivee} onChange={(e) => setNouvelleRes({ ...nouvelleRes, dateArrivee: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateDepart">{t('hotel.departureDate')}</Label>
                    <Input id="dateDepart" type="date" value={nouvelleRes.dateDepart} onChange={(e) => setNouvelleRes({ ...nouvelleRes, dateDepart: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tarif">{t('hotel.rate')}</Label>
                    <Input min={0} id="tarif" type="number" value={nouvelleRes.tarif} onChange={(e) => setNouvelleRes({ ...nouvelleRes, tarif: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-end space-x-2">
                    <Checkbox id="checkinImmediat" checked={nouvelleRes.checkinImmediat} onCheckedChange={(v) => setNouvelleRes({ ...nouvelleRes, checkinImmediat: Boolean(v) })} />
                    <Label htmlFor="checkinImmediat">{t('hotel.immediateCheckin')}</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('common.email')}</Label>
                    <Input id="email" type="email" value={nouvelleRes.email} onChange={(e) => setNouvelleRes({ ...nouvelleRes, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">{t('common.phone')}</Label>
                    <Input id="telephone" value={nouvelleRes.telephone} onChange={(e) => setNouvelleRes({ ...nouvelleRes, telephone: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAfficherNouvelleReservation(false)}>{t('common.cancel')}</Button>
                  <Button onClick={creerReservation}>{t('hotel.createReservation')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default Hotel;