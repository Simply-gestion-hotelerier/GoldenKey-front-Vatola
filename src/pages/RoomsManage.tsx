// pages/rooms/RoomsManage.tsx
// Gestion des chambres + maintenances — cohérent avec HotelCalendarPage

import { useState }                                       from "react";
import { useMutation, useQuery, useQueryClient }          from "@tanstack/react-query";
import { api }                                            from "@/lib/api";
import { Sidebar }                                        from "@/components/layout/sidebar";
import { Header }                                         from "@/components/layout/header";
import { Badge }                                          from "@/components/ui/badge";
import { Button }                                         from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle }       from "@/components/ui/card";
import { Input }                                          from "@/components/ui/input";
import { Label }                                          from "@/components/ui/label";
import { Separator }                                      from "@/components/ui/separator";
import { Skeleton }                                       from "@/components/ui/skeleton";
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
import { Textarea }   from "@/components/ui/textarea";
import { toast }      from "@/hooks/use-toast";
import {
  Plus, Trash2, Download, RefreshCw, BedDouble, Wrench,
  ChevronDown, FileSpreadsheet, FileText, FileCode, Table as TableIcon,
  LayoutGrid, List, AlertCircle, CheckCircle2, Clock, Ban,
} from "lucide-react";
import * as XLSX    from "xlsx";
import { saveAs }   from "file-saver";

// ── Types (identiques à HotelCalendarPage) ────────────────────────────────────

type RoomStatus        = "available" | "occupied" | "cleaning" | "maintenance" | "out_of_order";
type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

interface Room {
  id:     number;
  number: string;
  type:   string;
  status: RoomStatus;
}

interface RoomMaintenance {
  id:        number;
  roomId:    number;
  startDate: string;
  endDate:   string;
  reason?:   string | null;
  status:    MaintenanceStatus;
  createdAt: string;
  room?:     Room;
}

// ── Constantes visuelles (même palette que HotelCalendar) ────────────────────

const ROOM_STATUS_META: Record<RoomStatus, { label: string; dot: string; badge: string }> = {
  available:    { label: "Disponible",   dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  occupied:     { label: "Occupée",      dot: "bg-blue-500",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  cleaning:     { label: "Nettoyage",    dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  maintenance:  { label: "Maintenance",  dot: "bg-red-500",     badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  out_of_order: { label: "Hors service", dot: "bg-slate-500",   badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const MAINT_STATUS_META: Record<MaintenanceStatus, { label: string; icon: React.ElementType; badge: string }> = {
  scheduled:   { label: "Planifiée",  icon: Clock,         badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  in_progress: { label: "En cours",   icon: AlertCircle,   badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  completed:   { label: "Terminée",   icon: CheckCircle2,  badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  cancelled:   { label: "Annulée",    icon: Ban,           badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const ROOM_TYPES = ["Simple", "Double", "Triple", "Familial", "Deluxe", "Suite"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: RoomStatus }) {
  const meta = ROOM_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function MaintBadge({ status }: { status: MaintenanceStatus }) {
  const meta = MAINT_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
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
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: rooms = [], isLoading: loadRooms, refetch: refetchRooms } = useQuery<Room[]>({
    queryKey: ["hotel", "rooms"],
    queryFn:  () => api.get<Room[]>("/hotel/rooms"),
    staleTime: 30_000,
  });

  const { data: maintenances = [], isLoading: loadMaint, refetch: refetchMaint } = useQuery<RoomMaintenance[]>({
    queryKey: ["hotel", "maintenances"],
    queryFn:  () => api.get<RoomMaintenance[]>("/hotel/maintenances"),
    staleTime: 30_000,
  });

  // ── UI state ─────────────────────────────────────────────────────────────
  const [viewMode,      setViewMode]      = useState<"grid" | "table">("table");
  const [exportOpen,    setExportOpen]    = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<Room | null>(null);
  const [deleteMTarget, setDeleteMTarget] = useState<RoomMaintenance | null>(null);

  // ── Add room form ─────────────────────────────────────────────────────────
  const [addOpen,      setAddOpen]      = useState(false);
  const [newNumber,    setNewNumber]    = useState("");
  const [newType,      setNewType]      = useState(ROOM_TYPES[0]);
  const [newStatus,    setNewStatus]    = useState<RoomStatus>("available");

  // ── Bulk add form ─────────────────────────────────────────────────────────
  const [bulkOpen,     setBulkOpen]     = useState(false);
  const [bulkStart,    setBulkStart]    = useState(101);
  const [bulkEnd,      setBulkEnd]      = useState(110);
  const [bulkType,     setBulkType]     = useState(ROOM_TYPES[0]);

  // ── Add maintenance form ──────────────────────────────────────────────────
  const [maintOpen,     setMaintOpen]    = useState(false);
  const [maintRoomId,   setMaintRoomId]  = useState<string>("");
  const [maintStart,    setMaintStart]   = useState("");
  const [maintEnd,      setMaintEnd]     = useState("");
  const [maintReason,   setMaintReason]  = useState("");
  const [maintStatus,   setMaintStatus]  = useState<MaintenanceStatus>("scheduled");

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addRoom = useMutation({
    mutationFn: () => api.post("/hotel/rooms", { number: newNumber, type: newType, status: newStatus }),
    onSuccess: () => {
      setNewNumber(""); setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: "Chambre ajoutée", description: `Chambre #${newNumber} créée.` });
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e), variant: "destructive" }),
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
      toast({ title: "Plage ajoutée", description: `${bulkEnd - bulkStart + 1} chambre(s) créées.` });
    },
    onError: (e: any) => toast({ title: "Erreur ajout en masse", description: String(e), variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: RoomStatus }) =>
      api.patch(`/hotel/rooms/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e), variant: "destructive" }),
  });

  const deleteRoom = useMutation({
    mutationFn: (id: number) => api.del(`/hotel/rooms/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: "Chambre supprimée" });
    },
    onError: (e: any) => {
      setDeleteTarget(null);
      toast({ title: "Suppression impossible", description: String(e), variant: "destructive" });
    },
  });

  const addMaintenance = useMutation({
    mutationFn: () => api.post("/hotel/maintenances", {
      roomId:    Number(maintRoomId),
      startDate: new Date(maintStart).toISOString(),
      endDate:   new Date(maintEnd).toISOString(),
      reason:    maintReason || undefined,
      status:    maintStatus,
    }),
    onSuccess: () => {
      setMaintOpen(false);
      setMaintRoomId(""); setMaintStart(""); setMaintEnd(""); setMaintReason(""); setMaintStatus("scheduled");
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: "Maintenance créée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e), variant: "destructive" }),
  });

  const updateMaintStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: MaintenanceStatus }) =>
      api.patch(`/hotel/maintenances/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      qc.invalidateQueries({ queryKey: ["hotel", "rooms"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: String(e), variant: "destructive" }),
  });

  const deleteMaintenance = useMutation({
    mutationFn: (id: number) => api.del(`/hotel/maintenances/${id}`),
    onSuccess: () => {
      setDeleteMTarget(null);
      qc.invalidateQueries({ queryKey: ["hotel", "maintenances"] });
      toast({ title: "Maintenance supprimée" });
    },
    onError: (e: any) => {
      setDeleteMTarget(null);
      toast({ title: "Suppression impossible", description: String(e), variant: "destructive" });
    },
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const sorted = [...rooms].sort((a, b) => Number(a.number) - Number(b.number));

  const stats = {
    total:       rooms.length,
    available:   rooms.filter(r => r.status === "available").length,
    occupied:    rooms.filter(r => r.status === "occupied").length,
    cleaning:    rooms.filter(r => r.status === "cleaning").length,
    maintenance: rooms.filter(r => r.status === "maintenance" || r.status === "out_of_order").length,
  };

  const maintStats = {
    active:    maintenances.filter(m => m.status === "in_progress").length,
    scheduled: maintenances.filter(m => m.status === "scheduled").length,
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const exportData = () => ({
    date:   new Date().toLocaleDateString("fr-FR"),
    rooms:  sorted.map(r => ({
      numero: r.number, type: r.type,
      statut: ROOM_STATUS_META[r.status]?.label ?? r.status, id: r.id,
    })),
    maintenances: maintenances.map(m => ({
      chambre:  rooms.find(r => r.id === m.roomId)?.number ?? m.roomId,
      debut:    fmtDate(m.startDate),
      fin:      fmtDate(m.endDate),
      motif:    m.reason ?? "—",
      statut:   MAINT_STATUS_META[m.status]?.label ?? m.status,
    })),
  });

  const doExport = async (fmt: string) => {
    if (!rooms.length) { toast({ title: "Aucune donnée", variant: "destructive" }); return; }
    setExportLoading(true); setExportOpen(false);
    try {
      const d = exportData();
      if (fmt === "excel") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.rooms), "Chambres");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.maintenances), "Maintenances");
        saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })],
          { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `chambres-${d.date}.xlsx`);
      } else if (fmt === "csv") {
        const rows = ["Numéro,Type,Statut,ID", ...d.rooms.map(r => `${r.numero},${r.type},${r.statut},${r.id}`)].join("\n");
        saveAs(new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8" }), `chambres-${d.date}.csv`);
      } else if (fmt === "json") {
        saveAs(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), `chambres-${d.date}.json`);
      } else {
        const txt = d.rooms.map(r => `#${r.numero}  ${r.type.padEnd(10)}  ${r.statut}`).join("\n");
        saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `chambres-${d.date}.txt`);
      }
      toast({ title: "Export réussi", description: `${rooms.length} chambre(s) exportée(s)` });
    } catch (e) {
      toast({ title: "Erreur export", description: String(e), variant: "destructive" });
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
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Hôtel · Configuration</p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Gestion des Chambres</h1>
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
                  Exporter
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
                </Button>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 pt-2.5 pb-1.5">Format</p>
                      {[
                        { fmt: "excel", label: "Excel",  ext: ".xlsx", Icon: FileSpreadsheet, color: "text-emerald-600" },
                        { fmt: "csv",   label: "CSV",    ext: ".csv",  Icon: TableIcon,       color: "text-blue-600"   },
                        { fmt: "json",  label: "JSON",   ext: ".json", Icon: FileCode,        color: "text-orange-600" },
                        { fmt: "txt",   label: "Texte",  ext: ".txt",  Icon: FileText,        color: "text-violet-600" },
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
                        <p className="text-[10px] text-muted-foreground">{rooms.length} chambre(s) · {new Date().toLocaleDateString("fr-FR")}</p>
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
                    Maintenance
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Planifier une maintenance</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>Chambre</Label>
                      <Select value={maintRoomId} onValueChange={setMaintRoomId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner une chambre" /></SelectTrigger>
                        <SelectContent>
                          {sorted.map(r => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              #{r.number} — {r.type}
                              <span className="ml-2 text-xs text-muted-foreground">({ROOM_STATUS_META[r.status]?.label})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Date de début</Label>
                        <Input type="date" value={maintStart} onChange={e => setMaintStart(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date de fin</Label>
                        <Input type="date" value={maintEnd} onChange={e => setMaintEnd(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Statut initial</Label>
                      <Select value={maintStatus} onValueChange={v => setMaintStatus(v as MaintenanceStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(MAINT_STATUS_META) as [MaintenanceStatus, any][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Motif <span className="text-muted-foreground">(optionnel)</span></Label>
                      <Textarea rows={2} placeholder="Plomberie, peinture, climatisation…"
                        value={maintReason} onChange={e => setMaintReason(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setMaintOpen(false)}>Annuler</Button>
                    <Button onClick={() => addMaintenance.mutate()}
                      disabled={!maintRoomId || !maintStart || !maintEnd || addMaintenance.isPending}>
                      {addMaintenance.isPending ? "Création…" : "Créer la maintenance"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Ajout chambre */}
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Ajouter une chambre</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>Numéro</Label>
                      <Input placeholder="ex: 121" value={newNumber} onChange={e => setNewNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={newType} onValueChange={setNewType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Statut initial</Label>
                      <Select value={newStatus} onValueChange={v => setNewStatus(v as RoomStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
                    <Button onClick={() => addRoom.mutate()} disabled={!newNumber || addRoom.isPending}>
                      {addRoom.isPending ? "Création…" : "Ajouter"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Ajout par plage */}
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Plage
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Ajout par plage</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Début</Label>
                        <Input type="number" min={1} value={bulkStart}
                          onChange={e => setBulkStart(Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Fin</Label>
                        <Input type="number" min={1} value={bulkEnd}
                          onChange={e => setBulkEnd(Number(e.target.value))} />
                      </div>
                    </div>
                    {bulkEnd >= bulkStart && (
                      <p className="text-xs text-muted-foreground">
                        {bulkEnd - bulkStart + 1} chambre(s) seront créées (#{bulkStart} → #{bulkEnd})
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={bulkType} onValueChange={setBulkType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setBulkOpen(false)}>Annuler</Button>
                    <Button onClick={() => bulkAdd.mutate()}
                      disabled={bulkEnd < bulkStart || bulkAdd.isPending}>
                      {bulkAdd.isPending ? "Création…" : "Créer la plage"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ── Stats cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total"        value={stats.total}       color="text-foreground" />
            <StatCard label="Disponibles"  value={stats.available}   color="text-emerald-500" sub={`${Math.round(stats.available/Math.max(stats.total,1)*100)}%`} />
            <StatCard label="Occupées"     value={stats.occupied}    color="text-blue-500" />
            <StatCard label="Nettoyage"    value={stats.cleaning}    color="text-amber-500" />
            <StatCard label="Maintenance"  value={stats.maintenance} color="text-red-500"
              sub={`${maintStats.active} en cours · ${maintStats.scheduled} planifiée(s)`} />
          </div>

          {/* ── Tabs ── */}
          <Tabs defaultValue="rooms">
            <TabsList className="mb-4">
              <TabsTrigger value="rooms" className="gap-2">
                <BedDouble className="h-4 w-4" />
                Chambres
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">{rooms.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="maintenances" className="gap-2">
                <Wrench className="h-4 w-4" />
                Maintenances
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-4 text-[10px]">{maintenances.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ─────────────── TAB CHAMBRES ─────────────── */}
            <TabsContent value="rooms">
              <Card>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">{rooms.length} chambre(s)</CardTitle>
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
                    /* ── TABLE ── */
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">N°</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-52">Changer statut</TableHead>
                          <TableHead className="w-16 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sorted.map(room => (
                          <TableRow key={room.id} className="group">
                            <TableCell className="font-semibold tabular-nums">#{room.number}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal text-xs">{room.type}</Badge>
                            </TableCell>
                            <TableCell><StatusBadge status={room.status} /></TableCell>
                            <TableCell>
                              <Select value={room.status}
                                onValueChange={v => updateStatus.mutate({ id: room.id, status: v as RoomStatus })}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
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
                                  <span>{meta.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(ROOM_STATUS_META) as [RoomStatus, any][]).map(([k, v]) => (
                                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
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
                  <CardTitle className="text-sm font-semibold">{maintenances.length} maintenance(s)</CardTitle>
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
                      <p className="text-sm">Aucune maintenance enregistrée</p>
                      <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => setMaintOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Planifier une maintenance
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Chambre</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Début</TableHead>
                          <TableHead>Fin</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="w-52">Changer statut</TableHead>
                          <TableHead className="w-16 text-right">Action</TableHead>
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
                                <TableCell className="text-sm tabular-nums">{fmtDate(mx.startDate)}</TableCell>
                                <TableCell className="text-sm tabular-nums">{fmtDate(mx.endDate)}</TableCell>
                                <TableCell><MaintBadge status={mx.status} /></TableCell>
                                <TableCell>
                                  <Select value={mx.status}
                                    onValueChange={v => updateMaintStatus.mutate({ id: mx.id, status: v as MaintenanceStatus })}>
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.entries(MAINT_STATUS_META) as [MaintenanceStatus, any][]).map(([k, v]) => (
                                        <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
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
            <AlertDialogTitle>Supprimer la chambre #{deleteTarget?.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La chambre sera supprimée définitivement.
              Impossible si elle possède des réservations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteRoom.mutate(deleteTarget.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm delete maintenance ── */}
      <AlertDialog open={!!deleteMTarget} onOpenChange={o => !o && setDeleteMTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette maintenance ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMTarget?.reason
                ? `« ${deleteMTarget.reason} » — `
                : ""}
              {deleteMTarget && `du ${fmtDate(deleteMTarget.startDate)} au ${fmtDate(deleteMTarget.endDate)}`}
              <br />Impossible de supprimer une maintenance en cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMTarget && deleteMaintenance.mutate(deleteMTarget.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}