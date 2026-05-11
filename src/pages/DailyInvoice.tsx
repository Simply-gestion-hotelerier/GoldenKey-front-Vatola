// src/pages/invoices/DailyInvoice.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Department } from "@/state/AppState";
import { useState } from "react";
import { Receipt, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import React from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function padLine(left: string, right: string, width = 42): string {
  const space = width - left.length - right.length;
  return left + " ".repeat(Math.max(1, space)) + right;
}

function centerLine(text: string, width = 42): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

const METHOD_LABEL: Record<string, string> = {
  cash:   "Espèces",
  card:   "Carte",
  mobile: "Mobile",
  bank:   "Virement",
};

const METHOD_ICON: Record<string, string> = {
  cash:   "💵",
  card:   "💳",
  mobile: "📱",
  bank:   "🏦",
};

type PaymentDetail = {
  id: number;
  method: string;
  amount: number;
  receivedAmount: number;
  change: number;
  receivedAt: string;
  operatorName: string | null;
  operatorUser: string | null;
  operatorDisplay: string | null;
};

type LineDetail = {
  itemName: string;
  qty: number;
  unitPrice: number;
  total: number;
};

type OrderDetail = {
  id: number;
  tableId: number | null;
  openedAt: string;
  closedAt: string | null;
  status: string;
  lines: LineDetail[];
  payments: PaymentDetail[];
  subtotal: number;
  discountAmount: number;
  discountType: string;
  discountReason: string | null;
  orderTotal: number;
  paid: number;
  receivedAmount: number;
  change: number;
  remaining: number;
};

type SaleData = {
  lines: { label: string; qty: number; unit: number; total: number }[];
  total: number;
  ordersDetail: OrderDetail[];
};

type HotelReservation = {
  guestName: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rate: number;
  total: number;
  status: string;
  folioBalance: number;
};

type HotelData = {
  reservations: HotelReservation[];
  total: number;
  occupancyRate: number;
  arrivals: number;
  departures: number;
  inHouse: number;
};

function operatorLabel(p: PaymentDetail): string | null {
  return p.operatorDisplay ?? p.operatorUser ?? p.operatorName ?? null;
}

export default function DailyInvoice() {
  const { t } = useTranslation();
  const today = new Date();
  const localYmd = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const [date, setDate] = useState<string>(localYmd);
  const [dept, setDept] = useState<Department>("restaurant");
  const [currency, setCurrency] = useState<"MGA" | "EUR" | "USD">("MGA");
  const [rates, setRates] = useState<{ EUR: number; USD: number }>({ EUR: 5000, USD: 4500 });

  const { data: saleData = { lines: [], total: 0, ordersDetail: [] } } = useQuery<SaleData>({
    queryKey: ["report", "daily", dept, date],
    queryFn: () => api.get<SaleData>(`/reports/daily?dept=${dept}&date=${date}`),
    enabled: dept !== "hotel",
  });

  const { data: hotelData = { reservations: [], total: 0, occupancyRate: 0, arrivals: 0, departures: 0, inHouse: 0 } } = useQuery<HotelData>({
    queryKey: ["report", "daily", "hotel", date],
    queryFn: () => api.get<HotelData>(`/reports/daily?dept=hotel&date=${date}`),
    enabled: dept === "hotel",
  });

  const lines = dept !== "hotel" ? (saleData.lines ?? []) : [];
  const ordersDetail = saleData.ordersDetail ?? [] as OrderDetail[];
  const hotelReservations = hotelData.reservations ?? [];
  const total = dept !== "hotel" ? (saleData.total ?? 0) : (hotelData.total ?? 0);

  const convert = (amountMGA: number) => {
    if (currency === "MGA") return amountMGA;
    const rate = currency === "EUR" ? rates.EUR : rates.USD;
    return Math.round(amountMGA / (rate || 1));
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const getDeptLabel = () => {
    const labels: Record<string, string> = {
      hotel: t('dailyInvoice.hotel'),
      restaurant: t('dailyInvoice.restaurant'),
      pub: t('dailyInvoice.pub'),
      spa: t('dailyInvoice.spa')
    };
    return labels[dept] || dept;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      checked_in: t('dailyInvoice.statusCheckedIn'),
      checked_out: t('dailyInvoice.statusCheckedOut'),
      booked: t('dailyInvoice.statusBooked')
    };
    return labels[status] || status;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: t('dailyInvoice.cashMethod'),
      card: t('dailyInvoice.cardMethod'),
      mobile: t('dailyInvoice.mobileMethod'),
      bank: t('dailyInvoice.bankMethod')
    };
    return labels[method] || method;
  };

  const onPrintA4 = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const style = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', ui-sans-serif, system-ui; padding: 32px 40px; color: #111; font-size: 12px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #111; padding-bottom: 4px; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-size: 11px; border-bottom: 2px solid #e5e7eb; }
        th.r, td.r { text-align: right; }
        td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
        tfoot td { font-weight: 700; border-top: 2px solid #111; padding-top: 6px; }
        .order-block { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 16px; padding: 12px 16px; page-break-inside: avoid; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .badge-green  { background: #d1fae5; color: #065f46; }
        .badge-yellow { background: #fef3c7; color: #92400e; }
        .badge-blue   { background: #dbeafe; color: #1e40af; }
        .badge-red    { background: #fee2e2; color: #991b1b; }
        .operator-pill { display:inline-block; background:#ede9fe; color:#4c1d95; border-radius:4px; padding:1px 6px; font-size:10px; font-weight:600; }
        @media print { body { padding: 16px 20px; } }
      </style>`;

    let bodyHtml = "";

    if (dept === "hotel") {
      const kpis = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">${t('dailyInvoice.occupancyRate')}</div><div style="font-size:20px;font-weight:700">${hotelData.occupancyRate ?? "-"}%</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">${t('dailyInvoice.arrivals')}</div><div style="font-size:20px;font-weight:700">${hotelData.arrivals ?? 0}</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">${t('dailyInvoice.departures')}</div><div style="font-size:20px;font-weight:700">${hotelData.departures ?? 0}</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">${t('dailyInvoice.inHouse')}</div><div style="font-size:20px;font-weight:700">${hotelData.inHouse ?? 0}</div></div>
        </div>`;

      const rows = hotelReservations.map((r) => {
        const badge = r.status === "checked_in" ? `<span class="badge badge-green">${t('dailyInvoice.statusCheckedIn')}</span>` :
                      r.status === "checked_out" ? `<span class="badge badge-blue">${t('dailyInvoice.statusCheckedOut')}</span>` :
                      r.status === "booked" ? `<span class="badge badge-yellow">${t('dailyInvoice.statusBooked')}</span>` :
                      `<span class="badge badge-red">${r.status}</span>`;
        return `<tr><td>${r.guestName}</td><td>${r.roomNumber} (${r.roomType})</td><td>${r.checkIn}</td><td>${r.checkOut}</td><td class="r">${r.nights}</td><td class="r">${fmt(convert(r.rate))} ${currency}</td><td class="r">${fmt(convert(r.total))} ${currency}</td><td class="r" style="color:${r.folioBalance > 0 ? "#dc2626" : "#059669"}">${fmt(convert(r.folioBalance))} ${currency}</td><td>${badge}</td></tr>`;
      }).join("");

      bodyHtml = `${kpis}
        <h2>${t('dailyInvoice.reservations', { date })}</h2>
        <table><thead><tr><th>${t('dailyInvoice.guest')}</th><th>${t('dailyInvoice.room')}</th><th>${t('dailyInvoice.checkIn')}</th><th>${t('dailyInvoice.checkOut')}</th><th class="r">${t('dailyInvoice.nights')}</th><th class="r">${t('dailyInvoice.ratePerNight')}</th><th class="r">${t('dailyInvoice.total')}</th><th class="r">${t('dailyInvoice.folioBalance')}</th><th>${t('common.status')}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9" style="color:#6b7280;text-align:center;padding:12px">${t('dailyInvoice.noReservations')}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="6" class="r">${t('dailyInvoice.totalRevenue')}</td><td class="r">${fmt(convert(total))} ${currency}</td><td colspan="2"></td></tr></tfoot>
        </table>`;
    } else if (dept === "restaurant" || dept === "pub") {
      let rows = "";
      if (ordersDetail.length === 0) {
        rows = `<tr><td colspan="9" style="color:#6b7280;text-align:center;padding:14px">${t('dailyInvoice.noOrders')}</td></tr>`;
      } else {
        for (const o of ordersDetail) {
          const statusBadge = o.status === "closed" ? `<span class="badge badge-green">${t('dailyInvoice.statusClosed')}</span>` : `<span class="badge badge-yellow">${t('dailyInvoice.statusOpen')}</span>`;
          const due = o.remaining > 0 ? `&nbsp;<span style="color:#dc2626;font-weight:600;font-size:10px">⚠ ${t('dailyInvoice.remainingDue')} : ${fmt(convert(o.remaining))} ${currency}</span>` : "";

          rows += `<tr style="background:#f3f4f6;border-top:2px solid #d1d5db">
            <td colspan="9" style="padding:6px 8px"><strong>${t('dailyInvoice.order')} #${o.id}${o.tableId ? ` — ${t('dailyInvoice.table')} ${o.tableId}` : ""}</strong>&nbsp;${statusBadge}&nbsp;<span style="color:#6b7280;font-size:10px">${t('dailyInvoice.openedAt')} : ${fmtTime(o.openedAt)}${o.closedAt ? ` · ${t('dailyInvoice.closedAt')} : ${fmtTime(o.closedAt)}` : ""}</span>${due}</td></tr>`;

          for (const l of o.lines) {
            rows += `<tr><td style="padding-left:20px">${l.itemName}</td><td class="r">${l.qty}</td><td class="r" style="color:#6b7280">${fmt(convert(l.unitPrice))} ${currency}</td><td class="r">${fmt(convert(l.total))} ${currency}</td><td colspan="5"></td></tr>`;
          }

          if (o.discountAmount > 0) {
            const pct = o.discountType === "percent" ? ` (${Math.round((o.discountAmount / o.subtotal) * 100)}%)` : ` (${t('dailyInvoice.fixedDiscount')})`;
            rows += `<tr style="background:#fffbeb;border-bottom:1px solid #fcd34d">
              <td style="padding:4px 8px 4px 20px;color:#b45309;font-style:italic;font-size:10px" colspan="2">🏷 ${t('dailyInvoice.discount')}${pct}${o.discountReason ? ` — ${t('dailyInvoice.discountReason')}: ${o.discountReason}` : ""}</td>
              <td class="r" style="color:#b45309;font-weight:600">−${fmt(convert(o.discountAmount))} ${currency}</td>
              <td class="r" style="font-weight:700">${fmt(convert(o.orderTotal))} ${currency}</td><td colspan="5"></td></tr>`;
          }

          rows += `<tr style="background:#fafafa;border-bottom:1px dashed #e5e7eb">
            <td colspan="3" style="text-align:right;padding:4px 8px;font-size:10px;color:#6b7280;font-style:italic">${t('dailyInvoice.subtotal')} #${o.id}</td>
            <td class="r" style="padding:4px 8px;font-weight:600">${fmt(convert(o.subtotal))} ${currency}</td><td colspan="5"></td></tr>`;

          if (o.payments.length === 0) {
            rows += `<tr style="border-bottom:1px solid #f3f4f6"><td colspan="4"></td><td colspan="5" style="padding:4px 8px;color:#9ca3af;font-style:italic;font-size:10px">${t('dailyInvoice.noPayments')}</td></tr>`;
          } else {
            for (const p of o.payments) {
              const op = operatorLabel(p);
              const receivedDisplay = p.receivedAmount !== p.amount ? `${fmt(convert(p.receivedAmount))} ${currency}` : "—";
              const changeDisplay = p.change > 0 ? `${fmt(convert(p.change))} ${currency}` : "—";

              rows += `<tr style="background:#eff6ff50;border-bottom:1px solid #f3f4f6">
                <td colspan="4"></td><td style="padding:4px 8px;font-size:10px;color:#6b7280">${fmtDate(p.receivedAt)}</td>
                <td style="padding:4px 8px"><span style="font-size:10px;font-weight:600;background:#e5e7eb;border-radius:4px;padding:1px 6px">${getMethodLabel(p.method)}</span></td>
                <td class="r" style="padding:4px 8px;font-size:10px;font-weight:600">${receivedDisplay}</td>
                <td class="r" style="padding:4px 8px;font-size:10px;font-weight:600;color:${p.change > 0 ? "#059669" : "#9ca3af"}">${changeDisplay}</td>
                <td style="padding:4px 8px;font-size:10px">${op ? `<span class="operator-pill">👤 ${op}</span>` : `<span style="color:#9ca3af">—</span>`}</td>
              </tr>`;
            }
          }
        }
      }

      bodyHtml = `<h2>${getDeptLabel()} — ${date}</h2>
        <table><thead><tr><th>${t('dailyInvoice.designation')}</th><th class="r">${t('dailyInvoice.qty')}</th><th class="r">${t('dailyInvoice.unitPrice')}</th><th class="r">${t('dailyInvoice.totalPrice')}</th><th>${t('dailyInvoice.paymentDate')}</th><th>${t('dailyInvoice.paymentMethod')}</th><th class="r">${t('dailyInvoice.amountReceived')}</th><th class="r">${t('dailyInvoice.changeGiven')}</th><th>${t('dailyInvoice.operator')}</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3" class="r" style="font-size:13px">${t('dailyInvoice.dailyTotal')}</td><td class="r" style="font-size:13px">${fmt(convert(total))} ${currency}</td><td colspan="5"></td></table></tfoot>
      </table>`;
    } else {
      const rows = lines.map((l) => `<tr><td>${l.label}</td><td class="r">${l.qty}</td><td class="r">${fmt(convert(l.unit))} ${currency}</td><td class="r">${fmt(convert(l.total))} ${currency}</td></tr>`).join("");
      bodyHtml = `<h2>${t('dailyInvoice.sales')} — ${getDeptLabel()}</h2>
        <table><thead><tr><th>${t('dailyInvoice.designation')}</th><th class="r">${t('dailyInvoice.qty')}</th><th class="r">${t('dailyInvoice.unitPrice')}</th><th class="r">${t('dailyInvoice.totalPrice')}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="color:#6b7280;text-align:center;padding:12px">${t('common.noData')}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="3" class="r">${t('dailyInvoice.dailyTotal')}</td><td class="r">${fmt(convert(total))} ${currency}</td></tr></tfoot>
      </table>`;
    }

    const html = `<html><head><meta charset="utf-8"/>${style}</head><body>
      <h1>${t('dailyInvoice.title')} — ${getDeptLabel()}</h1>
      <div class="meta">${t('dailyInvoice.date')} : ${date} &nbsp;|&nbsp; ${t('dailyInvoice.currency')} : ${currency} &nbsp;|&nbsp; ${t('dailyInvoice.printedAt')} : ${new Date().toLocaleString("fr-FR")}</div>
      ${bodyHtml}
    </body></html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const onPrint80mm = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const W = 42;
    const sep = "─".repeat(W);
    const dblSep = "═".repeat(W);

    const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines80: string[] = [
      centerLine(getDeptLabel().toUpperCase(), W),
      centerLine(t('dailyInvoice.dailyInvoiceTitle'), W),
      centerLine(`${t('dailyInvoice.date')} : ${date}`, W),
      dblSep,
    ];

    if (dept === "hotel") {
      lines80.push(
        centerLine(`${t('dailyInvoice.occupancyRate')}: ${hotelData.occupancyRate ?? "-"}%  ${t('dailyInvoice.arrivals')}: ${hotelData.arrivals ?? 0}  ${t('dailyInvoice.departures')}: ${hotelData.departures ?? 0}`, W),
        sep
      );
      if (hotelReservations.length === 0) {
        lines80.push(centerLine(`-- ${t('dailyInvoice.noReservations')} --`, W));
      } else {
        hotelReservations.forEach((r, i) => {
          if (i > 0) lines80.push(sep);
          lines80.push(padLine(r.guestName.substring(0, 20), `${t('dailyInvoice.room')}.${r.roomNumber}`, W));
          lines80.push(padLine(`  ${r.nights} ${t('dailyInvoice.nights')} x ${fmt(convert(r.rate))}`, `${fmt(convert(r.total))} ${currency}`, W));
          if (r.folioBalance > 0) lines80.push(padLine(`  ${t('dailyInvoice.folioBalance')}:`, `${fmt(convert(r.folioBalance))} ${currency}`, W));
        });
      }
    } else if (dept === "restaurant" || dept === "pub") {
      if (ordersDetail.length === 0) {
        lines80.push(centerLine(`-- ${t('dailyInvoice.noOrders')} --`, W));
      } else {
        ordersDetail.forEach((o, i) => {
          if (i > 0) lines80.push(sep);
          lines80.push(centerLine(`${t('dailyInvoice.order')} #${o.id}${o.tableId ? ` - ${t('dailyInvoice.table')} ${o.tableId}` : ""}`, W));
          lines80.push(padLine(`  ${t('dailyInvoice.openedAt')} ${fmtTime(o.openedAt)}`, o.closedAt ? `${t('dailyInvoice.closedAt')} ${fmtTime(o.closedAt)}` : t('dailyInvoice.statusOpen'), W));
          lines80.push("·".repeat(W));
          o.lines.forEach((l) => {
            lines80.push(padLine(`  ${l.itemName.substring(0, 22)} x${l.qty}`, `${fmt(convert(l.total))} ${currency}`, W));
            if (l.qty > 1) lines80.push(padLine(`    ${t('dailyInvoice.unitPrice')}: ${fmt(convert(l.unitPrice))} ${currency}`, "", W).trimEnd());
          });
          if (o.discountAmount > 0) {
            const pct = o.discountType === "percent" ? ` (${Math.round((o.discountAmount / o.subtotal) * 100)}%)` : "";
            lines80.push(padLine(`  ${t('dailyInvoice.discount')}${pct}:`, `-${fmt(convert(o.discountAmount))} ${currency}`, W));
            if (o.discountReason) lines80.push(`    ${t('dailyInvoice.discountReason')}: ${o.discountReason.substring(0, 28)}`);
          }
          lines80.push("·".repeat(W), padLine(`  ${t('dailyInvoice.netTotal')}`, `${fmt(convert(o.orderTotal))} ${currency}`, W));
          if (o.payments.length > 0) {
            lines80.push(`  ${t('dailyInvoice.payments')}:`);
            o.payments.forEach((p) => {
              const method = getMethodLabel(p.method).substring(0, 10);
              const dateStr = new Date(p.receivedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
              const op = operatorLabel(p);
              lines80.push(padLine(`  [${method}] ${dateStr}`, `${fmt(convert(p.amount))} ${currency}`, W));
              if (p.receivedAmount !== p.amount) lines80.push(padLine(`    ${t('dailyInvoice.amountReceived')}:`, `${fmt(convert(p.receivedAmount))} ${currency}`, W));
              if (p.change > 0) lines80.push(padLine(`    ${t('dailyInvoice.changeGiven')}:`, `${fmt(convert(p.change))} ${currency}`, W));
              if (op) lines80.push(`    ${t('dailyInvoice.operator')}: ${op.substring(0, 20)}`);
            });
          }
          if (o.remaining > 0) lines80.push(padLine(`  ** ${t('dailyInvoice.remainingDue')}:`, `${fmt(convert(o.remaining))} ${currency}`, W));
        });
      }
    } else {
      if (lines.length === 0) {
        lines80.push(centerLine(`-- ${t('common.noData')} --`, W));
      } else {
        lines.forEach((l) => lines80.push(padLine(`${l.label.substring(0, 22)} x${l.qty}`, `${fmt(convert(l.total))} ${currency}`, W)));
      }
    }

    lines80.push(dblSep, padLine(t('dailyInvoice.dailyTotal'), `${fmt(convert(total))} ${currency}`, W), dblSep);
    lines80.push(centerLine(`${t('dailyInvoice.printedAt')} ${new Date().toLocaleString("fr-FR")}`, W), "");

    const fullText = lines80.join("\n");
    const style = `<style>@page { size: 80mm auto; margin: 2mm 3mm; } body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.45; white-space: pre; color: #000; background: #fff; }</style>`;
    const html = `<html><head><meta charset="utf-8"/>${style}</head><body>${escHtml(fullText)}</body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Receipt className="h-7 w-7" />{t('dailyInvoice.title')}</h1>
            <p className="text-muted-foreground">{t('dailyInvoice.subtitle')}</p>
          </div>

          <Card>
            <CardHeader><CardTitle>{t('dailyInvoice.parameters')}</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>{t('dailyInvoice.department')}</Label>
                <Select value={dept} onValueChange={(v) => setDept(v as Department)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">{t('dailyInvoice.hotel')}</SelectItem>
                    <SelectItem value="restaurant">{t('dailyInvoice.restaurant')}</SelectItem>
                    <SelectItem value="pub">{t('dailyInvoice.pub')}</SelectItem>
                    <SelectItem value="spa">{t('dailyInvoice.spa')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('dailyInvoice.date')}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('dailyInvoice.currency')}</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MGA">MGA (Ariary)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {currency !== "MGA" && (
                <div className="space-y-2">
                  <Label>{t('dailyInvoice.exchangeRate', { currency })}</Label>
                  <Input type="number" min={1} value={currency === "EUR" ? rates.EUR : rates.USD}
                    onChange={(e) => setRates((r) => currency === "EUR" ? { ...r, EUR: Number(e.target.value) || 1 } : { ...r, USD: Number(e.target.value) || 1 })} />
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button variant="outline" className="flex-1" onClick={onPrint80mm}><Printer className="mr-2 h-4 w-4" />{t('dailyInvoice.print80mm')}</Button>
                <Button className="flex-1" onClick={onPrintA4}><Receipt className="mr-2 h-4 w-4" />{t('dailyInvoice.printA4')}</Button>
              </div>
            </CardContent>
          </Card>

          {dept === "hotel" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t('dailyInvoice.occupancyRate'), value: `${hotelData.occupancyRate ?? "-"}%` },
                  { label: t('dailyInvoice.arrivals'), value: hotelData.arrivals ?? 0 },
                  { label: t('dailyInvoice.departures'), value: hotelData.departures ?? 0 },
                  { label: t('dailyInvoice.inHouse'), value: hotelData.inHouse ?? 0 },
                ].map((kpi) => (
                  <Card key={kpi.label}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{kpi.label}</p><p className="text-2xl font-bold">{kpi.value}</p></CardContent></Card>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle>{t('dailyInvoice.reservations', { date })}</CardTitle></CardHeader>
                <CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="p-2 text-left">{t('dailyInvoice.guest')}</th><th className="p-2 text-left">{t('dailyInvoice.room')}</th><th className="p-2 text-left">{t('dailyInvoice.checkIn')}</th><th className="p-2 text-left">{t('dailyInvoice.checkOut')}</th><th className="p-2 text-right">{t('dailyInvoice.nights')}</th><th className="p-2 text-right">{t('dailyInvoice.ratePerNight')}</th><th className="p-2 text-right">{t('dailyInvoice.total')}</th><th className="p-2 text-right">{t('dailyInvoice.folioBalance')}</th><th className="p-2 text-left">{t('common.status')}</th></tr></thead>
                <tbody>{hotelReservations.length === 0 ? <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">{t('dailyInvoice.noReservations')}</td></tr> : hotelReservations.map((r, idx) => (<tr key={idx} className="border-b hover:bg-muted/20"><td className="p-2 font-medium">{r.guestName}</td><td className="p-2">{r.roomNumber} <span className="text-muted-foreground text-xs">({r.roomType})</span></td><td className="p-2">{r.checkIn}</td><td className="p-2">{r.checkOut}</td><td className="p-2 text-right">{r.nights}</td><td className="p-2 text-right">{fmt(convert(r.rate))} {currency}</td><td className="p-2 text-right font-semibold">{fmt(convert(r.total))} {currency}</td><td className={`p-2 text-right font-semibold ${r.folioBalance > 0 ? "text-destructive" : "text-green-600"}`}>{fmt(convert(r.folioBalance))} {currency}</td><td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "checked_in" ? "bg-green-100 text-green-800" : r.status === "checked_out" ? "bg-blue-100 text-blue-800" : r.status === "booked" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>{getStatusLabel(r.status)}</span></td></tr>))}</tbody>
                <tfoot><tr className="bg-muted/40"><td colSpan={6} className="p-2 text-right font-semibold">{t('dailyInvoice.totalRevenue')}</td><td className="p-2 text-right font-bold text-lg">{fmt(convert(total))} {currency}</td><td colSpan={2} /></tr></tfoot></table></div></CardContent>
              </Card>
            </>
          )}

          {(dept === "restaurant" || dept === "pub") && (
            <Card><CardHeader><CardTitle>{getDeptLabel()} — {date}</CardTitle></CardHeader>
            <CardContent className="p-0"><div className="overflow-auto">{ordersDetail.length === 0 ? <p className="p-6 text-center text-muted-foreground">{t('dailyInvoice.noOrders')}</p> : <table className="w-full text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-2 pl-4">{t('dailyInvoice.order')} / {t('dailyInvoice.designation')}</th><th className="text-center p-2">{t('dailyInvoice.qty')}</th><th className="text-right p-2">{t('dailyInvoice.unitPrice')}</th><th className="text-right p-2">{t('dailyInvoice.totalPrice')}</th><th className="text-left p-2">{t('dailyInvoice.paymentDate')}</th><th className="text-left p-2">{t('dailyInvoice.paymentMethod')}</th><th className="text-right p-2">{t('dailyInvoice.amountReceived')}</th><th className="text-right p-2">{t('dailyInvoice.changeGiven')}</th><th className="text-left p-2 pr-4">{t('dailyInvoice.operator')}</th></tr></thead>
            <tbody>{ordersDetail.map((order, oi) => (<React.Fragment key={oi}><tr className="bg-muted/30 border-t-2 border-border"><td colSpan={9} className="p-2 pl-4"><div className="flex items-center gap-3 flex-wrap"><span className="font-semibold">{t('dailyInvoice.order')} #{order.id}{order.tableId ? ` — ${t('dailyInvoice.table')} ${order.tableId}` : ""}</span><span className="text-muted-foreground text-xs">{t('dailyInvoice.openedAt')}: {fmtTime(order.openedAt)}{order.closedAt ? ` · ${t('dailyInvoice.closedAt')}: ${fmtTime(order.closedAt)}` : ""}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.status === "closed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{order.status === "closed" ? t('dailyInvoice.statusClosed') : t('dailyInvoice.statusOpen')}</span>{order.remaining > 0 && <span className="text-xs text-destructive font-semibold">⚠ {t('dailyInvoice.remainingDue')}: {fmt(convert(order.remaining))} {currency}</span>}</div></td></tr>
            {order.lines.map((l, li) => (<tr key={li} className="border-b border-border/50"><td className="p-2 pl-8">{l.itemName}</td><td className="p-2 text-center">{l.qty}</td><td className="p-2 text-right text-muted-foreground">{fmt(convert(l.unitPrice))} {currency}</td><td className="p-2 text-right font-medium">{fmt(convert(l.total))} {currency}</td><td colSpan={5} /></tr>))}
            {order.discountAmount > 0 && (<tr className="border-b border-amber-200 bg-amber-50/40"><td className="p-1.5 pl-8 text-amber-700 text-xs italic">🏷 {t('dailyInvoice.discount')}{order.discountType === "percent" ? ` (${Math.round((order.discountAmount / order.subtotal) * 100)}%)` : ` (${t('dailyInvoice.fixedDiscount')})`}{order.discountReason ? ` — ${order.discountReason}` : ""}</td><td colSpan={2} className="p-1.5 text-right text-xs text-amber-600">− {fmt(convert(order.discountAmount))} {currency}</td><td className="p-1.5 text-right font-semibold text-sm text-amber-700">= {fmt(convert(order.orderTotal))} {currency}</td><td colSpan={5} /></tr>)}
            <tr className="bg-muted/10 border-b border-dashed border-border"><td colSpan={3} className="p-1.5 pl-8 text-right text-xs text-muted-foreground italic">{t('dailyInvoice.subtotal')} #{order.id}</td><td className="p-1.5 text-right font-semibold text-sm">{fmt(convert(order.subtotal))} {currency}</td><td colSpan={5} /></tr>
            {order.payments.length === 0 ? <tr><td colSpan={4} /><td colSpan={5} className="p-2 pr-4 text-xs text-muted-foreground italic">{t('dailyInvoice.noPayments')}</td></tr> : order.payments.map((p, pi) => (<tr key={pi} className="border-b border-border/30 bg-blue-50/30"><td colSpan={4} /><td className="p-2 text-xs text-muted-foreground">{fmtDate(p.receivedAt)}</td><td className="p-2"><span className="inline-flex items-center gap-1 text-xs font-medium bg-muted/50 px-2 py-0.5 rounded-full">{METHOD_ICON[p.method]} {getMethodLabel(p.method)}</span></td><td className="p-2 text-right text-xs">{p.receivedAmount !== p.amount ? <span className="font-semibold">{fmt(convert(p.receivedAmount))} {currency}</span> : <span className="text-muted-foreground">—</span>}</td><td className="p-2 text-right text-xs">{p.change > 0 ? <span className="font-semibold text-green-700">{fmt(convert(p.change))} {currency}</span> : <span className="text-muted-foreground">—</span>}</td><td className="p-2 pr-4 text-xs">{operatorLabel(p) ? <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-medium">👤 {operatorLabel(p)}</span> : <span className="text-muted-foreground">—</span>}</td></tr>))}
            </React.Fragment>))}</tbody>
            <tfoot><tr className="border-t-2 border-foreground bg-muted/40"><td colSpan={3} className="p-3 pl-4 text-right font-semibold">{t('dailyInvoice.dailyTotal')}</td><td className="p-3 text-right font-bold text-base">{fmt(convert(total))} {currency}</td><td colSpan={2} /><td className="p-3 text-right font-bold text-base">{fmt(convert(ordersDetail.flatMap(o => o.payments).filter(p => p.receivedAmount > p.amount).reduce((s, p) => s + p.receivedAmount, 0)))} {currency}</td><td className="p-3 text-right font-bold text-base text-green-700">{fmt(convert(ordersDetail.flatMap(o => o.payments).reduce((s, p) => s + p.change, 0)))} {currency}</td><td /></tr></tfoot></table>}</div></CardContent></Card>
          )}

          {dept === "spa" && (
            <Card><CardHeader><CardTitle>{t('dailyInvoice.sales')} — {getDeptLabel()}</CardTitle></CardHeader>
            <CardContent><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/40"><th className="text-left p-2">{t('dailyInvoice.designation')}</th><th className="text-left p-2">{t('dailyInvoice.qty')}</th><th className="text-right p-2">{t('dailyInvoice.unitPrice')}</th><th className="text-right p-2">{t('dailyInvoice.totalPrice')}</th></tr></thead>
            <tbody>{lines.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t('common.noData')}</td></tr> : lines.map((l, idx) => (<tr key={idx} className="border-b hover:bg-muted/20"><td className="p-2">{l.label}</td><td className="p-2">{l.qty}</td><td className="p-2 text-right">{fmt(convert(l.unit))} {currency}</td><td className="p-2 text-right">{fmt(convert(l.total))} {currency}</td></tr>))}</tbody>
            <tfoot><tr className="bg-muted/40"><td colSpan={3} className="p-2 text-right font-semibold">{t('dailyInvoice.dailyTotal')}</td><td className="p-2 text-right font-bold text-lg">{fmt(convert(total))} {currency}</td></tr></tfoot></table></div></CardContent></Card>
          )}
        </main>
      </div>
    </div>
  );
}