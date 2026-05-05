/**
 * GuestInvoice.tsx
 * Facture client individuelle (folio de réservation)
 * Affiche les commandes payées / impayées liées au folio
 * Impression ticket thermique 80 mm + PDF A4
 */
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  FileText, Printer, Search, CreditCard, AlertCircle,
  CheckCircle2, XCircle, ShoppingBag, ChevronDown, ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ── helpers ───────────────────────────────────────── */
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
  cash: "Espèces", card: "Carte bancaire", mobile: "Mobile Money", bank: "Virement",
};
const DEPT_COLORS: Record<string, string> = {
  hotel:      "bg-blue-100 text-blue-800",
  restaurant: "bg-orange-100 text-orange-800",
  pub:        "bg-purple-100 text-purple-800",
  spa:        "bg-teal-100 text-teal-800",
};

/* ── types ─────────────────────────────────────────── */
interface OrderLine {
  id: number;
  itemName: string;
  qty: number;
  unitPrice: number;
}
interface LinkedOrder {
  id: number;
  dept: string;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed" | "cancelled";
  paid: boolean;
  totalAmount: number;
  paidAmount: number;
  lines: OrderLine[];
}
interface FolioCharge {
  id: number;
  description: string;
  qty: number;
  unitPrice: number;
  department: string;
  createdAt: string;
}
interface FolioPayment {
  id: number;
  amount: number;
  method: string;
  receivedAt: string;
}
interface GuestFolio {
  folioId: number;
  invoiceNumber?: string;
  reservationId: number;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  guestAddress?: string;
  guestCompany?: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  ratePerNight: number;
  charges: FolioCharge[];
  payments: FolioPayment[];
  orders: LinkedOrder[];
  totalCharges: number;
  totalPayments: number;
  balance: number;
  status: "open" | "closed";
}

/* ══════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════ */
export default function GuestInvoice() {
  const [search, setSearch]   = useState("");
  const [folioId, setFolioId] = useState<number | null>(null);
  const [currency, setCurrency] = useState<"MGA" | "EUR" | "USD">("MGA");
  const [rates]               = useState({ EUR: 5000, USD: 4500 });
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());
  const [orderFilter, setOrderFilter] = useState<"all" | "paid" | "unpaid">("all");

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["folio-search", search],
    queryFn: () =>
      api.get<{ folioId: number; guestName: string; roomNumber: string; checkIn: string; status: string }[]>(
        `/folios/search?q=${encodeURIComponent(search)}`
      ),
    enabled: search.trim().length >= 2,
  });

  const { data: folio, isLoading } = useQuery({
    queryKey: ["folio", folioId],
    queryFn: () => api.get<GuestFolio>(`/folios/${folioId}`),
    enabled: folioId !== null,
  });

  const convert = (mga: number) => {
    if (currency === "MGA") return mga;
    return Math.round(mga / (currency === "EUR" ? rates.EUR : rates.USD));
  };
  const sym = currency;

  const toggleOrder = (id: number) =>
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allOrders   = folio?.orders ?? [];
  const paidOrders  = allOrders.filter((o) =>  o.paid);
  const unpaidOrders = allOrders.filter((o) => !o.paid);
  const unpaidTotal = unpaidOrders.reduce((s, o) => s + (o.totalAmount - o.paidAmount), 0);
  const filteredOrders = allOrders.filter((o) => {
    if (orderFilter === "paid")   return o.paid;
    if (orderFilter === "unpaid") return !o.paid;
    return true;
  });

  /* ── Print 80 mm ───────────────────────────────────── */
  const onPrint80mm = () => {
    if (!folio) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const W   = 42;
    const sep = "=".repeat(W);
    const dsh = "-".repeat(W);

    const lines: string[] = [
      centerLine("HOTEL / FACTURE CLIENT", W),
      centerLine(folio.guestName.toUpperCase(), W),
      folio.guestCompany ? centerLine(folio.guestCompany, W) : "",
      sep,
      padLine("Chambre :", `${folio.roomNumber} (${folio.roomType})`, W),
      padLine("Arrivee :", folio.checkIn, W),
      padLine("Depart  :", folio.checkOut, W),
      padLine("Nuits   :", String(folio.nights), W),
      sep,
      centerLine("-- HEBERGEMENT --", W),
      dsh,
      padLine(`Chambre x${folio.nights}`, fmt(convert(folio.ratePerNight * folio.nights)) + " " + sym, W),
      ...folio.charges
        .filter((c) => !c.description.toLowerCase().includes("chambre"))
        .map((c) =>
          padLine(c.description.substring(0, 26) + (c.qty > 1 ? ` x${c.qty}` : ""), fmt(convert(c.unitPrice * c.qty)) + " " + sym, W)
        ),
    ].filter(Boolean);

    if (allOrders.length > 0) {
      lines.push(dsh);
      lines.push(centerLine("-- COMMANDES --", W));
      allOrders.forEach((o) => {
        const tag = o.paid ? "[PAYE]" : "[IMPAYE]";
        lines.push(padLine(`${o.dept.toUpperCase()} #${o.id} ${tag}`, fmt(convert(o.totalAmount)) + " " + sym, W));
        o.lines.forEach((l) =>
          lines.push("  " + padLine(l.itemName.substring(0, 20) + ` x${l.qty}`, fmt(convert(l.unitPrice * l.qty)) + " " + sym, W - 2))
        );
      });
    }

    lines.push(dsh);
    lines.push(padLine("TOTAL CHARGES", fmt(convert(folio.totalCharges)) + " " + sym, W));
    if (unpaidTotal > 0)
      lines.push(padLine("dont IMPAYE", fmt(convert(unpaidTotal)) + " " + sym, W));
    lines.push(dsh);
    folio.payments.forEach((p) => {
      const m = { cash: "Especes", card: "CB", mobile: "Mobile", bank: "Virement" }[p.method] ?? p.method;
      lines.push(padLine(`  Paiement (${m})`, fmt(convert(p.amount)) + " " + sym, W));
    });
    lines.push(sep);
    const balLabel = folio.balance > 0 ? "SOLDE DU" : folio.balance < 0 ? "AVOIR" : "SOLDE";
    lines.push(padLine(balLabel, fmt(convert(Math.abs(folio.balance))) + " " + sym, W));
    lines.push(sep);
    lines.push("");
    lines.push(centerLine("Merci de votre sejour !", W));
    lines.push(centerLine(new Date().toLocaleString("fr-FR"), W));
    lines.push(""); lines.push("");

    const style = `<style>@page{size:80mm auto;margin:2mm 3mm}body{font-family:'Courier New',monospace;font-size:11px;line-height:1.5;white-space:pre;color:#000}</style>`;
    win.document.write(
      `<html><head><meta charset="utf-8"/>${style}</head><body>${lines.join("\n").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</body></html>`
    );
    win.document.close(); win.focus(); win.print(); win.close();
  };

  /* ── Print A4 ──────────────────────────────────────── */
  const onPrintA4 = () => {
    if (!folio) return;
    const win = window.open("", "_blank");
    if (!win) return;

    const chargeRows = [
      `<tr style="background:#eff6ff">
        <td>${folio.checkIn}</td><td>Chambre ${folio.roomNumber} (${folio.roomType})</td>
        <td><span style="background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:4px;font-size:10px">HOTEL</span></td>
        <td style="text-align:right">${fmt(convert(folio.ratePerNight))} ${sym}</td>
        <td style="text-align:right">${folio.nights}</td>
        <td style="text-align:right;font-weight:600">${fmt(convert(folio.ratePerNight * folio.nights))} ${sym}</td></tr>`,
      ...folio.charges.filter(c => !c.description.toLowerCase().includes("chambre")).map(c =>
        `<tr><td>${new Date(c.createdAt).toLocaleDateString("fr-FR")}</td>
         <td>${c.description}</td>
         <td><span style="background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:10px">${c.department.toUpperCase()}</span></td>
         <td style="text-align:right">${fmt(convert(c.unitPrice))} ${sym}</td>
         <td style="text-align:right">${c.qty}</td>
         <td style="text-align:right">${fmt(convert(c.unitPrice * c.qty))} ${sym}</td></tr>`
      ),
    ].join("");

    const orderRows = allOrders.map(o => {
      const badge = o.paid
        ? `<span style="background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:4px;font-size:10px">PAYE</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:10px">IMPAYE</span>`;
      const sub = o.lines.map(l =>
        `<tr style="background:#fafafa"><td style="padding:3px 10px 3px 26px;color:#6b7280" colspan=2>↳ ${l.itemName} x${l.qty}</td>
         <td></td><td style="text-align:right;color:#6b7280">${fmt(convert(l.unitPrice))} ${sym}</td>
         <td style="text-align:right;color:#6b7280">${l.qty}</td>
         <td style="text-align:right;color:#6b7280">${fmt(convert(l.unitPrice * l.qty))} ${sym}</td></tr>`
      ).join("");
      return `<tr${!o.paid ? ' style="background:#fff5f5"' : ''}>
        <td>${new Date(o.openedAt).toLocaleDateString("fr-FR")}</td>
        <td>Commande #${o.id} — ${o.dept.toUpperCase()}</td>
        <td>${badge}</td>
        <td style="text-align:right">—</td>
        <td style="text-align:right">${o.lines.reduce((s,l)=>s+l.qty,0)}</td>
        <td style="text-align:right;font-weight:600">${fmt(convert(o.totalAmount))} ${sym}</td></tr>${sub}`;
    }).join("");

    const html = `<html><head><meta charset="utf-8"/>
    <style>
      @page{size:A4;margin:20mm} *{box-sizing:border-box}
      body{font-family:'Segoe UI',ui-sans-serif;color:#111;font-size:12px}
      h1{font-size:22px;margin:0 0 4px}
      h2{font-size:13px;margin:20px 0 6px;padding-left:8px;border-left:3px solid #111;font-weight:700}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      thead th{background:#111;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      tbody td{padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px}
      tfoot td{font-weight:700;border-top:2px solid #111;padding:7px 10px}
      .guest{background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px}
      .stay{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
      .stay div{background:#f3f4f6;border-radius:6px;padding:8px}
      .stay small{display:block;color:#6b7280;font-size:10px}
      .totals{float:right;width:260px}
      .totals td{border:none!important;padding:4px 8px;font-size:12px}
      .bal{padding:12px;border-radius:8px;font-weight:700;text-align:right;margin-top:12px;clear:both}
    </style></head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:20px">
        <div><h1>Facture Client</h1><div style="color:#6b7280;font-size:12px">Système PMS Hôtel</div></div>
        <div style="text-align:right;color:#6b7280;font-size:12px">
          <strong style="display:block;font-size:16px;color:#111">${folio.invoiceNumber ?? "Folio #" + folio.folioId}</strong>
          Émis le ${new Date().toLocaleDateString("fr-FR")}
        </div>
      </div>
      <div class="guest">
        <strong style="font-size:14px">${folio.guestName}</strong>
        ${folio.guestCompany ? `<div>${folio.guestCompany}</div>` : ""}
        ${folio.guestEmail   ? `<div>${folio.guestEmail}</div>`   : ""}
        ${folio.guestPhone   ? `<div>${folio.guestPhone}</div>`   : ""}
      </div>
      <div class="stay">
        <div><small>Chambre</small><strong>${folio.roomNumber} (${folio.roomType})</strong></div>
        <div><small>Arrivée</small><strong>${folio.checkIn}</strong></div>
        <div><small>Départ</small><strong>${folio.checkOut}</strong></div>
        <div><small>Nuits</small><strong>${folio.nights}</strong></div>
      </div>

      <h2>Charges hébergement</h2>
      <table>
        <thead><tr><th>Date</th><th>Désignation</th><th>Dépt.</th><th style="text-align:right">P.U.</th><th style="text-align:right">Qté</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${chargeRows}</tbody>
      </table>

      ${allOrders.length > 0 ? `
      <h2>Commandes — ${paidOrders.length} payée(s) · ${unpaidOrders.length} impayée(s)</h2>
      <table>
        <thead><tr><th>Date</th><th>Désignation</th><th>Statut</th><th style="text-align:right">P.U.</th><th style="text-align:right">Qté</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${orderRows}</tbody>
        <tfoot>
          <tr><td colspan=5 style="text-align:right">Total commandes</td>
            <td style="text-align:right">${fmt(convert(allOrders.reduce((s,o)=>s+o.totalAmount,0)))} ${sym}</td></tr>
          ${unpaidTotal > 0 ? `<tr><td colspan=5 style="text-align:right;color:#dc2626">dont impayé</td>
            <td style="text-align:right;color:#dc2626">${fmt(convert(unpaidTotal))} ${sym}</td></tr>` : ""}
        </tfoot>
      </table>` : ""}

      <div class="totals">
        <table>
          <tr><td>Total charges</td><td style="text-align:right">${fmt(convert(folio.totalCharges))} ${sym}</td></tr>
          <tr><td style="color:#059669">Total paiements</td><td style="text-align:right;color:#059669">-${fmt(convert(folio.totalPayments))} ${sym}</td></tr>
          <tr style="border-top:2px solid #111"><td><strong>${folio.balance > 0 ? "SOLDE DÛ" : "SOLDÉ"}</strong></td>
            <td style="text-align:right"><strong>${fmt(convert(Math.abs(folio.balance)))} ${sym}</strong></td></tr>
        </table>
      </div>
      <div class="bal" style="${folio.balance > 0 ? "background:#fee2e2;color:#991b1b" : "background:#d1fae5;color:#065f46"}">
        ${folio.balance > 0 ? `Solde du : ${fmt(convert(folio.balance))} ${sym}` : "Compte solde — Merci pour votre sejour !"}
      </div>
      <div style="margin-top:32px;font-size:10px;color:#9ca3af;text-align:center">
        Imprime le ${new Date().toLocaleString("fr-FR")} — Folio #${folio.folioId}
      </div>
    </body></html>`;

    win.document.write(html); win.document.close(); win.focus(); win.print(); win.close();
  };

  /* ══ RENDER ══════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">

          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7" /> Facture client (folio)
            </h1>
            <p className="text-muted-foreground">
              Recherchez un client — commandes payées et impayées, impression 80 mm ou A4.
            </p>
          </div>

          {/* ── Search ── */}
          <Card>
            <CardHeader><CardTitle>Rechercher</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  placeholder="Nom du client, n° chambre, n° réservation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="border rounded-md divide-y max-h-48 overflow-auto">
                  {searching && <div className="p-3 text-sm text-muted-foreground">Recherche…</div>}
                  {!searching && searchResults.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">Aucun résultat</div>
                  )}
                  {searchResults.map((r) => (
                    <button
                      key={r.folioId}
                      className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center justify-between"
                      onClick={() => { setFolioId(r.folioId); setSearch(""); }}
                    >
                      <div>
                        <span className="font-medium">{r.guestName}</span>
                        <span className="text-muted-foreground ml-2 text-sm">
                          Ch. {r.roomNumber} — arrivée {r.checkIn}
                        </span>
                      </div>
                      <Badge variant={r.status === "open" ? "default" : "secondary"}>
                        {r.status === "open" ? "En cours" : "Clôturé"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Chargement du folio…</CardContent>
            </Card>
          )}

          {folio && !isLoading && (
            <>
              {/* ── Guest header ── */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="text-xl">{folio.guestName}</CardTitle>
                      <p className="text-muted-foreground text-sm mt-1">
                        Ch. {folio.roomNumber} ({folio.roomType}) · {folio.checkIn} → {folio.checkOut} · {folio.nights} nuit(s)
                      </p>
                      {folio.guestCompany && <p className="text-sm text-muted-foreground">{folio.guestCompany}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        className="text-sm border rounded px-2 py-1.5 bg-background"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as any)}
                      >
                        <option value="MGA">MGA</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                      <Button variant="outline" onClick={onPrint80mm}>
                        <Printer className="mr-2 h-4 w-4" /> 80 mm
                      </Button>
                      <Button onClick={onPrintA4}>
                        <FileText className="mr-2 h-4 w-4" /> PDF A4
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* ── Orders section ── */}
              {allOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Commandes
                        <span className="font-normal text-muted-foreground text-base">({allOrders.length})</span>
                      </CardTitle>
                      <div className="flex gap-2 text-sm">
                        <span className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {paidOrders.length} payée(s)
                        </span>
                        <span className="flex items-center gap-1 bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium">
                          <XCircle className="h-3.5 w-3.5" />
                          {unpaidOrders.length} impayée(s)
                          {unpaidTotal > 0 && ` · ${fmt(convert(unpaidTotal))} ${sym}`}
                        </span>
                      </div>
                    </div>
                    {/* Filter tabs */}
                    <div className="flex gap-1 mt-3">
                      {(["all", "paid", "unpaid"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setOrderFilter(f)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            orderFilter === f
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {{ all: "Toutes", paid: "✓ Payées", unpaid: "⚠ Impayées" }[f]}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {filteredOrders.length === 0 && (
                      <p className="text-sm text-muted-foreground py-3 text-center">Aucune commande dans ce filtre.</p>
                    )}
                    {filteredOrders.map((o) => {
                      const expanded  = expandedOrders.has(o.id);
                      const unpaidAmt = o.totalAmount - o.paidAmount;
                      return (
                        <div
                          key={o.id}
                          className={`border rounded-lg overflow-hidden transition-colors ${
                            !o.paid ? "border-red-200" : "border-green-200"
                          }`}
                        >
                          {/* Header row */}
                          <button
                            className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                              !o.paid ? "bg-red-50/50 hover:bg-red-50" : "bg-green-50/30 hover:bg-green-50/50"
                            }`}
                            onClick={() => toggleOrder(o.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              }
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">Commande #{o.id}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[o.dept] ?? "bg-gray-100 text-gray-700"}`}>
                                    {o.dept.toUpperCase()}
                                  </span>
                                  {o.paid ? (
                                    <span className="flex items-center gap-1 text-xs text-green-700 font-semibold">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Payée
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-red-700 font-semibold">
                                      <XCircle className="h-3.5 w-3.5" /> Impayée
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(o.openedAt).toLocaleString("fr-FR")}
                                  {o.closedAt && ` → ${new Date(o.closedAt).toLocaleString("fr-FR")}`}
                                  {" · "}{o.lines.reduce((s, l) => s + l.qty, 0)} article(s)
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <div className="font-semibold text-sm">{fmt(convert(o.totalAmount))} {sym}</div>
                              {!o.paid && o.paidAmount > 0 && (
                                <div className="text-xs text-red-600">Reste : {fmt(convert(unpaidAmt))} {sym}</div>
                              )}
                              {o.paid && <div className="text-xs text-green-600">Soldé</div>}
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {expanded && (
                            <div className="border-t bg-background">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/40">
                                    <th className="p-2 text-left">Article</th>
                                    <th className="p-2 text-right">P.U.</th>
                                    <th className="p-2 text-right">Qté</th>
                                    <th className="p-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.lines.map((l) => (
                                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                                      <td className="p-2">{l.itemName}</td>
                                      <td className="p-2 text-right">{fmt(convert(l.unitPrice))} {sym}</td>
                                      <td className="p-2 text-right">{l.qty}</td>
                                      <td className="p-2 text-right font-medium">{fmt(convert(l.unitPrice * l.qty))} {sym}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-muted/30">
                                    <td colSpan={3} className="p-2 text-right font-semibold">Sous-total</td>
                                    <td className="p-2 text-right font-bold">{fmt(convert(o.totalAmount))} {sym}</td>
                                  </tr>
                                  {o.paidAmount > 0 && (
                                    <tr>
                                      <td colSpan={3} className="p-2 text-right text-green-700">Paiements reçus</td>
                                      <td className="p-2 text-right text-green-700 font-medium">-{fmt(convert(o.paidAmount))} {sym}</td>
                                    </tr>
                                  )}
                                  {!o.paid && (
                                    <tr className="bg-red-50">
                                      <td colSpan={3} className="p-2 text-right font-semibold text-red-700">Reste dû</td>
                                      <td className="p-2 text-right font-bold text-red-700">{fmt(convert(unpaidAmt))} {sym}</td>
                                    </tr>
                                  )}
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* ── Folio charges ── */}
              <Card>
                <CardHeader><CardTitle>Charges hébergement</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-left">Désignation</th>
                        <th className="p-2 text-left">Dépt.</th>
                        <th className="p-2 text-right">P.U.</th>
                        <th className="p-2 text-right">Qté</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-blue-50/40">
                        <td className="p-2">{folio.checkIn}</td>
                        <td className="p-2 font-medium">Chambre {folio.roomNumber} ({folio.roomType})</td>
                        <td className="p-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">HÔTEL</span>
                        </td>
                        <td className="p-2 text-right">{fmt(convert(folio.ratePerNight))} {sym}</td>
                        <td className="p-2 text-right">{folio.nights}</td>
                        <td className="p-2 text-right font-semibold">{fmt(convert(folio.ratePerNight * folio.nights))} {sym}</td>
                      </tr>
                      {folio.charges
                        .filter((c) => !c.description.toLowerCase().includes("chambre"))
                        .map((c) => (
                          <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="p-2 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</td>
                            <td className="p-2">{c.description}</td>
                            <td className="p-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${DEPT_COLORS[c.department] ?? "bg-muted text-muted-foreground"}`}>
                                {c.department.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-2 text-right">{fmt(convert(c.unitPrice))} {sym}</td>
                            <td className="p-2 text-right">{c.qty}</td>
                            <td className="p-2 text-right">{fmt(convert(c.unitPrice * c.qty))} {sym}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40">
                        <td colSpan={5} className="p-2 text-right font-semibold">Total charges</td>
                        <td className="p-2 text-right font-bold">{fmt(convert(folio.totalCharges))} {sym}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {/* ── Payments ── */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" /> Paiements reçus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {folio.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Moyen</th>
                          <th className="p-2 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folio.payments.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-muted/20">
                            <td className="p-2">{new Date(p.receivedAt).toLocaleDateString("fr-FR")}</td>
                            <td className="p-2">{METHOD_LABEL[p.method] ?? p.method}</td>
                            <td className="p-2 text-right text-green-600 font-semibold">{fmt(convert(p.amount))} {sym}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/40">
                          <td colSpan={2} className="p-2 text-right font-semibold">Total paiements</td>
                          <td className="p-2 text-right font-bold text-green-600">{fmt(convert(folio.totalPayments))} {sym}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* ── Balance ── */}
              <Card className={folio.balance > 0 ? "border-destructive" : "border-green-500"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {folio.balance > 0
                        ? <AlertCircle className="h-5 w-5 text-destructive" />
                        : <CheckCircle2 className="h-5 w-5 text-green-600" />
                      }
                      <span className="font-semibold text-lg">
                        {folio.balance > 0 ? "Solde dû" : folio.balance < 0 ? "Avoir client" : "Compte soldé"}
                      </span>
                      {unpaidTotal > 0 && (
                        <span className="text-sm text-red-600 ml-1">
                          (dont {fmt(convert(unpaidTotal))} {sym} de commandes impayées)
                        </span>
                      )}
                    </div>
                    <span className={`text-2xl font-bold ${folio.balance > 0 ? "text-destructive" : "text-green-600"}`}>
                      {fmt(convert(Math.abs(folio.balance)))} {sym}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}