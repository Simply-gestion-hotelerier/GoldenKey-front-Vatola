import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/rbac";
import { api } from "@/lib/api";
import { Brush, CheckCircle2, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

function mapApiToUi(status: string): "dirty"|"clean"|"inspected"|"out-of-order"|"occupied" {
  if (status === "cleaning") return "dirty";
  if (status === "out_of_order" || status === "maintenance") return "out-of-order";
  if (status === "occupied") return "occupied";
  return "clean";
}
function mapUiToApi(status: string): string {
  if (status === "dirty") return "cleaning";
  if (status === "out-of-order") return "out_of_order";
  if (status === "inspected" || status === "clean") return "available";
  return "available";
}

export default function Housekeeping() {
  const { hasScope } = useAuth();
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({ queryKey: ["hotel","rooms"], queryFn: () => api.get<any[]>("/hotel/rooms") });

  // persist inspected room ids in localStorage so they appear in "Inspectées"
  const [inspectedIds, setInspectedIds] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('housekeeping_inspected') || '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('housekeeping_inspected', JSON.stringify(inspectedIds)); } catch {} }, [inspectedIds]);

  const setStatus = useMutation({
    mutationFn: (p: { id: number; status: string }) => api.patch(`/hotel/rooms/${p.id}/status`, { status: mapUiToApi(p.status) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["hotel","rooms"] });
      // if UI action was 'inspected', track locally
      if (vars?.status === 'inspected') {
        setInspectedIds(prev => Array.from(new Set([...prev, vars.id])));
      } else {
        // if status changed away, remove from inspected
        setInspectedIds(prev => prev.filter(i => i !== vars.id));
      }
      toast({ title: "Statut mis à jour", description: "Le statut de la chambre a été mis à jour.", duration: 3000 });
    },
    onError: (err:any) => toast({ title: "Erreur", description: String(err), variant: "destructive" }),
  });

  const groups = useMemo(() => {
    const dirty = rooms.filter((r: any) => mapApiToUi(r.status) === 'dirty');
    const clean = rooms.filter((r: any) => mapApiToUi(r.status) === 'clean' && !inspectedIds.includes(r.id));
    // inspected: include rooms that are currently 'clean' and were marked inspected locally
    const inspected = rooms.filter((r: any) => mapApiToUi(r.status) === 'clean' && inspectedIds.includes(r.id));
    const out = rooms.filter((r: any) => mapApiToUi(r.status) === 'out-of-order');
    return { dirty, clean, inspected, out } as const;
  }, [rooms, inspectedIds]);

  const badge = (s: string) => {
    const styles: Record<string,string> = {
      dirty: "bg-warning/10 text-warning border-warning/20",
      clean: "bg-success/10 text-success border-success/20",
      inspected: "bg-primary/10 text-primary border-primary/20",
      out: "bg-muted text-muted-foreground border-muted",
    };
    const labels: Record<string,string> = { dirty: 'À nettoyer', clean: 'Propre', inspected: 'Inspectée', out: 'HS' };
    return <Badge variant="outline" className={styles[s]}>{labels[s]}</Badge>;
  };

  const canWrite = hasScope('rooms:write');

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Housekeeping</h1>
            <p className="text-muted-foreground">Suivi des chambres et statuts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Brush className="h-5 w-5"/> À nettoyer</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {groups.dirty.map((r: any) => (
                  <div key={r.id} className="p-2 border rounded-md flex items-center justify-between">
                    <div>Ch {r.number}</div>
                    <div className="flex gap-2">
                      {badge('dirty')}
                      <Button size="sm" variant="outline" disabled={!canWrite} onClick={()=>setStatus.mutate({ id: r.id, status: 'clean' })}>Marquer propre</Button>
                    </div>
                  </div>
                ))}
                {groups.dirty.length===0 && <div className="text-sm text-muted-foreground">Aucune</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/> Propres</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {groups.clean.map((r: any) => (
                  <div key={r.id} className="p-2 border rounded-md flex items-center justify-between">
                    <div>Ch {r.number}</div>
                    <div className="flex gap-2">
                      {badge('clean')}
                      <Button size="sm" variant="outline" disabled={!canWrite} onClick={()=>setStatus.mutate({ id: r.id, status: 'inspected' })}>Inspecter</Button>
                    </div>
                  </div>
                ))}
                {groups.clean.length===0 && <div className="text-sm text-muted-foreground">Aucune</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5"/> Inspectées</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {groups.inspected.map((r: any) => (
                  <div key={r.id} className="p-2 border rounded-md flex items-center justify-between">
                    <div>Ch {r.number}</div>
                    <div className="flex items-center gap-2">
                      {badge('inspected')}
                      <Button size="sm" variant="ghost" onClick={() => setInspectedIds(prev => prev.filter(i => i !== r.id))}>Annuler</Button>
                    </div>
                  </div>
                ))}
                {groups.inspected.length===0 && <div className="text-sm text-muted-foreground">Aucune</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5"/> Hors Service</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {groups.out.map((r: any) => (
                  <div key={r.id} className="p-2 border rounded-md flex items-center justify-between">
                    <div>Ch {r.number}</div>
                    {badge('out')}
                  </div>
                ))}
                {groups.out.length===0 && <div className="text-sm text-muted-foreground">Aucune</div>}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
