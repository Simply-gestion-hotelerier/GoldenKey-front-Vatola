// src/pages/hotel/HotelPlan.tsx
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar as LayoutSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance" | "out_of_order";
type ReservationStatus = "booked" | "checked_in" | "checked_out" | "cancelled" | "no_show";
type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
type RateMode = "per_night" | "per_stay";

interface Room {
  id: number;
  number: string;
  type: string;
  status: RoomStatus;
}

interface Guest {
  id: number;
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

interface Reservation {
  id: number;
  roomId: number;
  guestId: number;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  rate: number;
  rateMode: RateMode;
  createdAt: string;
  guest: Guest;
  room: Room;
}

interface RoomMaintenance {
  id: number;
  roomId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: MaintenanceStatus;
  createdAt: string;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS_FR = ["L", "M", "M", "J", "V", "S", "D"];

const RES_STYLE: Record<ReservationStatus, { tw: string; dot: string; label: string }> = {
  checked_in: { tw: "bg-blue-500 text-white", dot: "bg-blue-500", label: "checkedIn" },
  booked: { tw: "bg-violet-500 text-white", dot: "bg-violet-500", label: "booked" },
  checked_out: { tw: "bg-emerald-500 text-white", dot: "bg-emerald-500", label: "checkedOut" },
  cancelled: { tw: "bg-slate-400 text-white", dot: "bg-slate-400", label: "cancelled" },
  no_show: { tw: "bg-red-400 text-white", dot: "bg-red-400", label: "noShow" },
};

const MAINT_STYLE: Record<MaintenanceStatus, { tw: string; dot: string; label: string }> = {
  scheduled: { tw: "bg-orange-400 text-white", dot: "bg-orange-400", label: "scheduled" },
  in_progress: { tw: "bg-red-500 text-white", dot: "bg-red-500", label: "inProgress" },
  completed: { tw: "bg-emerald-400 text-white", dot: "bg-emerald-400", label: "completed" },
  cancelled: { tw: "bg-slate-400 text-white", dot: "bg-slate-400", label: "cancelledMaint" },
};

const ROOM_STATUS: Record<RoomStatus, { dot: string; label: string }> = {
  available: { dot: "bg-emerald-500", label: "available" },
  occupied: { dot: "bg-blue-500", label: "occupied" },
  cleaning: { dot: "bg-amber-400", label: "cleaning" },
  maintenance: { dot: "bg-red-500", label: "maintenance" },
  out_of_order: { dot: "bg-slate-500", label: "outOfOrder" },
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86_400_000); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function fmtDate(d: string | Date) { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }); }
const fmtMGA = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

type Bar =
  | { type: "reservation"; data: Reservation; startOffset: number; width: number }
  | { type: "maintenance"; data: RoomMaintenance; startOffset: number; width: number };

function BarPopover({ bar, t }: { bar: Bar; t: (key: string) => string }) {
  const isRes = bar.type === "reservation";
  const style = isRes
    ? (RES_STYLE[bar.data.status as ReservationStatus] ?? RES_STYLE.booked)
    : (MAINT_STYLE[bar.data.status as MaintenanceStatus] ?? MAINT_STYLE.scheduled);

  const label = isRes
    ? (bar.data as Reservation).guest?.fullName
    : ((bar.data as RoomMaintenance).reason ?? t('hotelPlan.maintenance'));

  const rateLabel = isRes
    ? (() => {
        const res = bar.data as Reservation;
        return res.rateMode === "per_stay"
          ? `${fmtMGA(res.rate)} MGA/${t('hotelPlan.ratePerStay')}`
          : `${fmtMGA(res.rate)} MGA/${t('hotelPlan.ratePerNight')}`;
      })()
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={`${style.tw} rounded-sm flex items-center px-2 cursor-pointer pointer-events-auto
            hover:brightness-110 hover:shadow-sm transition-all duration-150 overflow-hidden h-full`}
          style={{
            gridColumn: `${bar.startOffset + 1} / span ${bar.width}`,
            gridRow: "1",
            margin: "0 1px",
            fontSize: "0.62rem",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
          }}
        >
          {label}
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-3" side="top" align="start">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
            <span className="font-semibold text-sm leading-tight">{label}</span>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {isRes ? (
              <>
                <span className="text-muted-foreground">{t('hotelPlan.guestName')}</span>
                <span className="font-medium truncate">{(bar.data as Reservation).guest?.fullName}</span>
                {(bar.data as Reservation).guest?.phone && (
                  <>
                    <span className="text-muted-foreground">{t('hotelPlan.phone')}</span>
                    <span className="font-medium">{(bar.data as Reservation).guest.phone}</span>
                  </>
                )}
                <span className="text-muted-foreground">{t('hotelPlan.checkIn')}</span>
                <span className="font-medium">{fmtDate((bar.data as Reservation).checkIn)}</span>
                <span className="text-muted-foreground">{t('hotelPlan.checkOut')}</span>
                <span className="font-medium">{fmtDate((bar.data as Reservation).checkOut)}</span>
                <span className="text-muted-foreground">{t('hotelPlan.ratePerNight')}</span>
                <span className="font-medium">{rateLabel}</span>
                <span className="text-muted-foreground">{t('common.status')}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 w-fit">{t(`hotelPlan.${style.label}`)}</Badge>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">{t('hotelPlan.reason')}</span>
                <span className="font-medium">{(bar.data as RoomMaintenance).reason ?? "—"}</span>
                <span className="text-muted-foreground">{t('hotelPlan.startDate')}</span>
                <span className="font-medium">{fmtDate((bar.data as RoomMaintenance).startDate)}</span>
                <span className="text-muted-foreground">{t('hotelPlan.endDate')}</span>
                <span className="font-medium">{fmtDate((bar.data as RoomMaintenance).endDate)}</span>
                <span className="text-muted-foreground">{t('common.status')}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 w-fit">{t(`hotelPlan.${style.label}`)}</Badge>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-2 mt-4">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md opacity-70" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export default function HotelPlan() {
  const { t } = useTranslation();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const {
    data: rooms = [],
    isLoading: loadingRooms,
    isError: errorRooms,
    refetch: refetchRooms,
  } = useQuery<Room[]>({
    queryKey: ["hotel", "rooms"],
    queryFn: () => api.get<Room[]>("/hotel/rooms"),
    staleTime: 30_000,
  });

  const {
    data: reservations = [],
    isLoading: loadingRes,
    isError: errorRes,
    refetch: refetchRes,
  } = useQuery<Reservation[]>({
    queryKey: ["hotel", "reservations"],
    queryFn: () => api.get<Reservation[]>("/hotel/reservations"),
    staleTime: 30_000,
  });

  const {
    data: maintenances = [],
    isLoading: loadingMaint,
    isError: errorMaint,
    refetch: refetchMaint,
  } = useQuery<RoomMaintenance[]>({
    queryKey: ["hotel", "maintenances"],
    queryFn: () => api.get<RoomMaintenance[]>("/hotel/maintenances"),
    staleTime: 30_000,
  });

  const isLoading = loadingRooms || loadingRes || loadingMaint;
  const isError = errorRooms || errorRes || errorMaint;

  const refetchAll = () => { refetchRooms(); refetchRes(); refetchMaint(); };

  const daysInMonth = useMemo(() => {
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(viewYear, viewMonth, i + 1));
  }, [viewYear, viewMonth]);

  const dailyAvail = useMemo(() => {
    return daysInMonth.map(day => {
      const blocked = new Set<number>();
      reservations.forEach(r => {
        if (r.status === "cancelled" || r.status === "no_show") return;
        const ci = new Date(r.checkIn), co = new Date(r.checkOut);
        if (day >= ci && day < co) blocked.add(r.roomId);
      });
      maintenances.forEach(mx => {
        if (mx.status === "completed" || mx.status === "cancelled") return;
        const s = new Date(mx.startDate), e = new Date(mx.endDate);
        if (day >= s && day <= e) blocked.add(mx.roomId);
      });
      return rooms.length - blocked.size;
    });
  }, [daysInMonth, reservations, maintenances, rooms]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
    else setViewMonth(v => v - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
    else setViewMonth(v => v + 1);
  };

  const getBars = (roomId: number): Bar[] => {
    const bars: Bar[] = [];
    const firstDay = daysInMonth[0];
    const lastDay = daysInMonth[daysInMonth.length - 1];
    const total = daysInMonth.length;

    reservations.forEach(r => {
      if (r.roomId !== roomId) return;
      if (r.status === "cancelled" || r.status === "no_show") return;
      const ci = new Date(r.checkIn), co = new Date(r.checkOut);
      if (co < firstDay || ci > lastDay) return;
      const startOffset = clamp(daysBetween(firstDay, ci), 0, total);
      const endOffset = clamp(daysBetween(firstDay, co), 0, total);
      const width = endOffset - startOffset;
      if (width <= 0) return;
      bars.push({ type: "reservation", data: r, startOffset, width });
    });

    maintenances.forEach(mx => {
      if (mx.roomId !== roomId) return;
      if (mx.status === "completed" || mx.status === "cancelled") return;
      const s = new Date(mx.startDate), e = new Date(mx.endDate);
      if (e < firstDay || s > addDays(lastDay, 1)) return;
      const startOffset = clamp(daysBetween(firstDay, s), 0, total);
      const endOffset = clamp(daysBetween(firstDay, addDays(e, 1)), 0, total);
      const width = endOffset - startOffset;
      if (width <= 0) return;
      bars.push({ type: "maintenance", data: mx, startOffset, width });
    });

    return bars;
  };

  const totalRooms = rooms.length;
  const todayIdx = daysInMonth.findIndex(d => isSameDay(d, today));
  const todayAvail = todayIdx >= 0 ? dailyAvail[todayIdx] : null;
  const activeRes = reservations.filter(r => r.status === "checked_in" || r.status === "booked").length;
  const activeMaint = maintenances.filter(mx => mx.status === "in_progress" || mx.status === "scheduled").length;
  const cols = `160px repeat(${daysInMonth.length}, 1fr)`;

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <LayoutSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t('hotelPlan.subtitle')}</p>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t('hotelPlan.title')}</h1>
              </div>

              <div className="flex gap-3 flex-wrap">
                {todayAvail !== null && !isLoading && (
                  <Card>
                    <div className="px-4 py-2.5 text-center min-w-[110px]">
                      <p className={`text-xl font-bold tabular-nums ${todayAvail > totalRooms * 0.5 ? "text-emerald-500" : "text-amber-500"}`}>
                        {todayAvail}<span className="text-xs font-normal text-muted-foreground">/{totalRooms}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{t('hotelPlan.availableToday')}</p>
                    </div>
                  </Card>
                )}
                <Card>
                  <div className="px-4 py-2.5 text-center min-w-[110px]">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto mb-1" /> : <p className="text-xl font-bold text-blue-500 tabular-nums">{activeRes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{t('hotelPlan.reservations')}</p>
                  </div>
                </Card>
                <Card>
                  <div className="px-4 py-2.5 text-center min-w-[110px]">
                    {isLoading ? <Skeleton className="h-7 w-10 mx-auto mb-1" /> : <p className="text-xl font-bold text-red-500 tabular-nums">{activeMaint}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{t('hotelPlan.maintenances')}</p>
                  </div>
                </Card>
              </div>
            </div>

            {isError && (
              <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{t('hotelPlan.loadingError')}</span>
                <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={refetchAll}>
                  <RefreshCw className="h-3.5 w-3.5" />{t('hotelPlan.retry')}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={prevMonth}>{t('hotelPlan.prevMonth')}</Button>
              <span className="text-sm font-semibold min-w-[150px] text-center tabular-nums">
                {MONTHS_FR[viewMonth]} {viewYear}
              </span>
              <Button variant="outline" size="sm" onClick={nextMonth}>{t('hotelPlan.nextMonth')}</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()); }}>
                {t('hotelPlan.today')}
              </Button>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground" onClick={refetchAll} title={t('hotelPlan.refresh')}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoading && <CalendarSkeleton />}

            {!isLoading && !isError && (
              <Card className="overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                  <div style={{ minWidth: "820px" }}>
                    <div className="grid bg-muted/40 border-b border-border" style={{ gridTemplateColumns: cols }}>
                      <div className="px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-end pb-2">
                        {t('hotelPlan.room')}
                      </div>
                      {daysInMonth.map((day, i) => {
                        const isToday = isSameDay(day, today);
                        const dow = (day.getDay() + 6) % 7;
                        const isWeekend = dow >= 5;
                        const ratio = dailyAvail[i] / (totalRooms || 1);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div className={`flex flex-col items-center pt-1.5 pb-1 select-none ${isWeekend ? "bg-muted/30" : ""}`}>
                                <span className="text-[9px] uppercase text-muted-foreground/60">{DAYS_FR[dow]}</span>
                                <span className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full mt-0.5 ${isToday ? "bg-primary text-primary-foreground font-bold" : isWeekend ? "text-foreground/60" : "text-foreground/80"}`}>
                                  {day.getDate()}
                                </span>
                                <div className="w-full h-[3px] mt-1 bg-muted overflow-hidden">
                                  <div className={`h-full transition-all ${ratio > .6 ? "bg-emerald-500" : ratio > .3 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${ratio * 100}%` }} />
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {t('hotelPlan.availableRooms', { avail: dailyAvail[i], total: totalRooms })}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>

                    {rooms.map(room => {
                      const bars = getBars(room.id);
                      const rs = ROOM_STATUS[room.status] ?? ROOM_STATUS.available;
                      return (
                        <div key={room.id} className="grid border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors" style={{ gridTemplateColumns: cols, height: "42px", position: "relative" }}>
                          <div className="flex items-center gap-2 px-3 z-10">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${rs.dot}`} />
                            <span className="text-sm font-semibold tabular-nums leading-none">#{room.number}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal hidden sm:inline-flex">{room.type}</Badge>
                          </div>

                          {daysInMonth.map((day, i) => {
                            const isToday = isSameDay(day, today);
                            const isWeekend = ((day.getDay() + 6) % 7) >= 5;
                            return <div key={i} className={`h-full border-l border-border/25 ${isToday ? "bg-primary/5 border-l-primary/30" : ""} ${isWeekend && !isToday ? "bg-muted/10" : ""}`} />;
                          })}

                          <div className="absolute inset-y-[5px] pointer-events-none" style={{ left: "160px", right: 0, display: "grid", gridTemplateColumns: `repeat(${daysInMonth.length}, 1fr)` }}>
                            {bars.map((bar, bi) => <BarPopover key={bi} bar={bar} t={t} />)}
                          </div>
                        </div>
                      );
                    })}

                    <div className="grid bg-muted/30 border-t border-border" style={{ gridTemplateColumns: cols }}>
                      <div className="px-3 py-2 flex items-center">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {t('common.available')} / {totalRooms}
                        </span>
                      </div>
                      {daysInMonth.map((day, i) => {
                        const avail = dailyAvail[i];
                        const ratio = avail / (totalRooms || 1);
                        const isToday = isSameDay(day, today);
                        return (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <div className={`flex flex-col items-center justify-center py-1.5 cursor-default ${isToday ? "bg-primary/5" : ""}`}>
                                <span className={`text-[11px] font-semibold tabular-nums ${ratio > .6 ? "text-emerald-500" : ratio > .3 ? "text-amber-500" : "text-red-500"}`}>
                                  {avail}
                                </span>
                                <div className="w-full px-0.5 mt-0.5">
                                  <div className="h-[3px] rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full rounded-full ${ratio > .6 ? "bg-emerald-500" : ratio > .3 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${ratio * 100}%` }} />
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {t('hotelPlan.availableRooms', { avail, total: totalRooms })}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && !isError && (
              <div className="mt-5 flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{t('hotelPlan.reservationStatus')}</p>
                  <div className="flex flex-wrap gap-3">
                    {(Object.entries(RES_STYLE) as [ReservationStatus, typeof RES_STYLE[ReservationStatus]][]).map(([k, s]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${s.dot}`} />
                        <span className="text-xs text-muted-foreground">{t(`hotelPlan.${s.label}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator orientation="vertical" className="hidden sm:block self-stretch h-auto" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{t('hotelPlan.maintenanceStatus')}</p>
                  <div className="flex flex-wrap gap-3">
                    {(Object.entries(MAINT_STYLE) as [MaintenanceStatus, typeof MAINT_STYLE[MaintenanceStatus]][]).map(([k, s]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${s.dot}`} />
                        <span className="text-xs text-muted-foreground">{t(`hotelPlan.${s.label}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator orientation="vertical" className="hidden sm:block self-stretch h-auto" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{t('hotelPlan.roomStatus')}</p>
                  <div className="flex flex-wrap gap-3">
                    {(Object.entries(ROOM_STATUS) as [RoomStatus, typeof ROOM_STATUS[RoomStatus]][]).map(([k, s]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="text-xs text-muted-foreground">{t(`hotelPlan.${s.label}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}