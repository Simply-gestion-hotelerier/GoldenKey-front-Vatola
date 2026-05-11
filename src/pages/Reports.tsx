// src/pages/reports/Reports.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, Download, FileSpreadsheet, FileText, RefreshCw,
  ShoppingBag, Hotel, Sparkles, Package, AlertTriangle, CheckCircle2,
  BarChart3, Calendar, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight,
  Printer, FileDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");
const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10);

const METHOD_LBL: Record<string, string> = {
  cash: "Espèces", card: "Carte", mobile: "Mobile", bank: "Virement",
};
const DEPT_COLOR: Record<string, string> = {
  restaurant: "bg-orange-100 text-orange-800",
  pub:        "bg-purple-100 text-purple-800",
  hotel:      "bg-blue-100 text-blue-800",
  spa:        "bg-teal-100 text-teal-800",
};
const STATUS_COLOR: Record<string, string> = {
  open:      "bg-yellow-100 text-yellow-800",
  closed:    "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = "blue", trend }: any) {
  const colors: Record<string, string> = {
    blue:  "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red:   "bg-red-50 text-red-600 border-red-100",
    teal:  "bg-teal-50 text-teal-600 border-teal-100",
    purple:"bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}% {trend >= 0 ? "▲" : "▼"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section collapsible ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="w-4 h-4" /> {title}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── EXPORT PDF (impression navigateur) ────────────────────────────────────────
function buildPDFContent(title: string, from: string, to: string, salesData: any, stockData: any, ordersData: any, t: any) {
  const fmtN = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const restaurantRows = (salesData?.restaurant?.orders ?? []).map((o: any) => `
    <tr>
      <td>#${o.id}</td>
      <td>${new Date(o.openedAt).toLocaleDateString("fr-FR")}</td>
      <td>${o.dept}</td>
      <td>${o.tableCode ?? "—"}</td>
      <td style="text-align:right">${fmtN(o.total)} Ar</td>
      <td style="text-align:right">${fmtN(o.paid)} Ar</td>
      <td><span style="padding:2px 8px;border-radius:999px;font-size:10px;background:${o.status === "closed" ? "#d1fae5" : o.status === "open" ? "#fef3c7" : "#fee2e2"};color:${o.status === "closed" ? "#065f46" : o.status === "open" ? "#92400e" : "#991b1b"}">${o.status === "closed" ? t('reports.closed') : o.status === "open" ? t('reports.open') : t('reports.cancelled')}</span></td>
    </tr>`).join("");

  const topItemRows = (salesData?.restaurant?.topItems ?? []).map((item: any) => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:right">${item.qty}</td>
      <td style="text-align:right">${fmtN(item.total)} Ar</td>
    </tr>`).join("");

  const hotelRows = (salesData?.hotel?.reservations ?? []).map((r: any) => `
    <tr>
      <td>${r.guestName}</td>
      <td>${r.roomNumber} (${r.roomType})</td>
      <td>${new Date(r.checkIn).toLocaleDateString("fr-FR")}</td>
      <td>${new Date(r.checkOut).toLocaleDateString("fr-FR")}</td>
      <td style="text-align:right">${fmtN(r.totalCharges)} Ar</td>
      <td style="text-align:right">${fmtN(r.paid)} Ar</td>
      <td>${r.status === "checked_in" ? t('reports.checkedIn') : r.status === "checked_out" ? t('reports.checkedOut') : r.status === "booked" ? t('reports.booked') : r.status}</td>
    </tr>`).join("");

  const stockAlertRows = (stockData?.alerts?.low ?? []).map((a: any) => `
    <tr style="background:#fffbeb">
      <td>${a.itemName}</td>
      <td>${a.storeName}</td>
      <td style="text-align:right;color:#b45309;font-weight:600">${a.qty}</td>
      <td style="text-align:right">${a.minQty}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; font-size: 11px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f2744; padding-bottom: 10px; margin-bottom: 16px; }
    .hotel-name { font-size: 20px; font-weight: 700; color: #0f2744; }
    .period { font-size: 11px; color: #6b7280; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; color: #0f2744; border-left: 3px solid #0f2744; padding-left: 8px; margin-bottom: 8px; }
    .kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
    .kpi { background: #f8f9fc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
    .kpi-label { font-size: 9px; color: #6b7280; margin-bottom: 2px; }
    .kpi-value { font-size: 15px; font-weight: 700; color: #0f2744; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0f2744; color: white; padding: 6px 8px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #9ca3af; text-align: center; }
  </style>
  </head><body>
  <div class="header">
    <div>
      <div class="hotel-name">${t('reports.hotelName')}</div>
      <div class="period">${title} · ${t('common.period')} : ${from} → ${to}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#6b7280">${t('reports.printedAt')} ${new Date().toLocaleString("fr-FR")}</div>
  </div>

  ${salesData ? `
  <!-- KPIs globaux -->
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">${t('reports.restaurantSales')}</div><div class="kpi-value">${fmtN(salesData.restaurant?.summary?.totalRevenue ?? 0)} Ar</div></div>
    <div class="kpi"><div class="kpi-label">${t('reports.hotelSales')}</div><div class="kpi-value">${fmtN(salesData.hotel?.summary?.totalRevenue ?? 0)} Ar</div></div>
    <div class="kpi"><div class="kpi-label">${t('reports.spaSales')}</div><div class="kpi-value">${fmtN(salesData.spa?.summary?.totalRevenue ?? 0)} Ar</div></div>
    <div class="kpi"><div class="kpi-label">${t('reports.grandTotal')}</div><div class="kpi-value">${fmtN((salesData.restaurant?.summary?.totalRevenue ?? 0) + (salesData.hotel?.summary?.totalRevenue ?? 0) + (salesData.spa?.summary?.totalRevenue ?? 0))} Ar</div></div>
  </div>

  ${salesData.restaurant?.orders?.length ? `
  <div class="section">
    <div class="section-title">${t('reports.restaurantBarOrders')}</div>
    <table><thead><tr><th>#</th><th>${t('common.date')}</th><th>${t('common.department')}</th><th>${t('dailyInvoice.table')}</th><th style="text-align:right">${t('reports.total')}</th><th style="text-align:right">${t('reports.paid')}</th><th>${t('common.status')}</th></tr></thead>
    <tbody>${restaurantRows}</tbody>
  </table></div>` : ""}

  ${topItemRows ? `
  <div class="section">
    <div class="section-title">${t('reports.topSellingItems')}</div>
    <table><thead><tr><th>${t('inventory.itemName')}</th><th style="text-align:right">${t('reports.qtySold')}</th><th style="text-align:right">${t('reports.revenue')}</th></tr></thead>
    <tbody>${topItemRows}</tbody>
  </table></div>` : ""}

  ${salesData.hotel?.reservations?.length ? `
  <div class="section">
    <div class="section-title">${t('reports.hotelReservations')}</div>
    <table><thead><tr><th>${t('crm.customers')}</th><th>${t('hotel.room')}</th><th>${t('hotel.arrivalDate')}</th><th>${t('hotel.departureDate')}</th><th style="text-align:right">${t('reports.charges')}</th><th style="text-align:right">${t('reports.paid')}</th><th>${t('common.status')}</th></tr></thead>
    <tbody>${hotelRows}</tbody>
  </table></div>` : ""}
  ` : ""}

  ${stockData?.alerts?.low?.length ? `
  <div class="section">
    <div class="section-title">⚠ ${t('inventory.lowStockAlerts')}</div>
    <table><thead><tr><th>${t('inventory.itemName')}</th><th>${t('inventory.store')}</th><th style="text-align:right">${t('inventory.currentQty')}</th><th style="text-align:right">${t('inventory.minQty')}</th></tr></thead>
    <tbody>${stockAlertRows}</tbody>
  </table></div>` : ""}

  <div class="footer">${t('reports.footer')}</div>
  </body></html>`;
}

function exportToPDF(title: string, from: string, to: string, salesData: any, stockData: any, ordersData: any, t: any) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildPDFContent(title, from, to, salesData, stockData, ordersData, t));
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

// ── EXPORT EXCEL ───────────────────────────────────────────────────────────────
function exportToExcel(from: string, to: string, salesData: any, stockData: any, ordersData: any, t: any) {
  const wb = XLSX.utils.book_new();

  // Feuille Synthèse
  const restSum  = salesData?.restaurant?.summary;
  const hotelSum = salesData?.hotel?.summary;
  const spaSum   = salesData?.spa?.summary;
  const grandTotal = (restSum?.totalRevenue ?? 0) + (hotelSum?.totalRevenue ?? 0) + (spaSum?.totalRevenue ?? 0);

  const synthese = [
    [t('reports.salesReport')],
    [`${t('common.period')} : ${from} → ${to}`],
    [`${t('export.title')} : ${new Date().toLocaleString("fr-FR")}`],
    [],
    [t('reports.globalSummary'), "", ""],
    [t('common.department'), t('reports.revenue'), t('reports.collected'), t('reports.unpaid')],
    [t('nav.restaurant'), restSum?.totalRevenue ?? 0, restSum?.totalPaid ?? 0, (restSum?.totalRevenue ?? 0) - (restSum?.totalPaid ?? 0)],
    [t('nav.hotel'), hotelSum?.totalRevenue ?? 0, hotelSum?.totalPaid ?? 0, (hotelSum?.totalRevenue ?? 0) - (hotelSum?.totalPaid ?? 0)],
    [t('nav.spa'), spaSum?.totalRevenue ?? 0, spaSum?.totalRevenue ?? 0, 0],
    [t('reports.total'), grandTotal, (restSum?.totalPaid ?? 0) + (hotelSum?.totalPaid ?? 0) + (spaSum?.totalRevenue ?? 0), ""],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(synthese);
  ws1["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, t('reports.summary'));

  // Feuille Commandes Restaurant
  if (salesData?.restaurant?.orders?.length) {
    const headers = ["ID", t('common.date'), t('common.department'), t('dailyInvoice.table'), t('reports.items'), t('reports.subtotal'), t('reports.discount'), t('reports.total'), t('reports.paid'), t('reports.balance'), t('common.status')];
    const rows = salesData.restaurant.orders.map((o: any) => [
      o.id, new Date(o.openedAt).toLocaleDateString("fr-FR"), o.dept, o.tableCode ?? "—",
      o.itemCount, o.subtotal, o.discount, o.total, o.paid, o.balance, o.status,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws2["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, t('reports.restaurantOrders'));
  }

  // Feuille Top Articles
  if (salesData?.restaurant?.topItems?.length) {
    const headers = [t('inventory.itemName'), t('reports.qtySold'), `${t('reports.revenue')} (Ar)`];
    const rows = salesData.restaurant.topItems.map((i: any) => [i.name, i.qty, i.total]);
    const ws3 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws3["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, t('reports.topItems'));
  }

  // Feuille Réservations Hôtel
  if (salesData?.hotel?.reservations?.length) {
    const headers = [t('crm.customers'), t('hotel.room'), t('hotel.type'), t('hotel.arrivalDate'), t('hotel.departureDate'), t('hotel.nights'), t('hotel.rate'), t('reports.charges'), t('reports.paid'), t('reports.balance'), t('common.status')];
    const rows = salesData.hotel.reservations.map((r: any) => [
      r.guestName, r.roomNumber, r.roomType,
      new Date(r.checkIn).toLocaleDateString("fr-FR"),
      new Date(r.checkOut).toLocaleDateString("fr-FR"),
      r.nights, r.rate, r.totalCharges, r.paid, r.balance, r.status === "checked_in" ? t('reports.checkedIn') : r.status === "checked_out" ? t('reports.checkedOut') : r.status === "booked" ? t('reports.booked') : r.status,
    ]);
    const ws4 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws4["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws4, t('reports.hotelReservations'));
  }

  // Feuille Spa
  if (salesData?.spa?.appointments?.length) {
    const headers = [t('crm.customers'), t('spa.services'), t('spa.startTime'), t('spa.duration'), t('common.status'), t('common.price')];
    const rows = salesData.spa.appointments.map((a: any) => [
      a.clientName, a.serviceName,
      new Date(a.start).toLocaleString("fr-FR"),
      a.durationMin, a.status, a.price,
    ]);
    const ws5 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws5["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws5, t('nav.spa'));
  }

  // Feuille Stock
  if (stockData?.byStore?.length) {
    const headers = [t('inventory.store'), t('common.department'), t('inventory.sku'), t('inventory.itemName'), t('inventory.category'), t('inventory.unit'), t('inventory.quantity'), t('inventory.minThreshold'), t('inventory.maxThreshold'), t('inventory.costPrice'), t('inventory.stockValue'), t('common.status')];
    const rows: any[] = [];
    for (const store of stockData.byStore) {
      for (const item of store.items) {
        rows.push([
          store.store.name, store.store.department, item.sku, item.name,
          item.category ?? "—", item.unit, item.qty, item.minQty, item.maxQty,
          item.costPrice, item.stockValue,
          item.status === "out" ? t('inventory.outOfStockBadge') : item.status === "low" ? t('inventory.lowStockBadge') : "OK",
        ]);
      }
    }
    const ws6 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws6["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws6, t('nav.inventory'));
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `rapport-${from}-${to}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export default function Reports() {
  const { t } = useTranslation();
  const [from, setFrom]       = useState(firstOfMonth);
  const [to, setTo]           = useState(today);
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab]   = useState<"sales" | "orders" | "stock">("sales");
  const [exporting, setExporting]   = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", from, to, deptFilter],
    queryFn:  () => api.get<any>(`/reports/sales?from=${from}&to=${to}&dept=${deptFilter}`),
    enabled:  !!from && !!to,
  });

  const stockQuery = useQuery({
    queryKey: ["reports", "stock"],
    queryFn:  () => api.get<any>("/reports/stock"),
  });

  const ordersQuery = useQuery({
    queryKey: ["reports", "orders", from, to],
    queryFn:  () => api.get<any>(`/reports/orders?from=${from}&to=${to}`),
    enabled:  !!from && !!to,
  });

  const salesData  = salesQuery.data;
  const stockData  = stockQuery.data;
  const ordersData = ordersQuery.data;

  // KPIs dérivés
  const restRevenue  = salesData?.restaurant?.summary?.totalRevenue  ?? 0;
  const hotelRevenue = salesData?.hotel?.summary?.totalRevenue  ?? 0;
  const spaRevenue   = salesData?.spa?.summary?.totalRevenue    ?? 0;
  const grandTotal   = restRevenue + hotelRevenue + spaRevenue;
  const totalPaid    = (salesData?.restaurant?.summary?.totalPaid ?? 0) +
                       (salesData?.hotel?.summary?.totalPaid     ?? 0) + spaRevenue;
  const totalUnpaid  = grandTotal - totalPaid;

  const handleExportPDF = () => {
    setExporting(true);
    try {
      exportToPDF(t('reports.completeReport'), from, to, salesData, stockData, ordersData, t);
      toast({ title: t('reports.pdfExportStarted') });
    } catch (e) {
      toast({ title: t('reports.pdfExportError'), description: String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      exportToExcel(from, to, salesData, stockData, ordersData, t);
      toast({ title: t('reports.excelExportSuccess') });
    } catch (e) {
      toast({ title: t('reports.excelExportError'), description: String(e), variant: "destructive" });
    } finally { setExporting(false); }
  };

  const toggleOrder = (id: number) =>
    setExpandedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const isLoading = salesQuery.isLoading || stockQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          {/* ── Titre + Actions ── */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="w-7 h-7 text-primary" /> {t('reports.title')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{t('reports.subtitle')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => { salesQuery.refetch(); stockQuery.refetch(); ordersQuery.refetch(); }}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> 
                {isLoading ? t('common.loading') : t('common.refresh')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
                <Printer className="w-4 h-4 mr-1.5" /> {t('common.print')}
              </Button>
              <Button size="sm" onClick={handleExportExcel} disabled={exporting}
                className="bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> {t('export.excel')}
              </Button>
            </div>
          </div>

          {/* ── Filtres ── */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t('common.from')}</label>
                  <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t('common.to')}</label>
                  <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1 font-medium">{t('common.department')}</label>
                  <Select value={deptFilter} onValueChange={setDeptFilter}>
                    <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="restaurant">{t('nav.restaurant')}</SelectItem>
                      <SelectItem value="hotel">{t('nav.hotel')}</SelectItem>
                      <SelectItem value="spa">{t('nav.spa')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1 ml-auto">
                  {[
                    { label: t('reports.today'), fn: () => { setFrom(today); setTo(today); } },
                    { label: t('reports.last7Days'),  fn: () => { const d = new Date(); d.setDate(d.getDate() - 7); setFrom(d.toISOString().slice(0,10)); setTo(today); } },
                    { label: t('reports.thisMonth'),fn: () => { setFrom(firstOfMonth); setTo(today); } },
                  ].map(q => (
                    <Button key={q.label} variant="outline" size="sm" onClick={q.fn} className="h-9 text-xs px-3">{q.label}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── KPIs globaux ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label={t('reports.totalSales')} value={`${fmt(grandTotal)} Ar`} icon={TrendingUp} color="blue" sub={`${from} → ${to}`} />
            <KPICard label={t('reports.collected')} value={`${fmt(totalPaid)} Ar`} icon={CheckCircle2} color="green" sub={`${grandTotal > 0 ? Math.round((totalPaid/grandTotal)*100) : 0}% ${t('reports.ofRevenue')}`} />
            <KPICard label={t('reports.unpaid')} value={`${fmt(totalUnpaid)} Ar`} icon={AlertTriangle} color={totalUnpaid > 0 ? "red" : "green"} />
            <KPICard label={t('reports.stockAlerts')} value={`${stockData?.summary?.lowStockCount ?? 0} ${t('inventory.items')}`} icon={Package} color="amber" sub={`${stockData?.summary?.outOfStockCount ?? 0} ${t('inventory.outOfStockBadge')}`} />
          </div>

          {/* ── Onglets ── */}
          <div className="flex gap-1 border-b">
            {([
              { key: "sales",  label: t('reports.sales'),    icon: TrendingUp },
              { key: "orders", label: t('reports.orders'), icon: ShoppingBag },
              { key: "stock",  label: t('nav.inventory'),     icon: Package },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════ VENTES ═══════ */}
          {activeTab === "sales" && (
            <div className="space-y-4">

              {/* KPIs par département */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard label={t('nav.restaurant')} value={`${fmt(restRevenue)} Ar`} icon={ShoppingBag} color="purple"
                  sub={`${salesData?.restaurant?.summary?.totalOrders ?? 0} ${t('reports.orders')}`} />
                <KPICard label={t('nav.hotel')} value={`${fmt(hotelRevenue)} Ar`} icon={Hotel} color="blue"
                  sub={`${salesData?.hotel?.summary?.totalReservations ?? 0} ${t('reports.reservations')}`} />
                <KPICard label={t('nav.spa')} value={`${fmt(spaRevenue)} Ar`} icon={Sparkles} color="teal"
                  sub={`${salesData?.spa?.summary?.completed ?? 0} ${t('reports.services')}`} />
              </div>

              {/* Revenus journaliers restaurant */}
              {salesData?.restaurant?.dailyRevenue?.length > 0 && (
                <Section title={t('reports.restaurantRevenueEvolution')} icon={TrendingUp}>
                  <div className="space-y-2">
                    {salesData.restaurant.dailyRevenue.map((d: any) => {
                      const maxVal = Math.max(...salesData.restaurant.dailyRevenue.map((x: any) => x.total));
                      const pct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
                      return (
                        <div key={d.date} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-24 shrink-0">{fmtDate(d.date)}</span>
                          <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold w-32 text-right">{fmt(d.total)} Ar</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Top articles */}
              {salesData?.restaurant?.topItems?.length > 0 && (
                <Section title={t('reports.topSellingItems')} icon={ShoppingBag}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">{t('inventory.itemName')}</th>
                          <th className="p-2 text-right">{t('reports.qtySold')}</th>
                          <th className="p-2 text-right">{t('reports.revenue')} (Ar)</th>
                          <th className="p-2 text-right">% {t('reports.ofRestaurantRevenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.restaurant.topItems.map((item: any, i: number) => (
                          <tr key={item.name} className="border-b hover:bg-muted/20">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-right">{item.qty}</td>
                            <td className="p-2 text-right font-semibold">{fmt(item.total)} Ar</td>
                            <td className="p-2 text-right text-muted-foreground">
                              {restRevenue > 0 ? Math.round((item.total / restRevenue) * 100) : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* Répartition paiements */}
              {salesData?.restaurant?.paymentBreakdown?.length > 0 && (
                <Section title={t('reports.paymentBreakdown')} icon={TrendingUp}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {salesData.restaurant.paymentBreakdown.map((p: any) => (
                      <div key={p.method} className="border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">{METHOD_LBL[p.method] ?? p.method}</p>
                        <p className="text-lg font-bold mt-1">{fmt(p.amount)} Ar</p>
                        <p className="text-xs text-muted-foreground">
                          {restRevenue > 0 ? Math.round((p.amount / (salesData.restaurant.summary.totalPaid || 1)) * 100) : 0}%
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Réservations hôtel */}
              {salesData?.hotel?.reservations?.length > 0 && (
                <Section title={t('reports.hotelReservationsPeriod')} icon={Hotel}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 text-left">{t('crm.customers')}</th>
                          <th className="p-2 text-left">{t('hotel.room')}</th>
                          <th className="p-2 text-left">{t('hotel.arrivalDate')}</th>
                          <th className="p-2 text-left">{t('hotel.departureDate')}</th>
                          <th className="p-2 text-right">{t('hotel.nights')}</th>
                          <th className="p-2 text-right">{t('reports.charges')}</th>
                          <th className="p-2 text-right">{t('reports.paid')}</th>
                          <th className="p-2 text-right">{t('reports.balance')}</th>
                          <th className="p-2 text-center">{t('common.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.hotel.reservations.map((r: any) => (
                          <tr key={r.id} className="border-b hover:bg-muted/20">
                            <td className="p-2 font-medium">{r.guestName}</td>
                            <td className="p-2">{r.roomNumber} <span className="text-xs text-muted-foreground">({r.roomType})</span></td>
                            <td className="p-2">{fmtDate(r.checkIn)}</td>
                            <td className="p-2">{fmtDate(r.checkOut)}</td>
                            <td className="p-2 text-right">{r.nights}</td>
                            <td className="p-2 text-right">{fmt(r.totalCharges)} Ar</td>
                            <td className="p-2 text-right text-green-600">{fmt(r.paid)} Ar</td>
                            <td className={`p-2 text-right font-semibold ${r.balance > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(r.balance)} Ar</td>
                            <td className="p-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLOR[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                                {r.status === "checked_in" ? t('reports.checkedIn') : r.status === "checked_out" ? t('reports.checkedOut') : r.status === "booked" ? t('reports.booked') : r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/40 font-semibold">
                          <td colSpan={5} className="p-2 text-right">{t('reports.totals')}</td>
                          <td className="p-2 text-right">{fmt(hotelRevenue)} Ar</td>
                          <td className="p-2 text-right text-green-600">{fmt(salesData.hotel.summary.totalPaid)} Ar</td>
                          <td className={`p-2 text-right ${salesData.hotel.summary.unpaidBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                            {fmt(salesData.hotel.summary.unpaidBalance)} Ar
                           </td>
                          <td />
                         </tr>
                      </tfoot>
                    </table>
                  </div>
                </Section>
              )}

              {/* Spa */}
              {salesData?.spa?.summary?.serviceBreakdown?.length > 0 && (
                <Section title={t('reports.spaServices')} icon={Sparkles}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t('reports.totalServices')}</p>
                      <p className="text-xl font-bold">{salesData.spa.summary.total}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t('reports.completed')}</p>
                      <p className="text-xl font-bold text-green-600">{salesData.spa.summary.completed}</p>
                    </div>
                    <div className="border rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">{t('reports.spaRevenue')}</p>
                      <p className="text-xl font-bold">{fmt(spaRevenue)} Ar</p>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-2 text-left">{t('spa.services')}</th>
                        <th className="p-2 text-right">{t('reports.serviceCount')}</th>
                        <th className="p-2 text-right">{t('reports.revenue')} (Ar)</th>
                        <th className="p-2 text-right">% {t('reports.ofSpaRevenue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.spa.summary.serviceBreakdown.map((s: any) => (
                        <tr key={s.service} className="border-b hover:bg-muted/20">
                          <td className="p-2 font-medium">{s.service}</td>
                          <td className="p-2 text-right">{s.count}</td>
                          <td className="p-2 text-right font-semibold">{fmt(s.revenue)} Ar</td>
                          <td className="p-2 text-right text-muted-foreground">
                            {spaRevenue > 0 ? Math.round((s.revenue / spaRevenue) * 100) : 0}%
                          </td>
                         </tr>
                      ))}
                    </tbody>
                   </table>
                </Section>
              )}

              {!salesQuery.isLoading && !salesData && (
                <div className="text-center py-12 text-muted-foreground">{t('reports.selectPeriod')}</div>
              )}
            </div>
          )}

          {/* ═══════ COMMANDES ═══════ */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {ordersQuery.isLoading && <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>}
              {ordersData && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard label={t('reports.totalOrders')} value={ordersData.summary.total} icon={ShoppingBag} color="blue" />
                    <KPICard label={t('reports.closed')} value={ordersData.summary.closed} icon={CheckCircle2} color="green" />
                    <KPICard label={t('reports.open')} value={ordersData.summary.open} icon={RefreshCw} color="amber" />
                    <KPICard label={t('reports.cancelled')} value={ordersData.summary.cancelled} icon={AlertTriangle} color="red" />
                  </div>

                  <Section title={`${t('reports.orders')} (${ordersData.orders.length})`} icon={ShoppingBag}>
                    <div className="space-y-2">
                      {ordersData.orders.map((o: any) => {
                        const expanded = expandedOrders.has(o.id);
                        return (
                          <div key={o.id} className="border rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                              onClick={() => toggleOrder(o.id)}
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                                <span className="font-semibold text-sm">#{o.id}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLOR[o.dept] ?? "bg-gray-100"}`}>{o.dept}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[o.status] ?? "bg-gray-100"}`}>
                                  {o.status === "closed" ? t('reports.closed') : o.status === "open" ? t('reports.open') : t('reports.cancelled')}
                                </span>
                                {o.tableCode && <span className="text-xs text-muted-foreground">{t('dailyInvoice.table')} {o.tableCode}</span>}
                                <span className="text-xs text-muted-foreground">{new Date(o.openedAt).toLocaleString("fr-FR")}</span>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className="font-semibold text-sm">{fmt(o.total)} Ar</div>
                                {o.balance > 0 && <div className="text-xs text-red-600">-{fmt(o.balance)} Ar {t('reports.due')}</div>}
                              </div>
                            </button>
                            {expanded && (
                              <div className="border-t p-3 bg-muted/10">
                                <table className="w-full text-xs mb-2">
                                  <thead><tr className="border-b"><th className="p-1 text-left">{t('inventory.itemName')}</th><th className="p-1 text-right">{t('dailyInvoice.unitPrice')}</th><th className="p-1 text-right">{t('dailyInvoice.qty')}</th><th className="p-1 text-right">{t('reports.total')}</th></tr></thead>
                                  <tbody>
                                    {o.lines.map((l: any, i: number) => (
                                      <tr key={i} className="border-b last:border-0">
                                        <td className="p-1">{l.name}</td>
                                        <td className="p-1 text-right">{fmt(l.unitPrice)} Ar</td>
                                        <td className="p-1 text-right">{l.qty}</td>
                                        <td className="p-1 text-right font-medium">{fmt(l.total)} Ar</td>
                                       </tr>
                                    ))}
                                  </tbody>
                                 </table>
                                {o.payments.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {o.payments.map((p: any, i: number) => (
                                      <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                                        {METHOD_LBL[p.method]} : {fmt(p.amount)} Ar
                                        {p.operatorName && ` · ${p.operatorName}`}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                </>
              )}
            </div>
          )}

          {/* ═══════ STOCK ═══════ */}
          {activeTab === "stock" && (
            <div className="space-y-4">
              {stockQuery.isLoading && <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>}
              {stockData && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KPICard label={t('inventory.totalItems')} value={stockData.summary.totalItems} icon={Package} color="blue" />
                    <KPICard label={t('inventory.totalValue')} value={`${fmt(stockData.summary.totalValue)} Ar`} icon={TrendingUp} color="green" />
                    <KPICard label={t('inventory.lowStock')} value={stockData.summary.lowStockCount} icon={AlertTriangle} color="amber" />
                    <KPICard label={t('inventory.outOfStock')} value={stockData.summary.outOfStockCount} icon={AlertTriangle} color="red" />
                  </div>

                  {/* Alertes */}
                  {(stockData.alerts.low.length > 0 || stockData.alerts.out.length > 0) && (
                    <Section title={`${t('inventory.alerts')} (${stockData.alerts.low.length + stockData.alerts.out.length})`} icon={AlertTriangle} defaultOpen>
                      <div className="space-y-2">
                        {stockData.alerts.out.map((a: any, i: number) => (
                          <div key={`out-${i}`} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                            <div><span className="font-semibold text-red-700">{a.itemName}</span> <span className="text-red-500 text-xs">— {a.storeName}</span></div>
                            <Badge className="bg-red-100 text-red-800 border-red-200">{t('inventory.outOfStockBadge')}</Badge>
                          </div>
                        ))}
                        {stockData.alerts.low.map((a: any, i: number) => (
                          <div key={`low-${i}`} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                            <div><span className="font-semibold text-amber-700">{a.itemName}</span> <span className="text-amber-500 text-xs">— {a.storeName}</span></div>
                            <span className="text-amber-700 font-medium text-xs">{a.qty} / {a.minQty} min</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Stock par dépôt */}
                  {stockData.byStore.map((store: any) => (
                    store.items.length > 0 && (
                      <Section key={store.store.id} title={`${store.store.name} — ${store.itemCount} ${t('inventory.items')} · ${t('inventory.totalValue')} : ${fmt(store.totalValue)} Ar`} icon={Package} defaultOpen={false}>
                        <div className="flex gap-3 mb-3 text-xs">
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                            OK : {store.itemCount - store.lowStockCount - store.outOfStockCount}
                          </span>
                          {store.lowStockCount > 0 && <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100">{t('inventory.lowStock')} : {store.lowStockCount}</span>}
                          {store.outOfStockCount > 0 && <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">{t('inventory.outOfStock')} : {store.outOfStockCount}</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40">
                                <th className="p-2 text-left">{t('inventory.itemName')}</th>
                                <th className="p-2 text-left">{t('inventory.category')}</th>
                                <th className="p-2 text-left">{t('inventory.unit')}</th>
                                <th className="p-2 text-right">{t('inventory.quantity')}</th>
                                <th className="p-2 text-right">{t('inventory.min')}</th>
                                <th className="p-2 text-right">{t('inventory.max')}</th>
                                <th className="p-2 text-right">{t('inventory.costPrice')}</th>
                                <th className="p-2 text-right">{t('inventory.stockValue')}</th>
                                <th className="p-2 text-center">{t('common.status')}</th>
                               </tr>
                            </thead>
                            <tbody>
                              {store.items.map((item: any) => (
                                <tr key={item.itemId} className={`border-b hover:bg-muted/20 ${item.status === "out" ? "bg-red-50/40" : item.status === "low" ? "bg-amber-50/40" : ""}`}>
                                  <td className="p-2 font-medium">{item.name}</td>
                                  <td className="p-2 text-muted-foreground text-xs">{item.category ?? "—"}</td>
                                  <td className="p-2 text-xs">{item.unit}</td>
                                  <td className="p-2 text-right font-semibold">{item.qty}</td>
                                  <td className="p-2 text-right text-muted-foreground">{item.minQty}</td>
                                  <td className="p-2 text-right text-muted-foreground">{item.maxQty}</td>
                                  <td className="p-2 text-right">{fmt(item.costPrice)} Ar</td>
                                  <td className="p-2 text-right font-medium">{fmt(item.stockValue)} Ar</td>
                                  <td className="p-2 text-center">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.status === "out" ? "bg-red-100 text-red-800" : item.status === "low" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                                      {item.status === "out" ? t('inventory.outOfStockBadge') : item.status === "low" ? t('inventory.lowStockBadge') : "OK"}
                                    </span>
                                  </td>
                                 </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/40 font-semibold">
                                <td colSpan={7} className="p-2 text-right">{t('inventory.totalValue')}</td>
                                <td className="p-2 text-right">{fmt(store.totalValue)} Ar</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </Section>
                    )
                  ))}
                </>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}