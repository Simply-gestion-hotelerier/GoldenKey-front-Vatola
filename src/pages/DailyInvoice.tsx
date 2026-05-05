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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentDetail = {
  id:              number;
  method:          string;
  amount:          number;
  receivedAmount:  number;
  change:          number;
  receivedAt:      string;
  operatorName:    string | null;
  operatorUser:    string | null;
  operatorDisplay: string | null;
};

type LineDetail = {
  itemName:  string;
  qty:       number;
  unitPrice: number;
  total:     number;
};

type OrderDetail = {
  id:             number;
  tableId:        number | null;
  openedAt:       string;
  closedAt:       string | null;
  status:         string;
  lines:          LineDetail[];
  payments:       PaymentDetail[];
  subtotal:       number;
  discountAmount: number;
  discountType:   string;
  discountReason: string | null;
  orderTotal:     number;
  paid:           number;
  receivedAmount: number;
  change:         number;
  remaining:      number;
};

type SaleData = {
  lines:        { label: string; qty: number; unit: number; total: number }[];
  total:        number;
  ordersDetail: OrderDetail[];
};

type HotelReservation = {
  guestName:    string;
  roomNumber:   string;
  roomType:     string;
  checkIn:      string;
  checkOut:     string;
  nights:       number;
  rate:         number;
  total:        number;
  status:       string;
  folioBalance: number;
};

type HotelData = {
  reservations:  HotelReservation[];
  total:         number;
  occupancyRate: number;
  arrivals:      number;
  departures:    number;
  inHouse:       number;
};

// ─── Opérateur affiché ───────────────────────────────────────────────────────

function operatorLabel(p: PaymentDetail): string | null {
  return p.operatorDisplay ?? p.operatorUser ?? p.operatorName ?? null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DailyInvoice() {
  const today    = new Date();
  const localYmd = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  const [date,     setDate]     = useState<string>(localYmd);
  const [dept,     setDept]     = useState<Department>("restaurant");
  const [currency, setCurrency] = useState<"MGA" | "EUR" | "USD">("MGA");
  const [rates,    setRates]    = useState<{ EUR: number; USD: number }>({ EUR: 5000, USD: 4500 });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: saleData = { lines: [], total: 0, ordersDetail: [] } } =
    useQuery<SaleData>({
      queryKey: ["report", "daily", dept, date],
      queryFn:  () => api.get<SaleData>(`/reports/daily?dept=${dept}&date=${date}`),
      enabled:  dept !== "hotel",
    });

  const { data: hotelData = { reservations: [], total: 0, occupancyRate: 0, arrivals: 0, departures: 0, inHouse: 0 } } =
    useQuery<HotelData>({
      queryKey: ["report", "daily", "hotel", date],
      queryFn:  () => api.get<HotelData>(`/reports/daily?dept=hotel&date=${date}`),
      enabled:  dept === "hotel",
    });

  // ── Dérivés ────────────────────────────────────────────────────────────────

  const lines             = dept !== "hotel" ? (saleData.lines        ?? []) : [];
  const ordersDetail      = saleData.ordersDetail ?? [] as OrderDetail[];
  const hotelReservations = hotelData.reservations ?? [];
  const total             = dept !== "hotel" ? (saleData.total ?? 0) : (hotelData.total ?? 0);

  console.log("SaleData:", saleData);

  const convert = (amountMGA: number) => {
    if (currency === "MGA") return amountMGA;
    const rate = currency === "EUR" ? rates.EUR : rates.USD;
    return Math.round(amountMGA / (rate || 1));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // ── Impression A4 ──────────────────────────────────────────────────────────

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

    const deptLabel: Record<string, string> = {
      hotel: "Hôtel", restaurant: "Restaurant", pub: "Pub / Bar", spa: "Spa",
    };

    let bodyHtml = "";

    // ── Hôtel ──
    if (dept === "hotel") {
      const kpis = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">Taux d'occupation</div><div style="font-size:20px;font-weight:700">${hotelData.occupancyRate ?? "-"}%</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">Arrivées</div><div style="font-size:20px;font-weight:700">${hotelData.arrivals ?? 0}</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">Départs</div><div style="font-size:20px;font-weight:700">${hotelData.departures ?? 0}</div></div>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px"><div style="font-size:10px;color:#6b7280">En chambre</div><div style="font-size:20px;font-weight:700">${hotelData.inHouse ?? 0}</div></div>
        </div>`;

      const rows = hotelReservations.map((r) => {
        const badge =
          r.status === "checked_in"  ? `<span class="badge badge-green">En chambre</span>`  :
          r.status === "checked_out" ? `<span class="badge badge-blue">Départ</span>`        :
          r.status === "booked"      ? `<span class="badge badge-yellow">Réservé</span>`     :
                                       `<span class="badge badge-red">${r.status}</span>`;
        return `<tr>
          <td>${r.guestName}</td><td>${r.roomNumber} (${r.roomType})</td>
          <td>${r.checkIn}</td><td>${r.checkOut}</td>
          <td class="r">${r.nights}</td>
          <td class="r">${fmt(convert(r.rate))} ${currency}</td>
          <td class="r">${fmt(convert(r.total))} ${currency}</td>
          <td class="r" style="color:${r.folioBalance > 0 ? "#dc2626" : "#059669"}">${fmt(convert(r.folioBalance))} ${currency}</td>
          <td>${badge}</td>
        </tr>`;
      }).join("");

      bodyHtml = `${kpis}
        <h2>Réservations du ${date}</h2>
        <table>
          <thead><tr>
            <th>Client</th><th>Chambre</th><th>Arrivée</th><th>Départ</th>
            <th class="r">Nuits</th><th class="r">Tarif/nuit</th><th class="r">Total</th>
            <th class="r">Solde folio</th><th>Statut</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="9" style="color:#6b7280;text-align:center;padding:12px">Aucune réservation</td></tr>`}</tbody>
          <tfoot><tr><td colspan="6" class="r">Total revenus hôtel</td><td class="r">${fmt(convert(total))} ${currency}</td><td colspan="2"></td></tr></tfoot>
        </table>`;
    }

    // ── Restaurant / Pub ──
    else if (dept === "restaurant" || dept === "pub") {
      let rows = "";

      if (ordersDetail.length === 0) {
        rows = `<tr><td colspan="9" style="color:#6b7280;text-align:center;padding:14px">Aucune commande pour cette date</td></tr>`;
      } else {
        for (const o of ordersDetail) {
          const statusBadge = o.status === "closed"
            ? `<span class="badge badge-green">Fermée</span>`
            : `<span class="badge badge-yellow">Ouverte</span>`;
          const due = o.remaining > 0
            ? `&nbsp;<span style="color:#dc2626;font-weight:600;font-size:10px">⚠ Reste dû : ${fmt(convert(o.remaining))} ${currency}</span>`
            : "";

          rows += `<tr style="background:#f3f4f6;border-top:2px solid #d1d5db">
            <td colspan="9" style="padding:6px 8px">
              <strong>Commande #${o.id}${o.tableId ? ` — Table ${o.tableId}` : ""}</strong>
              &nbsp;${statusBadge}
              &nbsp;<span style="color:#6b7280;font-size:10px">Ouverte : ${fmtTime(o.openedAt)}${o.closedAt ? ` · Fermée : ${fmtTime(o.closedAt)}` : ""}</span>
              ${due}
            </td>
          </tr>`;

          for (const l of o.lines) {
            rows += `<tr>
              <td style="padding-left:20px">${l.itemName}</td>
              <td class="r">${l.qty}</td>
              <td class="r" style="color:#6b7280">${fmt(convert(l.unitPrice))} ${currency}</td>
              <td class="r">${fmt(convert(l.total))} ${currency}</td>
              <td colspan="5"></td>
            </tr>`;
          }

          if (o.discountAmount > 0) {
            const pct = o.discountType === "percent"
              ? ` (${Math.round((o.discountAmount / o.subtotal) * 100)}%)`
              : " (fixe)";
            rows += `<tr style="background:#fffbeb;border-bottom:1px solid #fcd34d">
              <td style="padding:4px 8px 4px 20px;color:#b45309;font-style:italic;font-size:10px" colspan="2">
                🏷 Remise${pct}${o.discountReason ? ` — ${o.discountReason}` : ""}
              </td>
              <td class="r" style="color:#b45309;font-weight:600">
                −${fmt(convert(o.discountAmount))} ${currency}
              </td>
              <td class="r" style="font-weight:700">
                ${fmt(convert(o.orderTotal))} ${currency}
              </td>
              <td colspan="5"></td>
            </tr>`;
          }

          rows += `<tr style="background:#fafafa;border-bottom:1px dashed #e5e7eb">
            <td colspan="3" style="text-align:right;padding:4px 8px;font-size:10px;color:#6b7280;font-style:italic">Sous-total (brut) #${o.id}</td>
            <td class="r" style="padding:4px 8px;font-weight:600">${fmt(convert(o.subtotal))} ${currency}</td>
            <td colspan="5"></td>
          </tr>`;

          if (o.payments.length === 0) {
            rows += `<tr style="border-bottom:1px solid #f3f4f6">
              <td colspan="4"></td>
              <td colspan="5" style="padding:4px 8px;color:#9ca3af;font-style:italic;font-size:10px">Aucun paiement enregistré</td>
            </tr>`;
          } else {
            for (const p of o.payments) {
              const op = operatorLabel(p);
              // Montant reçu : on l'affiche seulement si différent du montant dû
              const receivedDisplay = p.receivedAmount !== p.amount
                ? `${fmt(convert(p.receivedAmount))} ${currency}`
                : "—";
              // Monnaie rendue
              const changeDisplay = p.change > 0
                ? `${fmt(convert(p.change))} ${currency}`
                : "—";

              rows += `<tr style="background:#eff6ff50;border-bottom:1px solid #f3f4f6">
                <td colspan="4"></td>
                <td style="padding:4px 8px;font-size:10px;color:#6b7280">${fmtDate(p.receivedAt)}</td>
                <td style="padding:4px 8px">
                  <span style="font-size:10px;font-weight:600;background:#e5e7eb;border-radius:4px;padding:1px 6px">${METHOD_LABEL[p.method] ?? p.method}</span>
                </td>
                <td class="r" style="padding:4px 8px;font-size:10px;font-weight:600">${receivedDisplay}</td>
                <td class="r" style="padding:4px 8px;font-size:10px;font-weight:600;color:${p.change > 0 ? "#059669" : "#9ca3af"}">${changeDisplay}</td>
                <td style="padding:4px 8px;font-size:10px">
                  ${op
                    ? `<span class="operator-pill">👤 ${op}</span>`
                    : `<span style="color:#9ca3af">—</span>`
                  }
                </td>
              </tr>`;
            }
          }
        }
      }

      bodyHtml = `
        <h2>${deptLabel[dept]} — ${date}</h2>
        <table>
          <thead><tr>
            <th>Désignation</th>
            <th class="r">Qté</th>
            <th class="r">PU</th>
            <th class="r">Total article</th>
            <th>Date paiement</th>
            <th>Moyen</th>
            <th class="r">Montant reçu</th>
            <th class="r">Monnaie rendue</th>
            <th>Opérateur</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="3" class="r" style="font-size:13px">Total journée</td>
            <td class="r" style="font-size:13px">${fmt(convert(total))} ${currency}</td>
            <td colspan="5"></td>
          </tr></tfoot>
        </table>`;
    }

    // ── Spa ──
    else {
      const rows = lines.map((l) =>
        `<tr>
          <td>${l.label}</td><td class="r">${l.qty}</td>
          <td class="r">${fmt(convert(l.unit))} ${currency}</td>
          <td class="r">${fmt(convert(l.total))} ${currency}</td>
        </tr>`
      ).join("");

      bodyHtml = `
        <h2>Ventes — ${deptLabel[dept]}</h2>
        <table>
          <thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU</th><th class="r">Total</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" style="color:#6b7280;text-align:center;padding:12px">Aucune donnée</td></tr>`}</tbody>
          <tfoot><tr><td colspan="3" class="r">Total</td><td class="r">${fmt(convert(total))} ${currency}</td></tr></tfoot>
        </table>`;
    }

    const html = `<html><head><meta charset="utf-8"/>${style}</head><body>
      <h1>Facture journalière — ${deptLabel[dept] ?? dept.toUpperCase()}</h1>
      <div class="meta">Date : ${date} &nbsp;|&nbsp; Devise : ${currency} &nbsp;|&nbsp; Imprimé le : ${new Date().toLocaleString("fr-FR")}</div>
      ${bodyHtml}
    </body></html>`;

    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // ── Impression 80 mm ───────────────────────────────────────────────────────

  const onPrint80mm = () => {
    const win = window.open("", "_blank");
    if (!win) return;

    const W      = 42;
    const sep    = "─".repeat(W);
    const dblSep = "═".repeat(W);

    const deptLabel: Record<string, string> = {
      hotel: "HOTEL", restaurant: "RESTAURANT", pub: "PUB / BAR", spa: "SPA",
    };

    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines80: string[] = [
      centerLine(deptLabel[dept] ?? dept.toUpperCase(), W),
      centerLine("*** FACTURE JOURNALIERE ***", W),
      centerLine(`Date : ${date}`, W),
      dblSep,
    ];

    if (dept === "hotel") {
      lines80.push(
        centerLine(`Occupation: ${hotelData.occupancyRate ?? "-"}%  Arr: ${hotelData.arrivals ?? 0}  Dep: ${hotelData.departures ?? 0}`, W),
        sep
      );
      if (hotelReservations.length === 0) {
        lines80.push(centerLine("-- Aucune reservation --", W));
      } else {
        hotelReservations.forEach((r, i) => {
          if (i > 0) lines80.push(sep);
          lines80.push(
            padLine(r.guestName.substring(0, 20), `Ch.${r.roomNumber}`, W),
            padLine(`  ${r.nights} nuit(s) x ${fmt(convert(r.rate))}`, `${fmt(convert(r.total))} ${currency}`, W)
          );
          if (r.folioBalance > 0)
            lines80.push(padLine("  Solde du:", `${fmt(convert(r.folioBalance))} ${currency}`, W));
        });
      }
    }

    else if (dept === "restaurant" || dept === "pub") {
      if (ordersDetail.length === 0) {
        lines80.push(centerLine("-- Aucune commande --", W));
      } else {
        ordersDetail.forEach((o, i) => {
          if (i > 0) lines80.push(sep);

          lines80.push(
            centerLine(`CMD #${o.id}${o.tableId ? ` - Table ${o.tableId}` : ""}`, W),
            padLine(`  Ouverte ${fmtTime(o.openedAt)}`, o.closedAt ? `Fermee ${fmtTime(o.closedAt)}` : "En cours", W),
            "·".repeat(W)
          );

          o.lines.forEach((l) => {
            lines80.push(padLine(`  ${l.itemName.substring(0, 22)} x${l.qty}`, `${fmt(convert(l.total))} ${currency}`, W));
            if (l.qty > 1)
              lines80.push(padLine(`    PU: ${fmt(convert(l.unitPrice))} ${currency}`, "", W).trimEnd());
          });

          if (o.discountAmount > 0) {
            const pct = o.discountType === "percent"
              ? ` (${Math.round((o.discountAmount / o.subtotal) * 100)}%)`
              : "";
            lines80.push(padLine(`  Remise${pct}:`, `-${fmt(convert(o.discountAmount))} ${currency}`, W));
            if (o.discountReason)
              lines80.push(`    Motif: ${o.discountReason.substring(0, 28)}`);
          }

          lines80.push(
            "·".repeat(W),
            padLine("  Total net", `${fmt(convert(o.orderTotal))} ${currency}`, W)
          );

          if (o.payments.length > 0) {
            lines80.push("  Paiements:");
            o.payments.forEach((p) => {
              const method  = (METHOD_LABEL[p.method] ?? p.method).substring(0, 10);
              const dateStr = new Date(p.receivedAt).toLocaleString("fr-FR", {
                day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
              });
              const op = operatorLabel(p);
              lines80.push(padLine(`  [${method}] ${dateStr}`, `${fmt(convert(p.amount))} ${currency}`, W));
              // Montant reçu : uniquement si différent du montant dû
              if (p.receivedAmount !== p.amount)
                lines80.push(padLine(`    Recu:`, `${fmt(convert(p.receivedAmount))} ${currency}`, W));
              if (p.change > 0)
                lines80.push(padLine(`    Monnaie rendue:`, `${fmt(convert(p.change))} ${currency}`, W));
              if (op)
                lines80.push(`    Operateur: ${op.substring(0, 20)}`);
            });
          }

          if (o.remaining > 0)
            lines80.push(padLine("  ** RESTE DU:", `${fmt(convert(o.remaining))} ${currency}`, W));
        });
      }
    }

    else {
      if (lines.length === 0) {
        lines80.push(centerLine("-- Aucune donnee --", W));
      } else {
        lines.forEach((l) =>
          lines80.push(padLine(`${l.label.substring(0, 22)} x${l.qty}`, `${fmt(convert(l.total))} ${currency}`, W))
        );
      }
    }

    lines80.push(
      dblSep,
      padLine("TOTAL JOURNEE", `${fmt(convert(total))} ${currency}`, W),
      dblSep,
      centerLine(`Imprime le ${new Date().toLocaleString("fr-FR")}`, W),
      ""
    );

    const fullText = lines80.join("\n");
    const style = `
      <style>
        @page { size: 80mm auto; margin: 2mm 3mm; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.45; white-space: pre; color: #000; background: #fff; }
      </style>`;

    const html = `<html><head><meta charset="utf-8"/>${style}</head><body>${escHtml(fullText)}</body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-7 w-7" /> Facture journalière
            </h1>
            <p className="text-muted-foreground">
              Choisissez un département et une date, puis exportez en PDF ou imprimez en ticket 80 mm
            </p>
          </div>

          {/* ── Paramètres ── */}
          <Card>
            <CardHeader><CardTitle>Paramètres</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Département</Label>
                <Select value={dept} onValueChange={(v) => setDept(v as Department)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hôtel</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="pub">Pub / Bar</SelectItem>
                    <SelectItem value="spa">Spa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Devise</Label>
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
                  <Label>Taux {currency} → MGA</Label>
                  <Input
                    type="number" min={1}
                    value={currency === "EUR" ? rates.EUR : rates.USD}
                    onChange={(e) =>
                      setRates((r) =>
                        currency === "EUR"
                          ? { ...r, EUR: Number(e.target.value) || 1 }
                          : { ...r, USD: Number(e.target.value) || 1 }
                      )
                    }
                  />
                </div>
              )}
              <div className="flex items-end gap-2">
                <Button variant="outline" className="flex-1" onClick={onPrint80mm}>
                  <Printer className="mr-2 h-4 w-4" /> 80 mm
                </Button>
                <Button className="flex-1" onClick={onPrintA4}>
                  <Receipt className="mr-2 h-4 w-4" /> PDF A4
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ══ VUE HÔTEL ══════════════════════════════════════════════════════ */}
          {dept === "hotel" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Taux d'occupation", value: `${hotelData.occupancyRate ?? "-"}%` },
                  { label: "Arrivées",   value: hotelData.arrivals   ?? 0 },
                  { label: "Départs",    value: hotelData.departures  ?? 0 },
                  { label: "En chambre", value: hotelData.inHouse     ?? 0 },
                ].map((kpi) => (
                  <Card key={kpi.label}>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle>Réservations du {date}</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 text-left">Client</th>
                          <th className="p-2 text-left">Chambre</th>
                          <th className="p-2 text-left">Arrivée</th>
                          <th className="p-2 text-left">Départ</th>
                          <th className="p-2 text-right">Nuits</th>
                          <th className="p-2 text-right">Tarif / nuit</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Solde folio</th>
                          <th className="p-2 text-left">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hotelReservations.length === 0 ? (
                          <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Aucune réservation pour cette date</td></tr>
                        ) : (
                          hotelReservations.map((r, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                              <td className="p-2 font-medium">{r.guestName}</td>
                              <td className="p-2">{r.roomNumber} <span className="text-muted-foreground text-xs">({r.roomType})</span></td>
                              <td className="p-2">{r.checkIn}</td>
                              <td className="p-2">{r.checkOut}</td>
                              <td className="p-2 text-right">{r.nights}</td>
                              <td className="p-2 text-right">{fmt(convert(r.rate))} {currency}</td>
                              <td className="p-2 text-right font-semibold">{fmt(convert(r.total))} {currency}</td>
                              <td className={`p-2 text-right font-semibold ${r.folioBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                                {fmt(convert(r.folioBalance))} {currency}
                              </td>
                              <td className="p-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  r.status === "checked_in"  ? "bg-green-100 text-green-800"  :
                                  r.status === "checked_out" ? "bg-blue-100 text-blue-800"    :
                                  r.status === "booked"      ? "bg-yellow-100 text-yellow-800" :
                                                               "bg-red-100 text-red-800"
                                }`}>
                                  {r.status === "checked_in"  ? "En chambre" :
                                   r.status === "checked_out" ? "Départ"     :
                                   r.status === "booked"      ? "Réservé"    : r.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/40">
                          <td colSpan={6} className="p-2 text-right font-semibold">Total revenus hôtel</td>
                          <td className="p-2 text-right font-bold text-lg">{fmt(convert(total))} {currency}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ══ VUE RESTAURANT / PUB ══════════════════════════════════════════ */}
          {(dept === "restaurant" || dept === "pub") && (
            <Card>
              <CardHeader>
                <CardTitle>{dept === "restaurant" ? "Restaurant" : "Pub / Bar"} — {date}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto">
                  {ordersDetail.length === 0 ? (
                    <p className="p-6 text-center text-muted-foreground">Aucune commande pour cette date</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          <th className="text-left p-2 pl-4">Commande / Désignation</th>
                          <th className="text-center p-2">Qté</th>
                          <th className="text-right p-2">PU</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-left p-2">Date paiement</th>
                          <th className="text-left p-2">Moyen</th>
                          <th className="text-right p-2">Montant reçu</th>
                          <th className="text-right p-2">Monnaie rendue</th>
                          <th className="text-left p-2 pr-4">Opérateur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersDetail.map((order) => (
                          <>
                            {/* En-tête commande */}
                            <tr key={`oh-${order.id}`} className="bg-muted/30 border-t-2 border-border">
                              <td colSpan={9} className="p-2 pl-4">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="font-semibold text-foreground">
                                    Commande #{order.id}{order.tableId ? ` — Table ${order.tableId}` : ""}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    Ouverte : {fmtTime(order.openedAt)}
                                    {order.closedAt ? ` · Fermée : ${fmtTime(order.closedAt)}` : ""}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    order.status === "closed"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {order.status === "closed" ? "Fermée" : "Ouverte"}
                                  </span>
                                  {order.remaining > 0 && (
                                    <span className="text-xs text-destructive font-semibold">
                                      ⚠ Reste dû : {fmt(convert(order.remaining))} {currency}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Lignes articles */}
                            {order.lines.map((l, li) => (
                              <tr key={`ol-${order.id}-${li}`} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                                <td className="p-2 pl-8 text-foreground/80">{l.itemName}</td>
                                <td className="p-2 text-center">{l.qty}</td>
                                <td className="p-2 text-right text-muted-foreground">{fmt(convert(l.unitPrice))} {currency}</td>
                                <td className="p-2 text-right font-medium">{fmt(convert(l.total))} {currency}</td>
                                <td colSpan={5} />
                              </tr>
                            ))}

                            {/* Ligne remise */}
                            {order.discountAmount > 0 && (
                              <tr key={`disc-${order.id}`} className="border-b border-amber-200 bg-amber-50/40">
                                <td className="p-1.5 pl-8 text-amber-700 text-xs italic">
                                  🏷 Remise
                                  {order.discountType === "percent"
                                    ? ` (${Math.round((order.discountAmount / order.subtotal) * 100)}%)`
                                    : " (fixe)"}
                                  {order.discountReason ? ` — ${order.discountReason}` : ""}
                                </td>
                                <td colSpan={2} className="p-1.5 text-right text-xs text-amber-600">
                                  − {fmt(convert(order.discountAmount))} {currency}
                                </td>
                                <td className="p-1.5 text-right font-semibold text-sm text-amber-700">
                                  = {fmt(convert(order.orderTotal))} {currency}
                                </td>
                                <td colSpan={5} />
                              </tr>
                            )}

                            {/* Sous-total brut */}
                            <tr key={`os-${order.id}`} className="bg-muted/10 border-b border-dashed border-border">
                              <td colSpan={3} className="p-1.5 pl-8 text-right text-xs text-muted-foreground italic">
                                Sous-total commande #{order.id}
                              </td>
                              <td className="p-1.5 text-right font-semibold text-sm">
                                {fmt(convert(order.subtotal))} {currency}
                              </td>
                              <td colSpan={5} />
                            </tr>

                            {/* Lignes paiements */}
                            {order.payments.length === 0 ? (
                              <tr key={`onp-${order.id}`} className="border-b border-border/30">
                                <td colSpan={4} />
                                <td colSpan={5} className="p-2 pr-4 text-xs text-muted-foreground italic">
                                  Aucun paiement enregistré
                                </td>
                              </tr>
                            ) : (
                              order.payments.map((p, pi) => {
                                const op = operatorLabel(p);
                                // Montant reçu : affiché uniquement si supérieur au montant dû
                                const showReceived = p.receivedAmount > p.amount;
                                return (
                                  <tr key={`op-${order.id}-${pi}`} className="border-b border-border/30 bg-blue-50/30 hover:bg-blue-50/50 transition-colors">
                                    <td colSpan={4} />
                                    <td className="p-2 text-xs text-muted-foreground">{fmtDate(p.receivedAt)}</td>
                                    <td className="p-2">
                                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted/50 px-2 py-0.5 rounded-full">
                                        {METHOD_ICON[p.method]} {METHOD_LABEL[p.method] ?? p.method}
                                      </span>
                                    </td>
                                    {/* Montant reçu */}
                                    <td className="p-2 text-right text-xs">
                                      {showReceived
                                        ? <span className="font-semibold">{fmt(convert(p.receivedAmount))} {currency}</span>
                                        : <span className="text-muted-foreground">—</span>
                                      }
                                    </td>
                                    {/* Monnaie rendue */}
                                    <td className="p-2 text-right text-xs">
                                      {p.change > 0
                                        ? <span className="font-semibold text-green-700">{fmt(convert(p.change))} {currency}</span>
                                        : <span className="text-muted-foreground">—</span>
                                      }
                                    </td>
                                    {/* Opérateur */}
                                    <td className="p-2 pr-4 text-xs">
                                      {op
                                        ? <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full font-medium">
                                            👤 {op}
                                          </span>
                                        : <span className="text-muted-foreground">—</span>
                                      }
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-foreground bg-muted/40">
                          <td colSpan={3} className="p-3 pl-4 text-right font-semibold">Total journée</td>
                          <td className="p-3 text-right font-bold text-base">{fmt(convert(total))} {currency}</td>
                          <td colSpan={2} />
                          {/* Total montants reçus (uniquement les paiements cash avec rendu) */}
                          <td className="p-3 text-right font-bold text-base">
                            {fmt(convert(
                              ordersDetail
                                .flatMap((o) => o.payments)
                                .filter((p) => p.receivedAmount > p.amount)
                                .reduce((s, p) => s + p.receivedAmount, 0)
                            ))} {currency}
                          </td>
                          {/* Total monnaie rendue */}
                          <td className="p-3 text-right font-bold text-base text-green-700">
                            {fmt(convert(
                              ordersDetail
                                .flatMap((o) => o.payments)
                                .reduce((s, p) => s + p.change, 0)
                            ))} {currency}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ══ VUE SPA ════════════════════════════════════════════════════════ */}
          {dept === "spa" && (
            <Card>
              <CardHeader><CardTitle>Ventes — Spa</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left p-2">Désignation</th>
                        <th className="text-left p-2">Qté</th>
                        <th className="text-right p-2">PU</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Aucune donnée pour cette date</td></tr>
                      ) : (
                        lines.map((l, idx) => (
                          <tr key={idx} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="p-2">{l.label}</td>
                            <td className="p-2">{l.qty}</td>
                            <td className="p-2 text-right">{fmt(convert(l.unit))} {currency}</td>
                            <td className="p-2 text-right">{fmt(convert(l.total))} {currency}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40">
                        <td colSpan={3} className="p-2 text-right font-semibold">Total</td>
                        <td className="p-2 text-right font-bold text-lg">{fmt(convert(total))} {currency}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </main>
      </div>
    </div>
  );
}