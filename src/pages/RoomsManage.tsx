// src/pages/rooms/RoomsManage.tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Download, RefreshCw, BedDouble, Wrench,
  ChevronDown, FileSpreadsheet, FileText, FileCode, Table as TableIcon,
  LayoutGrid, List, AlertCircle, CheckCircle2, Clock, Ban,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

// ── Types (identiques à HotelCalendarPage) ────────────────────────────────────

type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance" | "out_of_order";
type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

interface Room {
  id: number;
  number: string;
  type: string;
  status: RoomStatus;
}

interface RoomMaintenance {
  id: number;
  roomId: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: MaintenanceStatus;
  createdAt: string;
  room?: Room;
}

// ── Constantes visuelles (même palette que HotelCalendar) ────────────────────

const ROOM_STATUS_META: Record<RoomStatus, { label: string; dot: string; badge: string }> = {
  available: { label: "available", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  occupied: { label: "occupied", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  cleaning: { label: "cleaning", dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  maintenance: { label: "maintenance", dot: "bg-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  out_of_order: { label: "outOfOrder", dot: "bg-slate-500", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const MAINT_STATUS_META: Record<MaintenanceStatus, { label: string; icon: React.ElementType; badge: string }> = {
  scheduled: { label: "scheduled", icon: Clock, badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  in_progress: { label: "inProgress", icon: AlertCircle, badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  completed: { label: "completed", icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  cancelled: { label: "cancelled", icon: Ban, badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const ROOM_TYPES = ["Simple", "Double", "Triple", "Familial", "Deluxe", "Suite"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string, t: any) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status, t }: { status: RoomStatus; t: any }) {
  const meta = ROOM_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {t(`hotel.${meta.label}`)}
    </span>
  );
}

function MaintBadge({ status, t }: { status: MaintenanceStatus; t: any }) {
  const meta = MAINT_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
      <Icon className="w-3 h-3" />
      {t(`hotelPlan.${meta.label}`)}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function RoomsManage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: rooms = [], isLoading: loadRooms, refetch: refetchRooms } = useQuery<Room[]>({
    queryKey: ["hotel", "rooms"],
    queryFn: () => api.get<Room[]>("/hotel/rooms"),
    staleTime: 30_000,
  });

  const { data: maintenances = [], isLoading: loadMaint, refetch: refetchMaint } = useQuery<RoomMaintenance[]>({
    queryKey: ["hotel", "maintenances"],
    queryFn: () => api.get<RoomMaintenance[]>("/hotel/maintenances"),
    staleTime: 30_000,
  });

  // ── UI state ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleteMTarget, setDeleteMTarget] = useState<RoomMaintenance | null>(null);

  // ── Add room form ─────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newType, setNewType] = useState(ROOM_TYPES[0]);
  const [newStatus, setNewStatus] = useState<RoomStatus>("available");

  // ── Bulk add form ─────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState(101);
  const [bulkEnd, setBulkEnd] = useState(110);
  const [bulkType, setBulkType] = useState(ROOM_TYPES[0]);

  // ── Add maintenance form ──────────────────────────────────────────────────
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintRoomId, setMaintRoomId] = useState<string>("");
  const [maintStart, setMaintStart] = useState("");
  const [maintEnd, setMaintEnd] = useState("");
  const [maintReason, setMaintReason] = useState("");
  const [maintStatus, setMaintStatus] = useState<MaintenanceStatus>("scheduled");

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addRoom = useMutation({
    mutationFn: () => api.post("/hotel/rooms", { number: newNumber, type: newType, status: newStatus }),
    onSuccess: () => {
      setNewNumber(""); setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('rooms.roomAdded'), description: `${t('hotel.room')} #${newNumber} ${t('rooms.created')}.` });
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const bulkAdd = useMutation({
    mutationFn: async () => {
      await Promise.all(
        Array.from({ length: bulkEnd - bulkStart + 1 }, (_, i) =>
          api.post("/hotel/rooms", { number: String(bulkStart + i), type: bulkType, status: "available" })
        )
      );
    },
    onSuccess: () => {
      setBulkOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('rooms.bulkAdded'), description: `${bulkEnd - bulkStart + 1} ${t('rooms.roomsCreated')}.` });
    },
    onError: (e: any) => toast({ title: t('rooms.bulkAddError'), description: String(e), variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: RoomStatus }) =>
      api.patch(`/hotel/rooms/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('common.status') + " " + t('rooms.updated') });
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const deleteRoom = useMutation({
    mutationFn: (id: number) => api.del(`/hotel/rooms/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('rooms.roomDeleted') });
    },
    onError: (e: any) => {
      setDeleteTarget(null);
      toast({ title: t('rooms.deleteImpossible'), description: String(e), variant: "destructive" });
    },
  });

  const addMaintenance = useMutation({
    mutationFn: () => api.post("/hotel/maintenances", {
      roomId: Number(maintRoomId),
      startDate: new Date(maintStart).toISOString(),
      endDate: new Date(maintEnd).toISOString(),
      reason: maintReason || undefined,
      status: maintStatus,
    }),
    onSuccess: () => {
      setMaintOpen(false);
      setMaintRoomId(""); setMaintStart(""); setMaintEnd(""); setMaintReason(""); setMaintStatus("scheduled");
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('rooms.maintenanceCreated') });
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const updateMaintStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: MaintenanceStatus }) =>
      api.patch(`/hotel/maintenances/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: t('common.status') + " " + t('rooms.updated') });
    },
    onError: (e: any) => toast({ title: t('common.error'), description: String(e), variant: "destructive" }),
  });

  const deleteMaintenance = useMutation({
    mutationFn: (id: number) => api.del(`/hotel/maintenances/${id}`),
    onSuccess: () => {
      setDeleteMTarget(null);
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      toast({ title: t('rooms.maintenanceDeleted') });
    },
    onError: (e: any) => {
      setDeleteMTarget(null);
      toast({ title: t('rooms.deleteImpossible'), description: String(e), variant: "destructive" });
    },
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const sorted = [...rooms].sort((a, b) => Number(a.number) - Number(b.number));

  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === "available").length,
    occupied: rooms.filter(r => r.status === "occupied").length,
    cleaning: rooms.filter(r => r.status === "cleaning").length,
    maintenance: rooms.filter(r => r.status === "maintenance" || r.status === "out_of_order").length,
  };

  const maintStats = {
    active: maintenances.filter(m => m.status === "in_progress").length,
    scheduled: maintenances.filter(m => m.status === "scheduled").length,
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportData = () => ({
    date: new Date().toLocaleDateString("fr-FR"),
    rooms: sorted.map(r => ({
      numero: r.number, type: r.type,
      statut: t(`hotel.${ROOM_STATUS_META[r.status]?.label ?? r.status}`), id: r.id,
    })),
    maintenances: maintenances.map(m => ({
      chambre: rooms.find(r => r.id === m.roomId)?.number ?? m.roomId,
      debut: fmtDate(m.startDate, t),
      fin: fmtDate(m.endDate, t),
      motif: m.reason ?? "—",
      statut: t(`hotelPlan.${MAINT_STATUS_META[m.status]?.label ?? m.status}`),
    })),
  });

  const doExport = async (fmt: string) => {
    if (!rooms.length) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }
    setExportLoading(true);
    setExportOpen(false);
    try {
      const d = exportData();
      if (fmt === "excel") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.rooms), t('rooms.rooms'));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.maintenances), t('rooms.maintenances'));
        saveAs(
          new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })],
            { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `rooms-${d.date}.xlsx`
        );
      } else if (fmt === "csv") {
        const rows = [`${t('rooms.number')},${t('hotel.type')},${t('common.status')},ID`, ...d.rooms.map(r => `${r.numero},${r.type},${r.statut},${r.id}`)].join("\n");
        saveAs(new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8" }), `rooms-${d.date}.csv`);
      } else if (fmt === "json") {
        saveAs(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), `rooms-${d.date}.json`);
      } else {
        const txt = d.rooms.map(r => `#${r.numero}  ${r.type.padEnd(10)}  ${r.statut}`).join("\n");
        saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `rooms-${d.date}.txt`);
      }
      toast({ title: t('export.exportSuccess'), description: `${rooms.length} ${t('rooms.roomsExported')}` });
    } catch (e) {
      toast({ title: t('export.exportError'), description: String(e), variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ── Titre + actions ── */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{t('hotel.configuration')}</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t('rooms.roomManagement')}</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Refresh */}
              <Button variant="ghost" size="icon" className="h-9 w-9"
                onClick={() => { refetchRooms(); refetchMaint(); }}>
                <RefreshCw className={`h-4 w-4 ${(loadRooms || loadMaint) ? "animate-spin" : ""}`} />
              </Button>

              {/* Export dropdown */}
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
                        { fmt: "excel", label: t('export.excel'), ext: ".xlsx", Icon: FileSpreadsheet, color: "text-emerald-600" },
                        { fmt: "csv", label: t('export.csv'), ext: ".csv", Icon: TableIcon, color: "text-blue-600" },
                        { fmt: "json", label: t('export.json'), ext: ".json", Icon: FileCode, color: "text-orange-600" },
                        { fmt: "txt", label: t('export.txt'), ext: ".txt", Icon: FileText, color: "text-violet-600" },
                      ].map(({ fmt, label, ext, Icon, color }) => (
                        <button key={fmt}
                          className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onClick={() => doExport(fmt)}>
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="font-medium flex-1 text-left">{label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{ext}</span>
                        </button>
                      ))}
                      <div className="border-t border-border px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">{rooms.length} {t('rooms.roomsCount')} · {new Date().toLocaleDateString("fr-FR")}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Ajout maintenance */}
              <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Wrench className="h-4 w-4" />
                    {t('rooms.maintenance')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t('rooms.scheduleMaintenance')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>{t('hotel.room')}</Label>
                      <Select value={maintRoomId} onValueChange={setMaintRoomId}>
                        <SelectTrigger><SelectValue placeholder={t('hotel.selectRoom')} /></SelectTrigger>
                        <SelectContent>
                          {sorted.map(r => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              #{r.number} — {r.type}
                              <span className="ml-2 text-xs text-muted-foreground">({t(`hotel.${ROOM_STATUS_META[r.status]?.label ?? r.status}`)})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{t('rooms.startDate')}</Label>
                        <Input type="date" value={maintStart} onChange={e => setMaintStart(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('rooms.endDate')}</Label>
                        <Input type="date" value={maintEnd} onChange={e => setMaintEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('rooms.initialStatus')}</Label>
                      <Select value={maintStatus} onValueChange={v => setMaintStatus(v as MaintenanceStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(MAINT_STATUS_META) as [MaintenanceStatus, any][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{t(`hotelPlan.${v.label}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('rooms.reason')} <span className="text-muted-foreground">({t('common.optional')})</span></Label>
                      <Textarea rows={2} placeholder={t('rooms.reasonPlaceholder')}
                        value={maintReason} onChange={e => setMaintReason(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setMaintOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => addMaintenance.mutate()}
                      disabled={!maintRoomId || !maintStart || !maintEnd || addMaintenance.isPending}>
                      {addMaintenance.isPending ? t('common.loading') : t('rooms.createMaintenance')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Ajout chambre */}
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('rooms.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('rooms.addRoom')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>{t('rooms.number')}</Label>
                      <Input placeholder="ex: 121" value={newNumber} onChange={e => setNewNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('hotel.type')}</Label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('rooms.initialStatus')}</Label>
                      <Select value={newStatus} onValueChange={v => setNewStatus(v as RoomStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{t(`hotel.${v.label}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => addRoom.mutate()} disabled={!newNumber || addRoom.isPending}>
                      {addRoom.isPending ? t('common.loading') : t('rooms.add')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Ajout par plage */}
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('rooms.bulk')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('rooms.bulkAdd')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{t('rooms.start')}</Label>
                        <Input type="number" min={1} value={bulkStart}
                          onChange={e => setBulkStart(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('rooms.end')}</Label>
                        <Input type="number" min={1} value={bulkEnd}
                          onChange={e => setBulkEnd(Number(e.target.value))} />
                      </div>
                    </div>
                    {bulkEnd >= bulkStart && (
                      <p className="text-xs text-muted-foreground">
                        {bulkEnd - bulkStart + 1} {t('rooms.roomsWillBeCreated')} (#{bulkStart} → #{bulkEnd})
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <Label>{t('hotel.type')}</Label>
                      <Select value={bulkType} onValueChange={setBulkType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setBulkOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={() => bulkAdd.mutate()}
                      disabled={bulkEnd < bulkStart || bulkAdd.isPending}>
                      {bulkAdd.isPending ? t('common.loading') : t('rooms.createRange')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label={t('rooms.total')} value={stats.total} color="text-foreground" />
            <StatCard label={t('hotel.available')} value={stats.available} color="text-emerald-500" sub={`${Math.round(stats.available / Math.max(stats.total, 1) * 100)}%`} />
            <StatCard label={t('hotel.occupied')} value={stats.occupied} color="text-blue-500" />
            <StatCard label={t('hotel.cleaning')} value={stats.cleaning} color="text-amber-500" />
            <StatCard label={t('hotel.maintenance')} value={stats.maintenance} color="text-red-500"
              sub={`${maintStats.active} ${t('rooms.inProgress')} · ${maintStats.scheduled} ${t('rooms.scheduled')}`} />
          </div>

          {/* ── Tabs ── */}
          <Tabs defaultValue="rooms">
            <TabsList className="mb-4">
              <TabsTrigger value="rooms" className="gap-2">
                <BedDouble className="h-4 w-4" />
                {t('rooms.rooms')}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">{rooms.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="maintenances" className="gap-2">
                <Wrench className="h-4 w-4" />
                {t('rooms.maintenances')}
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">{maintenances.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ─────────────── TAB CHAMBRES ─────────────── */}
            <TabsContent value="rooms">
              <Card>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">{rooms.length} {t('rooms.rooms')}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-7 w-7"
                      onClick={() => setViewMode("table")}>
                      <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7"
                      onClick={() => setViewMode("grid")}>
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  {loadRooms ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : viewMode === "table" ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">{t('rooms.number')}</TableHead>
                          <TableHead>{t('hotel.type')}</TableHead>
                          <TableHead>{t('common.status')}</TableHead>
                          <TableHead className="w-52">{t('rooms.changeStatus')}</TableHead>
                          <TableHead className="w-16 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map(room => (
                          <TableRow key={room.id} className="group">
                            <TableCell className="font-semibold tabular-nums">#{room.number}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal text-xs">{room.type}</Badge>
                            </TableCell>
                            <TableCell><StatusBadge status={room.status} t={t} /></TableCell>
                            <TableCell>
                              <Select value={room.status}
                                onValueChange={v => updateStatus.mutate({ id: room.id, status: v as RoomStatus })}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{t(`hotel.${v.label}`)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(room)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    /* ── GRID ── */
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {sorted.map(room => {
                        const meta = ROOM_STATUS_META[room.status];
                        return (
                          <div key={room.id} className="relative border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors group">
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-base font-bold tabular-nums">#{room.number}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(room)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-normal mb-2">{room.type}</Badge>
                            <Select value={room.status}
                              onValueChange={v => updateStatus.mutate({ id: room.id, status: v as RoomStatus })}>
                              <SelectTrigger className="h-6 text-[10px] px-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                  <span>{t(`hotel.${meta.label}`)}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                                  <SelectItem key={k} value={k} className="text-xs">{t(`hotel.${v.label}`)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─────────────── TAB MAINTENANCES ─────────────── */}
            <TabsContent value="maintenances">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold">{maintenances.length} {t('rooms.maintenances')}</CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  {loadMaint ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : maintenances.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
                      <Wrench className="h-8 w-8 opacity-30" />
                      <p className="text-sm">{t('rooms.noMaintenances')}</p>
                      <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => setMaintOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> {t('rooms.scheduleMaintenance')}
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">{t('hotel.room')}</TableHead>
                          <TableHead>{t('rooms.reason')}</TableHead>
                          <TableHead>{t('rooms.start')}</TableHead>
                          <TableHead>{t('rooms.end')}</TableHead>
                          <TableHead>{t('common.status')}</TableHead>
                          <TableHead className="w-52">{t('rooms.changeStatus')}</TableHead>
                          <TableHead className="w-16 text-right">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...maintenances]
                          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                          .map(mx => {
                            const room = rooms.find(r => r.id === mx.roomId);
                            return (
                              <TableRow key={mx.id} className="group">
                                <TableCell className="font-semibold tabular-nums">
                                  #{room?.number ?? mx.roomId}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                                  {mx.reason ?? <span className="italic opacity-50">—</span>}
                                </TableCell>
                                <TableCell className="text-sm tabular-nums">{fmtDate(mx.startDate, t)}</TableCell>
                                <TableCell className="text-sm tabular-nums">{fmtDate(mx.endDate, t)}</TableCell>
                                <TableCell><MaintBadge status={mx.status} t={t} /></TableCell>
                                <TableCell>
                                  <Select value={mx.status}
                                    onValueChange={v => updateMaintStatus.mutate({ id: mx.id, status: v as MaintenanceStatus })}>
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.entries(MAINT_STATUS_META) as [MaintenanceStatus, any][]).map(([k, v]) => (
                                        <SelectItem key={k} value={k} className="text-xs">{t(`hotelPlan.${v.label}`)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon"
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteMTarget(mx)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </main>
      </div>

      {/* ── Confirm delete room ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rooms.deleteRoomConfirm', { number: deleteTarget?.number })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('rooms.deleteRoomWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteRoom.mutate(deleteTarget.id)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm delete maintenance ── */}
      <AlertDialog open={!!deleteMTarget} onOpenChange={o => !o && setDeleteMTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rooms.deleteMaintenanceConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMTarget?.reason
                ? `« ${deleteMTarget.reason} » — `
                : ""}
              {deleteMTarget && `${t('rooms.from')} ${fmtDate(deleteMTarget.startDate, t)} ${t('rooms.to')} ${fmtDate(deleteMTarget.endDate, t)}`}
              <br />{t('rooms.deleteMaintenanceWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMTarget && deleteMaintenance.mutate(deleteMTarget.id)}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}