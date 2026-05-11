// src/pages/hotel/Reservations.tsx
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar as LayoutSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Plus, Search, Filter, Trash2, Download, ChevronDown, RefreshCw,
  FileSpreadsheet, FileText, FileCode, Table as TableIcon,
  CalendarDays, Users, Phone, Mail, CreditCard, MapPin, Clock,
  CheckCircle2, XCircle, Banknote, AlertCircle, LogIn, LogOut, Printer,
  Info, ArrowDownLeft, ArrowUpRight, Wallet, CircleDollarSign,
} from "lucide-react";
import { useTranslation } from "react-i18next";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReservationStatus = "booked" | "checked_in" | "checked_out" | "cancelled" | "no_show";
type RateMode = "per_night" | "per_stay";
type PaymentMethod = "cash" | "card" | "mobile" | "bank";

interface Room {
  id: number; number: string; type: string; status: string;
}
interface Guest {
  id: number; fullName: string;
  phone: string | null; email: string | null; notes: string | null;
}
interface FolioPaymentItem {
  id: number; amount: number; method: string; receivedAmount?: number | null;
  reference?: string | null;
}
interface Folio {
  id: number; total: number; balance: number;
  closedAt: string | null;
  payments: FolioPaymentItem[];
}
interface Reservation {
  id: number; roomId: number; guestId: number;
  checkIn: string; checkOut: string;
  status: ReservationStatus;
  rate: number;
  rateMode: RateMode;
  createdAt: string;
  guest: Guest; room: Room; folio?: Folio;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_META: Record<ReservationStatus, { badge: string; icon: React.ElementType }> = {
  booked: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400", icon: CheckCircle2 },
  checked_in: { badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400", icon: LogIn },
  checked_out: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", icon: LogOut },
  cancelled: { badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400", icon: XCircle },
  no_show: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400", icon: AlertCircle },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces", card: "Carte bancaire", mobile: "Mobile Money", bank: "Virement",
};

const ROOM_TYPES = ["Simple", "Double", "Triple", "Familial", "Deluxe", "Suite"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMGA  = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const fmtDate = (d: string) => format(new Date(d), "dd MMM yyyy", { locale: fr });
const fmtShort = (d: string) => format(new Date(d), "dd MMM", { locale: fr });

const countNights = (ci: string, co: string) =>
  Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000));

const unitLabel = (rateMode: RateMode, t: any): string =>
  rateMode === "per_stay" ? t('reservations.perStay') : t('reservations.perNight');

const fmtRateLabel = (rate: number, rateMode: RateMode, t: any): string =>
  rateMode === "per_stay"
    ? `${fmtMGA(rate)} MGA/${t('reservations.perStayLower')}`
    : `${fmtMGA(rate)} MGA/${t('reservations.perNightLower')}`;

const computeDisplayTotal = (rate: number, checkIn: string, checkOut: string): number =>
  rate * countNights(checkIn, checkOut);

const getCardFee = (amount: number) => Math.round(amount * 0.05);
const getCardTotal = (amount: number) => amount + getCardFee(amount);

const HOTEL = {
  name: "Mahafaly Hotel",
  address: "Antsirabe, Madagascar",
  phone: "+261 038 33 188 31",
  email: "info@mahafalyhotel.com",
  nif: "000000001",
};

// ── Helpers impression ────────────────────────────────────────────────────────
const W80   = 42;
const sep80  = "=".repeat(W80);
const dash80 = "-".repeat(W80);
const ctr    = (s: string, w: number) => { const p = Math.max(0, w - s.length); return " ".repeat(Math.floor(p / 2)) + s; };
const padL   = (lbl: string, val: string, w: number) => { const gap = Math.max(1, w - lbl.length - val.length); return lbl + " ".repeat(gap) + val; };
const fmtAr  = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const esc    = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Facture 80 mm ─────────────────────────────────────────────────────────────
function print80mm(r: Reservation, t: any) {
  const win = window.open("", "_blank"); if (!win) return;
  const n     = countNights(r.checkIn, r.checkOut);
  const total = r.folio?.total ?? r.rate * n;
  const paid  = (r.folio?.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, total - paid);
  const unit  = unitLabel(r.rateMode, t);

  const lines: string[] = [
    ctr(HOTEL.name, W80),
    ctr(HOTEL.address, W80),
    ctr(HOTEL.phone, W80),
    sep80,
    ctr(`** ${t('reservations.invoiceTitle')} **`, W80),
    sep80,
    padL(t('reservations.invoiceNumber'), `RES-${String(r.id).padStart(5, "0")}`, W80),
    padL(t('crm.customers'), r.guest.fullName.substring(0, 24), W80),
    padL(t('hotel.room'), `#${r.room.number} - ${r.room.type}`, W80),
    padL(t('hotel.arrivalDate'), new Date(r.checkIn).toLocaleDateString("fr-FR"), W80),
    padL(t('hotel.departureDate'), new Date(r.checkOut).toLocaleDateString("fr-FR"), W80),
    padL(t('reservations.duration'), `${n} ${unit}`, W80),
    padL(t('reservations.rateLabel'), fmtRateLabel(r.rate, r.rateMode, t), W80),
    padL(t('common.status'), STATUS_FR[r.status] ?? r.status, W80),
    dash80,
    ctr(`-- ${t('reservations.details')} --`, W80),
    dash80,
    padL(`${t('hotel.accommodation')} x${n}`, `${fmtAr(r.rate)} Ar`, W80),
    padL("", `= ${fmtAr(total)} Ar`, W80),
    dash80,
    padL(t('reservations.total'), `${fmtAr(total)} Ar`, W80),
    dash80,
  ];

  if ((r.folio?.payments ?? []).length > 0) {
    lines.push(ctr(`-- ${t('reservations.payments')} --`, W80));
    r.folio!.payments.forEach(p => {
      const methodLabel = (PAYMENT_LABELS as any)[p.method] ?? p.method;
      if (p.method === "card") {
        const fee      = getCardFee(p.amount);
        const cardTot  = getCardTotal(p.amount);
        lines.push(padL(`${methodLabel} (${t('reservations.collected')})`, `${fmtAr(p.amount)} Ar`, W80));
        lines.push(padL(`+ ${t('reservations.bankFee')} 5% (${t('reservations.info')})`, `${fmtAr(fee)} Ar`, W80));
        lines.push(padL(`= ${t('reservations.cardTotal')}`, `${fmtAr(cardTot)} Ar`, W80));
      } else {
        lines.push(padL(methodLabel, `${fmtAr(p.amount)} Ar`, W80));
        if (p.method === "cash" && p.receivedAmount && p.receivedAmount > p.amount) {
          const change = p.receivedAmount - p.amount;
          lines.push(padL(`  ${t('reservations.receivedFromCustomer')}`, `${fmtAr(p.receivedAmount)} Ar`, W80));
          lines.push(padL(`  ${t('reservations.changeGiven')}`, `${fmtAr(change)} Ar`, W80));
        }
      }
    });
    lines.push(dash80);
  }

  lines.push(ctr(`-- ${t('reservations.financialFollowup')} --`, W80));
  lines.push(padL(t('reservations.totalInvoice'), `${fmtAr(total)} Ar`, W80));
  lines.push(padL(t('reservations.alreadyCollected'), `${fmtAr(paid)} Ar`, W80));
  lines.push(padL(balance > 0 ? t('reservations.remainingDue') : t('reservations.balance'), `${fmtAr(balance)} Ar`, W80));
  lines.push(sep80, "", ctr(t('reservations.thankYou'), W80));
  lines.push(ctr(`${t('reservations.nif')} : ${HOTEL.nif}`, W80));
  lines.push(ctr(new Date().toLocaleString("fr-FR"), W80), "", "");

  win.document.write(`<html><head><meta charset="utf-8"/>
<style>
  @page { size: 80mm auto; margin: 2mm 3mm; }
  body  { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.6; white-space: pre; }
</style></head><body>${esc(lines.join("\n"))}</body></html>`);
  win.document.close(); win.focus(); win.print(); win.close();
}

// ── Facture A4 ────────────────────────────────────────────────────────────────
function printA4(r: Reservation, t: any) {
  const win = window.open("", "_blank"); if (!win) return;
  const n         = countNights(r.checkIn, r.checkOut);
  const total     = r.folio?.total ?? r.rate * n;
  const paid      = (r.folio?.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const balance   = Math.max(0, total - paid);
  const unit      = unitLabel(r.rateMode, t);
  const unitShort = r.rateMode === "per_stay" ? t('reservations.perStayLower') : t('reservations.perNightLower');

  const chargeRow = `<tr>
    <td>${t('hotel.accommodation')} — ${n} ${unit} × ${fmtAr(r.rate)} MGA</td>
    <td style="text-align:right">${fmtAr(r.rate)} MGA/${unitShort}</td>
    <td style="text-align:right">${n}</td>
    <td style="text-align:right;font-weight:600">${fmtAr(total)} MGA</td>
  </tr>`;

  const payRows = (r.folio?.payments ?? []).map(p => {
    const methodLabel = (PAYMENT_LABELS as any)[p.method] ?? p.method;
    if (p.method === "card") {
      const fee     = getCardFee(p.amount);
      const cardTot = getCardTotal(p.amount);
      return `
        <tr>
          <td colspan="3" style="color:#059669">${methodLabel} — ${t('reservations.collectedExcludingFees')}</td>
          <td style="text-align:right;color:#059669;font-weight:600">- ${fmtAr(p.amount)} MGA</td>
        </tr>
        <tr>
          <td colspan="3" style="color:#6b7280;font-size:11px">
            <span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-size:10px;">ℹ ${t('reservations.info')}</span>
            &nbsp;${t('reservations.bankFeeInfo')}
           </td>
          <td style="text-align:right;color:#92400e;font-size:11px">+${fmtAr(fee)} MGA</td>
        </tr>
        <tr style="background:#f0fdf4;">
          <td colspan="3" style="font-weight:600;color:#065f46">${t('reservations.cardTotalCharged')}</td>
          <td style="text-align:right;font-weight:700;color:#065f46">${fmtAr(cardTot)} MGA</td>
        </tr>`;
    }
    if (p.method === "cash" && p.receivedAmount && p.receivedAmount > p.amount) {
      const change = p.receivedAmount - p.amount;
      return `
        <tr>
          <td colspan="3" style="color:#059669">${methodLabel}</td>
          <td style="text-align:right;color:#059669;font-weight:600">- ${fmtAr(p.amount)} MGA</td>
        </tr>
        <tr style="font-size:11px;color:#6b7280">
          <td colspan="3">↳ ${t('reservations.receivedFromCustomer')} : ${fmtAr(p.receivedAmount)} MGA</td>
          <td style="text-align:right">${t('reservations.change')} : ${fmtAr(change)} MGA</td>
        </tr>`;
    }
    return `<tr>
      <td colspan="3" style="color:#059669">${methodLabel}</td>
      <td style="text-align:right;color:#059669;font-weight:600">- ${fmtAr(p.amount)} MGA</td>
    </tr>`;
  }).join("");

  const balColor = balance > 0
    ? "background:#fef2f2;color:#991b1b;border:1px solid #fecaca"
    : "background:#f0fdf4;color:#065f46;border:1px solid #bbf7d0";

  win.document.write(`<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 18mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start;
            padding:18px 20px; background:#0f2744; color:#fff; border-radius:8px; margin-bottom:20px; }
  .hotel-name { font-size:20px; font-weight:700; margin-bottom:4px; }
  .hotel-sub  { font-size:10px; opacity:.75; line-height:1.6; }
  .inv-num    { text-align:right; }
  .inv-num h2 { font-size:16px; font-weight:700; }
  .inv-num p  { font-size:10px; opacity:.75; margin-top:3px; }
  .info-grid  { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
  .info-box   { background:#f8f9fc; border-radius:6px; padding:12px 14px; }
  .info-box h3 { font-size:10px; font-weight:700; text-transform:uppercase;
                 color:#0f2744; letter-spacing:.06em; margin-bottom:8px; }
  .info-row   { display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px; }
  .info-row span:last-child { font-weight:600; }
  .section-title { font-size:12px; font-weight:700; text-transform:uppercase;
                   color:#0f2744; letter-spacing:.05em; margin-bottom:6px; }
  table  { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:12px; }
  thead th { background:#0f2744; color:#fff; padding:8px 10px; text-align:left; }
  thead th:not(:first-child) { text-align:right; }
  tbody td { padding:7px 10px; border-bottom:1px solid #f1f3f8; }
  tbody td:not(:first-child) { text-align:right; }
  tfoot td { padding:8px 10px; font-weight:700; border-top:2px solid #0f2744; }
  tfoot td:not(:first-child) { text-align:right; }
  .balance { padding:12px 16px; border-radius:8px; text-align:right;
             font-size:14px; font-weight:700; margin-bottom:20px; ${balColor} }
  .suivi { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
  .suivi-box { background:#f8f9fc; border-radius:6px; padding:10px 12px; text-align:center; }
  .suivi-box .lbl { font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; margin-bottom:4px; }
  .suivi-box .val { font-size:13px; font-weight:700; }
  .footer  { margin-top:32px; padding-top:12px; border-top:1px solid #e5e7eb;
             font-size:10px; color:#9ca3af; text-align:center; line-height:1.8; }
  .card-info-banner {
    background:#fffbeb; border:1px solid #fcd34d; border-radius:6px;
    padding:8px 12px; margin-bottom:12px; font-size:11px; color:#92400e;
  }
</style></head><body>

<div class="header">
  <div>
    <div class="hotel-name">${HOTEL.name}</div>
    <div class="hotel-sub">${HOTEL.address}<br/>${HOTEL.phone} · ${HOTEL.email}</div>
  </div>
  <div class="inv-num">
    <h2>${t('reservations.invoice')} N° RES-${String(r.id).padStart(5, "0")}</h2>
    <p>${t('reservations.issuedOn')} ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</p>
  </div>
</div>

<div class="info-grid">
  <div class="info-box">
    <h3>${t('crm.customers')}</h3>
    <div class="info-row"><span>${r.guest.fullName}</span></div>
    ${r.guest.phone ? `<div class="info-row"><span>${t('common.phone')}</span><span>${r.guest.phone}</span></div>` : ""}
    ${r.guest.email ? `<div class="info-row"><span>${t('common.email')}</span><span>${r.guest.email}</span></div>` : ""}
  </div>
  <div class="info-box">
    <h3>${t('reservations.stay')}</h3>
    <div class="info-row"><span>${t('hotel.room')}</span><span>#${r.room.number} — ${r.room.type}</span></div>
    <div class="info-row"><span>${t('hotel.arrivalDate')}</span><span>${new Date(r.checkIn).toLocaleDateString("fr-FR")}</span></div>
    <div class="info-row"><span>${t('hotel.departureDate')}</span><span>${new Date(r.checkOut).toLocaleDateString("fr-FR")}</span></div>
    <div class="info-row"><span>${t('reservations.duration')}</span><span>${n} ${unit}</span></div>
    <div class="info-row"><span>${t('reservations.rateLabel')}</span><span>${fmtRateLabel(r.rate, r.rateMode, t)}</span></div>
    <div class="info-row"><span>${t('common.status')}</span><span>${STATUS_FR[r.status] ?? r.status}</span></div>
  </div>
</div>

${(r.folio?.payments ?? []).some(p => p.method === "card") ? `
<div class="card-info-banner">
  ⚠️ <strong>${t('reservations.cardPaymentInfo')}</strong>
  ${t('reservations.cardPaymentDescription')}
</div>` : ""}

<div class="section-title">${t('reservations.servicesDetail')}</div>
<table>
  <thead>
    <tr>
      <th>${t('reservations.description')}</th>
      <th style="text-align:right">${t('reservations.unitPrice')}/${unitShort}</th>
      <th style="text-align:right">${r.rateMode === "per_stay" ? t('reservations.stays') : t('reservations.nights')}</th>
      <th style="text-align:right">${t('reservations.total')}</th>
    </tr>
  </thead>
  <tbody>${chargeRow}${payRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="3" style="text-align:right">${t('reservations.totalInvoiced')}</td>
      <td>${fmtAr(total)} MGA</td>
    </tr>
    ${paid > 0 ? `<tr>
      <td colspan="3" style="text-align:right;color:#059669">${t('reservations.totalCollectedExcludingFees')}</td>
      <td style="color:#059669">- ${fmtAr(paid)} MGA</td>
    </tr>` : ""}
  </tfoot>
</table>

<div class="section-title">${t('reservations.paymentFollowup')}</div>
<div class="suivi">
  <div class="suivi-box">
    <div class="lbl">${t('reservations.totalInvoiced')}</div>
    <div class="val" style="color:#0f2744">${fmtAr(total)} MGA</div>
  </div>
  <div class="suivi-box">
    <div class="lbl">${t('reservations.alreadyCollected')}</div>
    <div class="val" style="color:#059669">${fmtAr(paid)} MGA</div>
  </div>
  <div class="suivi-box">
    <div class="lbl">${balance > 0 ? t('reservations.remainingDue') : t('reservations.balance')}</div>
    <div class="val" style="color:${balance > 0 ? "#991b1b" : "#065f46"}">${fmtAr(balance)} MGA</div>
  </div>
</div>

<div class="balance">${balance > 0 ? `${t('reservations.remainingBalance')} : ${fmtAr(balance)} MGA` : `✓ ${t('reservations.accountSettled')}`}</div>

<div class="footer">
  ${HOTEL.name} · ${t('reservations.nif')} ${HOTEL.nif} · ${HOTEL.email} · ${HOTEL.phone}<br/>
  ${t('reservations.printedOn')} ${new Date().toLocaleString("fr-FR")} · ${t('reservations.reservation')} #${r.id}
</div>

</body></html>`);
  win.document.close(); win.focus(); win.print(); win.close();
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: ReservationStatus; t: any }) {
  const { badge, icon: Icon } = STATUS_META[status];
  const statusLabels: Record<ReservationStatus, string> = {
    booked: t('reservations.statusBooked'),
    checked_in: t('reservations.statusCheckedIn'),
    checked_out: t('reservations.statusCheckedOut'),
    cancelled: t('reservations.statusCancelled'),
    no_show: t('reservations.statusNoShow'),
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
      <Icon className="w-3 h-3" />{statusLabels[status]}
    </span>
  );
}

const STATUS_FR: Record<string, string> = {
  booked: "Confirmée", checked_in: "Arrivée", checked_out: "Partie",
  cancelled: "Annulée", no_show: "No-show",
};

// ── CardFeeBanner ─────────────────────────────────────────────────────────────

function CardFeeBanner({ amount, t }: { amount: number; t: any }) {
  const fee      = getCardFee(amount);
  const cardTot  = getCardTotal(amount);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {t('reservations.cardPayment')}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="text-center rounded bg-white dark:bg-white/5 border border-amber-100 dark:border-amber-800 p-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">{t('reservations.collected')}</p>
          <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtMGA(amount)}</p>
          <p className="text-[10px] text-muted-foreground">MGA</p>
        </div>
        <div className="text-center rounded bg-white dark:bg-white/5 border border-amber-100 dark:border-amber-800 p-2">
          <p className="text-[10px] text-muted-foreground mb-0.5">{t('reservations.bankFee')}</p>
          <p className="font-bold text-sm text-amber-600 dark:text-amber-400 tabular-nums">+{fmtMGA(fee)}</p>
          <p className="text-[10px] text-muted-foreground">MGA ({t('reservations.info')})</p>
        </div>
        <div className="text-center rounded bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 p-2">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-0.5">{t('reservations.cardTotal')}</p>
          <p className="font-bold text-sm text-amber-700 dark:text-amber-300 tabular-nums">{fmtMGA(cardTot)}</p>
          <p className="text-[10px] text-amber-600 dark:text-amber-500">MGA {t('reservations.charged')}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        {t('reservations.bankFeeNote')}
      </p>
    </div>
  );
}

// ── FolioPanel ────────────────────────────────────────────────────────────────

function FolioPanel({ reservation, onUpdate, t }: { reservation: Reservation; onUpdate: () => void; t: any }) {
  const [method,   setMethod]   = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const folio = reservation.folio;

  const balance    = folio?.balance ?? 0;
  const recNum     = parseInt(received) || 0;

  const encaisse   = method === "cash"   ? Math.min(recNum, balance) : 0;
  const change     = method === "cash"   ? Math.max(0, recNum - balance) : 0;
  const cardAmt    = method === "card"   ? recNum : 0;
  const cardFeePreview   = method === "card" ? getCardFee(cardAmt) : 0;
  const cardTotalPreview = method === "card" ? getCardTotal(cardAmt) : 0;
  const otherAmt   = method !== "cash" && method !== "card" ? Math.min(recNum, balance) : 0;

  const amountToPost =
    method === "cash" ? encaisse :
    method === "card" ? cardAmt  :
    otherAmt;

  const remainingAfter = Math.max(0, balance - amountToPost);

  const pay = useMutation({
    mutationFn: () => api.post("/cash/payments", {
      department:     "hotel",
      method,
      amount:         amountToPost,
      ...(method === "cash" && recNum ? { receivedAmount: recNum } : {}),
      folioId: folio!.id,
    }),
    onSuccess: (data: any) => {
      let desc = `${fmtMGA(amountToPost)} MGA ${t('reservations.collected')}`;
      if (method === "card" && data?.cardFee)
        desc += ` · ${t('reservations.bankFee')} ${fmtMGA(data.cardFee)} MGA (${t('reservations.info')}) · ${t('reservations.cardTotal')} ${fmtMGA(data.cardTotal)} MGA`;
      if (method === "cash" && change > 0)
        desc += ` · ${t('reservations.changeToGive')} : ${fmtMGA(change)} MGA`;
      toast({ title: t('reservations.paymentRecorded'), description: desc });
      setReceived("");
      onUpdate();
    },
    onError: (e: any) =>
      toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const totalPaid = (folio?.payments ?? []).reduce((s, p) => s + p.amount, 0);

  const isCashInsufficient = method === "cash" && recNum > 0 && recNum < balance;
  const isCardOver         = method === "card"  && cardAmt > balance;
  const canPay =
    amountToPost > 0 &&
    !folio?.closedAt &&
    !isCashInsufficient &&
    !isCardOver &&
    !pay.isPending;

  if (!folio) return <p className="text-sm text-muted-foreground py-2">{t('reservations.folioUnavailable')}</p>;

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('reservations.totalInvoiced'),  value: folio.total,  cls: "text-foreground",           Icon: CircleDollarSign },
          { label: t('reservations.alreadyCollected'), value: totalPaid,    cls: "text-emerald-600 dark:text-emerald-400", Icon: ArrowDownLeft },
          {
            label: balance > 0 ? t('reservations.remainingDue') : t('reservations.balance'),
            value: balance,
            cls: balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
            Icon: balance > 0 ? ArrowUpRight : CheckCircle2,
          },
        ].map(({ label, value, cls, Icon }) => (
          <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${cls} opacity-60`} />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${cls}`}>
              {fmtMGA(value)} <span className="text-xs font-normal text-muted-foreground">MGA</span>
            </p>
          </div>
        ))}
      </div>

      {folio.payments.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{t('reservations.history')}</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {folio.payments.map(p => {
              const methodLabel = PAYMENT_LABELS[p.method as PaymentMethod] ?? p.method;
              const isCard = p.method === "card";
              const isCash = p.method === "cash";
              const fee        = isCard ? getCardFee(p.amount) : 0;
              const cardTot    = isCard ? getCardTotal(p.amount) : 0;
              const cashChange = isCash && p.receivedAmount && p.receivedAmount > p.amount
                ? p.receivedAmount - p.amount : 0;

              return (
                <div key={p.id} className={`rounded-lg border p-2.5 text-sm space-y-1.5 ${
                  isCard ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                         : "border-border bg-muted/30"
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      {isCard
                        ? <CreditCard className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        : <Wallet className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-muted-foreground font-medium">{methodLabel}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmtMGA(p.amount)} MGA
                    </span>
                  </div>
                  {isCard && (
                    <div className="space-y-1 pl-5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{t('reservations.collectedExcludingFees')}</span>
                        <span className="tabular-nums">{fmtMGA(p.amount)} MGA</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-amber-600 dark:text-amber-500">
                        <span className="flex items-center gap-1">
                          <Info className="h-3 w-3" /> {t('reservations.bankFeeInfoShort')}
                        </span>
                        <span className="tabular-nums">+{fmtMGA(fee)} MGA</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-400 border-t border-amber-200 dark:border-amber-800 pt-1">
                        <span>{t('reservations.cardTotalCharged')}</span>
                        <span className="tabular-nums">{fmtMGA(cardTot)} MGA</span>
                      </div>
                    </div>
                  )}
                  {isCash && p.receivedAmount && (
                    <div className="space-y-1 pl-5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{t('reservations.receivedFromCustomer')}</span>
                        <span className="tabular-nums">{fmtMGA(p.receivedAmount)} MGA</span>
                      </div>
                      {cashChange > 0 && (
                        <div className="flex justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          <span>{t('reservations.changeGiven')}</span>
                          <span className="tabular-nums">{fmtMGA(cashChange)} MGA</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {folio.closedAt ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          {t('reservations.folioClosedOn')} {fmtDate(folio.closedAt)}
        </p>
      ) : balance <= 0 ? (
        <p className="text-sm text-emerald-600 font-medium text-center py-2 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {t('reservations.balanceSettled')}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('reservations.collectPayment')}</p>

          <Select value={method} onValueChange={v => { setMethod(v as PaymentMethod); setReceived(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {k === "card" ? `💳 ${v}` : k === "cash" ? `💵 ${v}` : v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              {method === "cash" ? t('reservations.amountReceivedFromCustomer') :
               method === "card" ? t('reservations.amountToCollect') :
               t('reservations.amountReceived')}
            </label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={method === "card" ? balance : undefined}
                placeholder={
                  method === "cash" ? `${t('reservations.example')} : ${fmtMGA(balance)} MGA ${t('reservations.orMore')}` :
                  method === "card" ? `${t('reservations.max')} ${fmtMGA(balance)} MGA` :
                  `${t('reservations.amount')} (${t('reservations.max')} ${fmtMGA(balance)} MGA)`
                }
                value={received}
                onChange={e => setReceived(e.target.value)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MGA</span>
            </div>
          </div>

          {recNum > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
              <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                {t('reservations.summary')}
              </p>

              {method === "cash" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reservations.remainingDue')}</span>
                    <span className="font-semibold tabular-nums">{fmtMGA(balance)} MGA</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{t('reservations.collectedAmount')}</span>
                    <span className="font-semibold tabular-nums">- {fmtMGA(encaisse)} MGA</span>
                  </div>
                  {change > 0 && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400 font-semibold">
                      <span>{t('reservations.changeToGive')}</span>
                      <span className="tabular-nums">{fmtMGA(change)} MGA</span>
                    </div>
                  )}
                </>
              )}

              {method === "card" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reservations.remainingDue')}</span>
                    <span className="font-semibold tabular-nums">{fmtMGA(balance)} MGA</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{t('reservations.collectedAmount')}</span>
                    <span className="font-semibold tabular-nums">- {fmtMGA(cardAmt)} MGA</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-500">
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" /> {t('reservations.bankFeeInfoShort')}
                    </span>
                    <span className="tabular-nums">+ {fmtMGA(cardFeePreview)} MGA</span>
                  </div>
                  <div className="flex justify-between font-semibold text-amber-700 dark:text-amber-400 border-t border-border pt-1.5">
                    <span>{t('reservations.cardTotalCharged')}</span>
                    <span className="tabular-nums">{fmtMGA(cardTotalPreview)} MGA</span>
                  </div>
                </>
              )}

              {method !== "cash" && method !== "card" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('reservations.remainingDue')}</span>
                    <span className="font-semibold tabular-nums">{fmtMGA(balance)} MGA</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{t('reservations.collectedAmount')}</span>
                    <span className="font-semibold tabular-nums">- {fmtMGA(otherAmt)} MGA</span>
                  </div>
                </>
              )}

              <div className={`flex justify-between font-semibold border-t border-border pt-1.5 ${
                remainingAfter > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}>
                <span>{t('reservations.remainingBalanceAfterPayment')}</span>
                <span className="tabular-nums">{fmtMGA(remainingAfter)} MGA</span>
              </div>
            </div>
          )}

          {method === "card" && recNum > 0 && !isCardOver && (
            <CardFeeBanner amount={cardAmt} t={t} />
          )}

          {isCashInsufficient && (
            <p className="text-xs text-red-500">
              {t('reservations.insufficientAmount', { received: fmtMGA(recNum), balance: fmtMGA(balance) })}
            </p>
          )}
          {isCardOver && (
            <p className="text-xs text-red-500">
              {t('reservations.amountExceedsBalance', { amount: fmtMGA(cardAmt), balance: fmtMGA(balance) })}
            </p>
          )}

          <Button
            className="w-full"
            onClick={() => pay.mutate()}
            disabled={!canPay}
          >
            {pay.isPending
              ? t('common.loading')
              : `${t('reservations.collect')} ${amountToPost > 0 ? fmtMGA(amountToPost) + " MGA" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════

const Reservations = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: reservations = [], isLoading, refetch } = useQuery<Reservation[]>({
    queryKey: ["hotel", "reservations"],
    queryFn: () => api.get<Reservation[]>("/hotel/reservations"),
    staleTime: 30_000,
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["hotel", "rooms"],
    queryFn: () => api.get<Room[]>("/hotel/rooms"),
    staleTime: 30_000,
  });

  const [searchTerm,    setSearchTerm]    = useState("");
  const [filterStatus,  setFilterStatus]  = useState<ReservationStatus | "all">("all");
  const [showNew,       setShowNew]       = useState(false);
  const [detailsId,     setDetailsId]     = useState<number | null>(null);
  const [cancelTarget,  setCancelTarget]  = useState<Reservation | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Reservation | null>(null);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const EMPTY_FORM = {
    guestName: "", email: "", phone: "",
    roomType: "", roomId: "",
    checkIn: "", checkOut: "",
    rate: "",
    rateMode: "per_night" as RateMode,
    notes: "",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const setF = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }));

  const availableRooms = useMemo(() =>
    rooms.filter(rm => rm.status === "available" && (!form.roomType || rm.type === form.roomType)),
    [rooms, form.roomType]
  );

  const detailsRes = detailsId !== null
    ? (reservations.find(r => r.id === detailsId) ?? null)
    : null;

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
    return {
      total: reservations.length,
      booked: reservations.filter(r => r.status === "booked").length,
      checked_in: reservations.filter(r => r.status === "checked_in").length,
      arrivalsToday: reservations.filter(r => {
        const ci = new Date(r.checkIn);
        return r.status === "booked" && ci >= todayStart && ci <= todayEnd;
      }).length,
      departuresToday: reservations.filter(r => {
        const co = new Date(r.checkOut);
        return r.status === "checked_in" && co >= todayStart && co <= todayEnd;
      }).length,
    };
  }, [reservations]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return reservations.filter(r => {
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchSearch =
        r.guest.fullName.toLowerCase().includes(term) ||
        r.room.number.includes(term) ||
        String(r.id).includes(term) ||
        (r.guest.email ?? "").toLowerCase().includes(term) ||
        (r.guest.phone ?? "").includes(term);
      return matchStatus && matchSearch;
    });
  }, [reservations, filterStatus, searchTerm]);

  const createMut = useMutation({
    mutationFn: () =>
      api.post("/hotel/reservations", {
        roomId: parseInt(form.roomId),
        guest: {
          fullName: form.guestName.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        checkIn:  new Date(form.checkIn).toISOString(),
        checkOut: new Date(form.checkOut).toISOString(),
        status:   "booked",
        rate:     parseInt(form.rate),
        rateMode: form.rateMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel", "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({
        title: t('reservations.reservationCreated'),
        description: `${t('hotel.room')} #${availableRooms.find(rm => rm.id === parseInt(form.roomId))?.number}`,
      });
      setForm(EMPTY_FORM);
      setShowNew(false);
    },
    onError: (e: any) =>
      toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => {
      if (status === "checked_in")  return api.post(`/hotel/reservations/${id}/checkin`);
      if (status === "checked_out") return api.post(`/hotel/reservations/${id}/checkout`);
      return api.patch(`/hotel/reservations/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hotel", "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('common.status') + " " + t('reservations.updated') });
    },
    onError: (e: any) =>
      toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.del(`/hotel/reservations/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["hotel", "reservations"] });
      toast({ title: t('reservations.reservationDeleted') });
    },
    onError: (e: any) => {
      setDeleteTarget(null);
      toast({ title: t('reservations.deleteImpossible'), description: String(e), variant: "destructive" });
    },
  });

  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  const validateForm = (): string | null => {
    if (!form.guestName.trim()) return t('reservations.guestNameRequired');
    if (!form.roomId) return t('reservations.roomRequired');
    if (!form.checkIn) return t('reservations.checkInRequired');
    if (!form.checkOut) return t('reservations.checkOutRequired');
    if (!form.rate || parseInt(form.rate) <= 0) return t('reservations.ratePositive');
    const ci = new Date(form.checkIn), co = new Date(form.checkOut);
    if (ci < today0) return t('reservations.checkInPast');
    if (co <= ci) return t('reservations.checkOutAfterCheckIn');
    return null;
  };

  const canDelete = (r: Reservation) =>
    ["checked_out", "cancelled", "no_show"].includes(r.status) ||
    new Date(r.checkOut) < new Date();

  const formPreview = useMemo(() => {
    const rate = parseInt(form.rate);
    if (!rate || rate <= 0 || !form.checkIn || !form.checkOut) return null;
    const co = new Date(form.checkOut), ci = new Date(form.checkIn);
    if (co <= ci) return null;
    const n = countNights(form.checkIn, form.checkOut);
    return { n, rate, total: rate * n };
  }, [form.rate, form.checkIn, form.checkOut]);

  const doExport = async (fmt_: string) => {
    if (!filtered.length) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }
    setExportLoading(true);
    setExportOpen(false);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const rows = filtered.map(r => {
        const n     = countNights(r.checkIn, r.checkOut);
        const total = r.folio?.total ?? r.rate * n;
        const unit  = r.rateMode === "per_stay" ? t('reservations.perStayLower') : t('reservations.perNightLower');
        const statusLabels: Record<ReservationStatus, string> = {
          booked: t('reservations.statusBooked'),
          checked_in: t('reservations.statusCheckedIn'),
          checked_out: t('reservations.statusCheckedOut'),
          cancelled: t('reservations.statusCancelled'),
          no_show: t('reservations.statusNoShow'),
        };
        return {
          ID: r.id,
          [t('crm.customers')]: r.guest.fullName,
          [t('common.email')]: r.guest.email ?? "",
          [t('common.phone')]: r.guest.phone ?? "",
          [t('hotel.room')]: r.room.number,
          [t('hotel.type')]: r.room.type,
          [t('hotel.arrivalDate')]: fmtDate(r.checkIn),
          [t('hotel.departureDate')]: fmtDate(r.checkOut),
          [r.rateMode === "per_stay" ? t('reservations.stays') : t('reservations.nights')]: n,
          [t('common.status')]: statusLabels[r.status],
          [`${t('reservations.rateLabel')} MGA`]: r.rate,
          [t('reservations.rateModeLabel')]: r.rateMode === "per_stay" ? t('reservations.perStay') : t('reservations.perNight'),
          [t('reservations.unit')]: unit,
          [`${t('reservations.total')} MGA`]: total,
          [`${t('reservations.balance')} MGA`]: r.folio?.balance ?? total,
          [t('common.createdAt')]: fmtDate(r.createdAt),
          [t('common.notes')]: r.guest.notes ?? "",
          [t('reservations.payments')]: (r.folio?.payments ?? [])
            .map(p => {
              const base = `${PAYMENT_LABELS[p.method as PaymentMethod] ?? p.method}: ${fmtMGA(p.amount)} MGA`;
              if (p.method === "card") {
                const fee = getCardFee(p.amount);
                return `${base} (+ ${t('reservations.bankFee')} ${fmtMGA(fee)} MGA = ${t('reservations.cardTotal')} ${fmtMGA(getCardTotal(p.amount))} MGA)`;
              }
              return base;
            })
            .join(" | ") || t('reservations.none'),
        };
      });

      if (fmt_ === "excel") {
        const wb = XLSX.utils.book_new();
        const synth = [
          [t('reservations.reservationsReport'), ""],
          [t('export.title'), new Date().toLocaleString("fr-FR")],
          [t('reservations.totalFiltered'), filtered.length], ["", ""],
          [t('reservations.statusBooked'), stats.booked],
          [t('reservations.statusCheckedIn'), stats.checked_in],
          [t('reservations.arrivalsToday'), stats.arrivalsToday],
          [t('reservations.departuresToday'), stats.departuresToday],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(synth);
        ws1["!cols"] = [{ wch: 22 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws1, t('reservations.summary'));
        const ws2 = XLSX.utils.json_to_sheet(rows);
        ws2["!cols"] = [6, 20, 25, 15, 10, 12, 14, 14, 6, 12, 12, 12, 10, 12, 12, 14, 30, 60].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws2, t('reservations.title'));
        saveAs(
          new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })],
            { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `reservations-${dateStr}.xlsx`
        );
      } else if (fmt_ === "csv") {
        const header = Object.keys(rows[0]).join(",");
        const body   = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        saveAs(new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8" }), `reservations-${dateStr}.csv`);
      } else if (fmt_ === "json") {
        saveAs(
          new Blob([JSON.stringify({ dateExport: new Date().toISOString(), reservations: rows }, null, 2)],
            { type: "application/json" }),
          `reservations-${dateStr}.json`
        );
      } else {
        const txt = rows.map(r => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n")).join("\n\n─────────────\n\n");
        saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `reservations-${dateStr}.txt`);
      }
      toast({ title: t('export.exportSuccess'), description: `${filtered.length} ${t('reservations.reservationsExported')}` });
    } catch (e) {
      toast({ title: t('export.exportError'), description: String(e), variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <LayoutSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{t('hotel.planning')}</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t('reservations.title')}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>

              <div className="relative">
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => setExportOpen(o => !o)} disabled={exportLoading}>
                  <Download className="h-4 w-4" />
                  {t('common.export')}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
                </Button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 pt-2.5 pb-1.5">{t('export.formats')}</p>
                      {[
                        { f: "excel", label: t('export.excel'),  ext: ".xlsx", Icon: FileSpreadsheet, c: "text-emerald-600" },
                        { f: "csv",   label: t('export.csv'),    ext: ".csv",  Icon: TableIcon,       c: "text-blue-600"    },
                        { f: "json",  label: t('export.json'),   ext: ".json", Icon: FileCode,        c: "text-orange-600"  },
                        { f: "txt",   label: t('export.txt'),   ext: ".txt",  Icon: FileText,        c: "text-violet-600"  },
                      ].map(({ f, label, ext, Icon, c }) => (
                        <button key={f}
                          className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => doExport(f)}>
                          <Icon className={`h-4 w-4 ${c}`} />
                          <span className="font-medium flex-1 text-left">{label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{ext}</span>
                        </button>
                      ))}
                      <div className="border-t border-border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">{filtered.length} {t('reservations.resultsFiltered')}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4" /> {t('reservations.newReservation')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: t('reservations.total'),         value: stats.total,           color: "text-foreground"    },
              { label: t('reservations.statusBooked'),    value: stats.booked,          color: "text-violet-500"    },
              { label: t('reservations.statusCheckedIn'),     value: stats.checked_in,      color: "text-blue-500"      },
              { label: t('reservations.arrivalsToday'), value: stats.arrivalsToday,   color: "text-emerald-500"   },
              { label: t('reservations.departuresToday'),  value: stats.departuresToday, color: "text-amber-500"     },
            ].map(s => (
              <Card key={s.label}>
                <div className="px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('reservations.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
              <SelectTrigger className="w-44">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder={t('reservations.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reservations.allStatuses')}</SelectItem>
                {(Object.entries(STATUS_META) as [ReservationStatus, any][]).map(([k]) => {
                  const statusLabels: Record<ReservationStatus, string> = {
                    booked: t('reservations.statusBooked'),
                    checked_in: t('reservations.statusCheckedIn'),
                    checked_out: t('reservations.statusCheckedOut'),
                    cancelled: t('reservations.statusCancelled'),
                    no_show: t('reservations.statusNoShow'),
                  };
                  return <SelectItem key={k} value={k}>{statusLabels[k]}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {(searchTerm || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>
                {t('common.reset')}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} {t('reservations.results')}</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <CalendarDays className="h-10 w-10 opacity-20" />
                <p>{t('reservations.noReservationsFound')}</p>
                <Button variant="outline" size="sm" className="gap-2 mt-1" onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4" /> {t('reservations.createReservation')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const n            = countNights(r.checkIn, r.checkOut);
                const displayBalance = r.folio?.balance ?? r.rate * n;
                const statusLabels: Record<ReservationStatus, string> = {
                  booked: t('reservations.statusBooked'),
                  checked_in: t('reservations.statusCheckedIn'),
                  checked_out: t('reservations.statusCheckedOut'),
                  cancelled: t('reservations.statusCancelled'),
                  no_show: t('reservations.statusNoShow'),
                };

                return (
                  <Card key={r.id} className="hover:shadow-md transition-shadow">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold leading-none">{r.guest.fullName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('reservations.reservation')} #{r.id}</p>
                          </div>
                        </div>
                        <StatusBadge status={r.status} t={t} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{t('hotel.room')}. {r.room.number}</p>
                            <p className="text-xs text-muted-foreground">{r.room.type}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{fmtShort(r.checkIn)} → {fmtDate(r.checkOut)}</p>
                            <p className="text-xs text-muted-foreground">
                              {n} {unitLabel(r.rateMode, t)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{fmtRateLabel(r.rate, r.rateMode, t)}</p>
                            <p className={`text-xs ${displayBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {t('reservations.balance')} : {fmtMGA(displayBalance)} MGA
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{t('common.createdAt')}</p>
                            <p className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</p>
                          </div>
                        </div>
                      </div>

                      {(r.guest.email || r.guest.phone) && (
                        <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                          {r.guest.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.guest.email}</span>}
                          {r.guest.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.guest.phone}</span>}
                        </div>
                      )}
                      {r.guest.notes && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                          {r.guest.notes}
                        </div>
                      )}

                      <Separator className="my-3" />

                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        {r.status === "booked" && (
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => updateStatus.mutate({ id: r.id, status: "checked_in" })}>
                            <LogIn className="h-3.5 w-3.5" /> {t('reservations.checkIn')}
                          </Button>
                        )}
                        {r.status === "checked_in" && (
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => updateStatus.mutate({ id: r.id, status: "checked_out" })}>
                            <LogOut className="h-3.5 w-3.5" /> {t('reservations.checkOut')}
                          </Button>
                        )}
                        {r.status === "booked" && (
                          <Button size="sm" variant="outline"
                            className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            onClick={() => updateStatus.mutate({ id: r.id, status: "no_show" })}>
                            {t('reservations.noShow')}
                          </Button>
                        )}
                        {r.status === "booked" && (
                          <Button size="sm" variant="outline"
                            className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setCancelTarget(r)}>
                            <XCircle className="h-3.5 w-3.5" /> {t('reservations.cancel')}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printA4(r, t)}>
                          <FileText className="h-3.5 w-3.5" /> A4
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => print80mm(r, t)}>
                          <Printer className="h-3.5 w-3.5" /> 80 mm
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDetailsId(r.id)}>
                          {t('reservations.detailsAndPayment')}
                        </Button>
                        {canDelete(r) && (
                          <Button size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* DIALOG — Nouvelle réservation */}
      <Dialog open={showNew} onOpenChange={o => { if (!o) setForm(EMPTY_FORM); setShowNew(o); }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('reservations.newReservation')}</DialogTitle>
            <DialogDescription>{t('reservations.requiredFields')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('crm.fullName')} <span className="text-destructive">*</span></Label>
              <Input placeholder={t('crm.fullName')} value={form.guestName} onChange={e => setF("guestName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('common.email')}</Label>
                <Input type="email" placeholder="client@email.com" value={form.email} onChange={e => setF("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.phone')}</Label>
                <Input placeholder="+261 34 00 000 00" value={form.phone} onChange={e => setF("phone", e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('hotel.arrivalDate')} <span className="text-destructive">*</span></Label>
                <Input type="date" min={new Date().toISOString().slice(0, 10)}
                  value={form.checkIn} onChange={e => setF("checkIn", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('hotel.departureDate')} <span className="text-destructive">*</span></Label>
                <Input type="date" min={form.checkIn || new Date().toISOString().slice(0, 10)}
                  value={form.checkOut} onChange={e => setF("checkOut", e.target.value)} />
              </div>
            </div>
            {form.checkIn && form.checkOut && new Date(form.checkOut) > new Date(form.checkIn) && (
              <p className="text-xs text-muted-foreground -mt-2">
                {t('reservations.stayOf')} {countNights(form.checkIn, form.checkOut)} {unitLabel(form.rateMode as RateMode, t)}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('hotel.roomType')}</Label>
                <Select value={form.roomType} onValueChange={v => {
                  setF("roomType", v === "all" ? "" : v);
                  setF("roomId", "");
                }}>
                  <SelectTrigger><SelectValue placeholder={t('common.all')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('hotel.room')} <span className="text-destructive">*</span></Label>
                <Select value={form.roomId} onValueChange={v => setF("roomId", v)}>
                  <SelectTrigger><SelectValue placeholder={t('hotel.selectRoom')} /></SelectTrigger>
                  <SelectContent>
                    {availableRooms.length === 0
                      ? <div className="px-3 py-4 text-sm text-muted-foreground text-center">{t('hotel.noRoomsAvailable')}</div>
                      : availableRooms.map(rm => (
                        <SelectItem key={rm.id} value={String(rm.id)}>#{rm.number} — {rm.type}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('reservations.pricing')} <span className="text-destructive">*</span></Label>
              <div className="flex rounded-md border border-input overflow-hidden text-sm">
                {(["per_night", "per_stay"] as RateMode[]).map(mode => (
                  <button key={mode} type="button"
                    className={`flex-1 px-3 py-1.5 transition-colors ${form.rateMode === mode
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setF("rateMode", mode)}>
                    {mode === "per_night" ? t('reservations.perNight') : t('reservations.perStay')}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number" min={0}
                  placeholder={form.rateMode === "per_night" ? t('reservations.perNightExample') : t('reservations.perStayExample')}
                  value={form.rate}
                  onChange={e => setF("rate", e.target.value)}
                  className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MGA</span>
              </div>
              {formPreview && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                  {form.rateMode === "per_night" ? (
                    <>
                      <span className="font-medium">{fmtMGA(formPreview.rate)} MGA/{t('reservations.perNightLower')}</span>
                      {" × "}{formPreview.n} {formPreview.n > 1 ? t('reservations.nights') : t('reservations.night')}
                      {" = "}
                      <span className="font-semibold text-foreground">{fmtMGA(formPreview.total)} MGA</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{fmtMGA(formPreview.rate)} MGA/{t('reservations.perStayLower')}</span>
                      {" · "}{formPreview.n} {formPreview.n > 1 ? t('reservations.stays') : t('reservations.stay')}
                      {" → "}{t('reservations.total').toLowerCase()} <span className="font-semibold text-foreground">{fmtMGA(formPreview.total)} MGA</span>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t('common.notes')} <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <Textarea rows={2} placeholder={t('reservations.notesPlaceholder')}
                value={form.notes} onChange={e => setF("notes", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setForm(EMPTY_FORM); setShowNew(false); }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => {
                const err = validateForm();
                if (err) { toast({ title: t('reservations.invalidForm'), description: err, variant: "destructive" }); return; }
                createMut.mutate();
              }}
              disabled={createMut.isPending}>
              {createMut.isPending ? t('common.loading') : t('reservations.createReservation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG — Détails & paiement */}
      <Dialog open={detailsId !== null} onOpenChange={o => !o && setDetailsId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          {detailsRes && (
            <>
              <DialogHeader>
                <DialogTitle>{t('reservations.reservation')} #{detailsRes.id}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  {detailsRes.guest.fullName} · {t('hotel.room')}. #{detailsRes.room.number}
                  &nbsp;<StatusBadge status={detailsRes.status} t={t} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('hotel.room')}</p>
                    <p className="font-semibold">#{detailsRes.room.number} — {detailsRes.room.type}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('reservations.stay')}</p>
                    <p className="font-semibold">{fmtShort(detailsRes.checkIn)} → {fmtDate(detailsRes.checkOut)}</p>
                    <p className="text-xs text-muted-foreground">
                      {countNights(detailsRes.checkIn, detailsRes.checkOut)} {unitLabel(detailsRes.rateMode, t)}
                      {" · "}
                      {fmtRateLabel(detailsRes.rate, detailsRes.rateMode, t)}
                    </p>
                  </div>
                </div>

                {(detailsRes.guest.email || detailsRes.guest.phone) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {detailsRes.guest.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{detailsRes.guest.email}</span>}
                    {detailsRes.guest.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{detailsRes.guest.phone}</span>}
                  </div>
                )}
                {detailsRes.guest.notes && (
                  <div className="px-3 py-2 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                    {detailsRes.guest.notes}
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Printer className="h-4 w-4 text-muted-foreground" /> {t('reservations.printInvoice')}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2 flex-1" onClick={() => printA4(detailsRes, t)}>
                      <FileText className="h-4 w-4 text-blue-600" /> {t('dailyInvoice.printA4')}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2 flex-1" onClick={() => print80mm(detailsRes, t)}>
                      <Printer className="h-4 w-4 text-violet-600" /> {t('dailyInvoice.print80mm')}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" /> {t('reservations.folioAndCollection')}
                  </p>
                  <FolioPanel
                    reservation={detailsRes}
                    onUpdate={() => queryClient.invalidateQueries({ queryKey: ["hotel", "reservations"] })}
                    t={t}
                  />
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2 justify-end">
                  {detailsRes.status === "booked" && (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => updateStatus.mutate({ id: detailsRes.id, status: "checked_in" })}>
                      <LogIn className="h-3.5 w-3.5" /> {t('reservations.checkIn')}
                    </Button>
                  )}
                  {detailsRes.status === "checked_in" && (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => updateStatus.mutate({ id: detailsRes.id, status: "checked_out" })}>
                      <LogOut className="h-3.5 w-3.5" /> {t('reservations.checkOut')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDetailsId(null)}>{t('common.close')}</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog — Annulation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={o => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reservations.cancelReservation')} #{cancelTarget?.id} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.guest.fullName} · {t('hotel.room')} #{cancelTarget?.room.number}<br />
              {t('reservations.cancelDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.back')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { updateStatus.mutate({ id: cancelTarget!.id, status: "cancelled" }); setCancelTarget(null); }}>
              {t('reservations.confirmCancellation')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog — Suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reservations.deleteReservation')} #{deleteTarget?.id} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reservations.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
              {t('reservations.deletePermanently')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reservations;