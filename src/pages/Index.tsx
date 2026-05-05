import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users, DollarSign, TrendingUp, Clock, Utensils, Bed, Wine, Sparkles,
  Download, ChevronDown, FileText, Table, FileCode, FileSpreadsheet
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/rbac";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

const today = new Date().toISOString().slice(0, 10);

const Index = () => {
  const navigate = useNavigate();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { user, hasScopes } = useAuth();

  const scopes: string[] = (user as any)?.scopes ?? [];

  const canReadRooms = hasScopes("rooms:read");
  const canReadReservations = hasScopes("reservations:read");
  const canReadReports = hasScopes("reports:read");
  const canReadOrders = hasScopes("orders:read");
  const canReadSpa = hasScopes("spa:read");
  const canReadInventory = hasScopes("inventory:read");

  const { data: rooms = [] } = useQuery({
    queryKey: ["hotel", "rooms"],
    queryFn: () => api.get<any[]>("/hotel/rooms"),
    enabled: canReadRooms,
    refetchInterval: canReadRooms ? 10000 : false,
    refetchOnWindowFocus: canReadRooms,
    staleTime: 5000,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["hotel", "reservations", today],
    queryFn: () => api.get<any[]>(`/hotel/reservations?date=${today}`),
    enabled: canReadReservations,
    refetchInterval: canReadReservations ? 10000 : false,
    refetchOnWindowFocus: canReadReservations,
    staleTime: 5000,
  });

  const { data: revenueTotal = 0 } = useQuery({
    queryKey: ["reports", "daily-total", today],
    queryFn: async () => {
      const depts = ["hotel", "restaurant", "pub", "spa"] as const;
      const res = await Promise.all(
        depts.map((d) => api.get<{ total: number }>(`/reports/daily?dept=${d}&date=${today}`))
      );
      return res.reduce((s, r) => s + (r?.total || 0), 0);
    },
    enabled: canReadReports,
    refetchInterval: canReadReports ? 30000 : false,
    refetchOnWindowFocus: canReadReports,
    staleTime: 10000,
  });

  const { data: ordersOpen = [] } = useQuery({
    queryKey: ["restaurant", "orders", "open"],
    queryFn: () => api.get<any[]>(`/restaurant/orders?status=open`),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 5000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 2000,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant", "tables"],
    queryFn: () => api.get<any[]>(`/restaurant/tables`),
    enabled: canReadOrders,
    refetchInterval: canReadOrders ? 60000 : false,
    refetchOnWindowFocus: canReadOrders,
    staleTime: 15000,
  });

  const startOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const endOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1);

  const { data: spaToday = [] } = useQuery({
    queryKey: ["spa", "appointments", today],
    queryFn: () => api.get<any[]>(`/spa/appointments?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`),
    enabled: canReadSpa,
    refetchInterval: canReadSpa ? 15000 : false,
    refetchOnWindowFocus: canReadSpa,
    staleTime: 7000,
  });

  const occupiedRooms = rooms.filter((r: any) => r.status === "occupied").length;
  const totalRooms = rooms.length;
  const occupancyRate = totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const presentGuests = reservations.filter((r: any) => r.status === "checked_in").length;
  const openOrdersCount = ordersOpen.length;
  const totalTablesRestaurant = tables.filter((t: any) => t.department === "restaurant").length;
  const usedTablesRestaurant = new Set(ordersOpen.filter((o: any) => o.dept === "restaurant" && o.tableId).map((o: any) => o.tableId)).size;
  const totalTablesPub = tables.filter((t: any) => t.department === "pub").length;
  const usedTablesPub = new Set(ordersOpen.filter((o: any) => o.dept === "pub" && o.tableId).map((o: any) => o.tableId)).size;

  const formatAr = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} Ar`;

  const exportOptions = [
    { format: "excel", label: "Excel", extension: ".xlsx", icon: FileSpreadsheet, color: "text-green-600", bgColor: "bg-green-50", hoverColor: "hover:bg-green-100", description: "Tableur optimisé" },
    { format: "csv", label: "CSV", extension: ".csv", icon: Table, color: "text-blue-600", bgColor: "bg-blue-50", hoverColor: "hover:bg-blue-100", description: "Données avec séparateurs" },
    { format: "txt", label: "Texte", extension: ".txt", icon: FileText, color: "text-purple-600", bgColor: "bg-purple-50", hoverColor: "hover:bg-purple-100", description: "Format lisible" },
    { format: "json", label: "JSON", extension: ".json", icon: FileCode, color: "text-orange-600", bgColor: "bg-orange-50", hoverColor: "hover:bg-orange-100", description: "Données brutes API" },
  ];

  const prepareExportData = () => ({
    metadata: {
      hotelName: "Simply Hotel",
      exportDate: new Date().toLocaleString("fr-FR"),
      periode: today,
      generatedBy: (user as any)?.name || (user as any)?.email || "Utilisateur",
    },
    statistiques: {
      presentGuests, revenueTotal,
      revenueTotalFormatted: formatAr(revenueTotal),
      occupancyRate, openOrdersCount, occupiedRooms, totalRooms,
      usedTablesRestaurant, totalTablesRestaurant,
      usedTablesPub, totalTablesPub,
      spaAppointments: spaToday.length,
    },
  });

  const exportToCSV = (data: any) => {
    let csv = "\uFEFF";
    csv += `TABLEAU DE BORD - SIMPLY HOTEL\nPériode: ${data.metadata.periode}\nExporté le: ${data.metadata.exportDate}\n\n`;
    csv += "Indicateur,Valeur\n";
    csv += `Clients présents,${data.statistiques.presentGuests}\n`;
    csv += `Revenus journaliers,${data.statistiques.revenueTotal}\n`;
    csv += `Taux occupation,${data.statistiques.occupancyRate}%\n`;
    csv += `Commandes actives,${data.statistiques.openOrdersCount}\n`;
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `dashboard-${today}.csv`);
  };

  const exportToExcel = (data: any) => {
    const wb = XLSX.utils.book_new();
    const rows = [
      ["Indicateur", "Valeur"],
      ["Clients présents", data.statistiques.presentGuests],
      ["Revenus journaliers", data.statistiques.revenueTotal],
      ["Taux occupation", `${data.statistiques.occupancyRate}%`],
      ["Commandes actives", data.statistiques.openOrdersCount],
      ["Chambres occupées", `${data.statistiques.occupiedRooms}/${data.statistiques.totalRooms}`],
      ["Tables restaurant", `${data.statistiques.usedTablesRestaurant}/${data.statistiques.totalTablesRestaurant}`],
      ["Tables bar", `${data.statistiques.usedTablesPub}/${data.statistiques.totalTablesPub}`],
      ["RDV spa", data.statistiques.spaAppointments],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `dashboard-${today}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const txt = `TABLEAU DE BORD - SIMPLY HOTEL\n${"=".repeat(40)}\nPériode : ${data.metadata.periode}\nExporté le : ${data.metadata.exportDate}\n\n`
      + `Clients présents     : ${data.statistiques.presentGuests}\n`
      + `Revenus journaliers  : ${data.statistiques.revenueTotalFormatted}\n`
      + `Taux d'occupation    : ${data.statistiques.occupancyRate}%\n`
      + `Commandes actives    : ${data.statistiques.openOrdersCount}\n`;
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `dashboard-${today}.txt`);
  };

  const exportToJSON = (data: any) => {
    saveAs(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), `dashboard-${today}.json`);
  };

  const exportData = async (format: string) => {
    setIsExporting(true);
    setIsExportOpen(false);
    try {
      const data = prepareExportData();
      if (format === "csv") exportToCSV(data);
      if (format === "excel") exportToExcel(data);
      if (format === "txt") exportToTXT(data);
      if (format === "json") exportToJSON(data);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const isAdminOrManager = ["ADMIN", "MANAGER", "admin", "manager", "compta", "COMPTA"].includes((user as any)?.role ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-between items-start mb-6 md:mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Simply Hotel</h1>
              <p className="text-sm md:text-base text-muted-foreground">Plateforme de gestion complète • Vue d'ensemble temps réel</p>
            </div>
            {isAdminOrManager && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/reports")}>
                  <TrendingUp className="w-4 h-4" />
                  <span>Rapport et analyse des données</span>
                </Button>
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  disabled={isExporting}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-all shadow-lg font-semibold group"
                >
                  {isExporting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Export en cours...</span></>
                  ) : (
                    <><Download className="w-4 h-4" /><span>Exporter</span><ChevronDown className="w-4 h-4" /></>
                  )}
                </button>

                {isExportOpen && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-10 overflow-hidden">
                    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                      <p className="text-sm font-bold text-blue-900">Format d'exportation</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {exportOptions.map((opt) => (
                        <button
                          key={opt.format}
                          onClick={() => exportData(opt.format)}
                          className={`flex items-center gap-3 w-full text-left p-3 rounded-lg transition-all ${opt.bgColor} ${opt.hoverColor}`}
                        >
                          <opt.icon className={`w-5 h-5 ${opt.color}`} />
                          <div>
                            <span className="font-semibold text-gray-900 text-sm">{opt.label}</span>
                            <span className="ml-2 text-xs font-mono bg-gray-100 text-gray-500 px-1 rounded">{opt.extension}</span>
                            <p className="text-xs text-gray-500">{opt.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <StatCard title="Clients Présents" value={canReadReservations ? presentGuests : "—"} icon={Users} variant="default" />
            {canReadReports && (
              <StatCard title="Revenus Journaliers" value={formatAr(revenueTotal)} icon={DollarSign} variant="gold" />
            )}
            <StatCard title="Taux d'Occupation" value={canReadRooms ? `${occupancyRate}%` : "—"} icon={TrendingUp} variant="success" />
            <StatCard title="Commandes Actives" value={canReadOrders ? openOrdersCount : "—"} icon={Clock} variant="warning" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <StatCard title="Chambres Occupées" value={canReadRooms ? `${occupiedRooms}/${totalRooms}` : "—"} icon={Bed} variant="default" />
            <StatCard title="Tables Restaurant" value={canReadOrders ? `${usedTablesRestaurant}/${totalTablesRestaurant}` : "—"} icon={Utensils} variant="default" />
            <StatCard title="Bar - Tables" value={canReadOrders ? `${usedTablesPub}/${totalTablesPub}` : "—"} icon={Wine} variant="default" />
            <StatCard title="RDV Spa Aujourd'hui" value={canReadSpa ? spaToday.length : "—"} icon={Sparkles} variant="default" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <QuickActions />
            <RecentActivity />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;