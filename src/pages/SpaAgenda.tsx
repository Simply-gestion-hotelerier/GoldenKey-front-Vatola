import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/rbac";
import { api } from "@/lib/api";
import { CalendarDays, Clock, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function SpaAgenda() {
  const { hasScope } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const date = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const startOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0);
  const endOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 0, 0, 0);
  const { data: appointments = [] } = useQuery({ queryKey: ["spa","appointments", date], queryFn: ()=> api.get<any[]>(`/spa/appointments?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`), refetchInterval: 10000 });

  const todays = useMemo(() => {
    return appointments.slice().sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [appointments]);

  const badge = (s: string) => {
    const styles: Record<string, string> = {
      booked: "bg-warning/10 text-warning border-warning/20",
      in_progress: "bg-primary/10 text-primary border-primary/20",
      completed: "bg-success/10 text-success border-success/20",
      waiting: "bg-primary/10 text-primary border-primary/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
      no_show: "bg-destructive/10 text-destructive border-destructive/20",
    };
    const labels: Record<string, string> = {
      booked: "Réservé",
      in_progress: "En cours",
      waiting: "En attente",
      completed: "Terminé",
      no_show: "No-show",
      cancelled: "Annulé",
    };
    return (
      <Badge variant="outline" className={styles[s] || styles.booked}>{labels[s] || s}</Badge>
    );
  };

  const setStatus = useMutation({
    mutationFn: (p: { id:number; status:string }) => api.patch(`/spa/appointments/${p.id}/status`, { status: p.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa","appointments"] }); toast({ title: 'Statut mis à jour', description: 'Le rendez-vous a été mis à jour.' }); },
    onError: (err:any) => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }),
  });

  const canWrite = hasScope("spa:write");

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Spa & Onglerie • Agenda</h1>
            <p className="text-muted-foreground">Vue du jour • Gestion des statuts</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Rendez-vous du jour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todays.map((a: any) => (
                    <div key={a.id} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{formatTime(a.start)} – {formatTime(new Date(new Date(a.start).getTime() + (a.durationMin||0)*60000).toISOString())} • {a.clientName || a.guest}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Sparkles className="h-3 w-3" /> {(a.serviceName || a.service_name)} • {new Intl.NumberFormat('fr-FR').format(a.price)} MGA
                          </div>
                        </div>
                        {badge(a.status)}
                      </div>
                      <div className="mt-2 flex gap-2">
                        {a.status === 'booked' && (
                          <>
                            <Button size="sm" disabled={!canWrite} onClick={() => setStatus.mutate({ id: a.id, status: 'in_progress' })}>Démarrer</Button>
                            <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => setStatus.mutate({ id: a.id, status: 'no_show' })}>No-show</Button>
                            <Button size="sm" variant="ghost" disabled={!canWrite} onClick={() => setStatus.mutate({ id: a.id, status: 'cancelled' })}>Annuler</Button>
                          </>
                        )}
                        {a.status === 'in_progress' && (
                          <Button size="sm" disabled={!canWrite} onClick={() => setStatus.mutate({ id: a.id, status: 'completed' })}>Terminer</Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {todays.length === 0 && <div className="text-sm text-muted-foreground">Aucun rendez-vous aujourd'hui</div>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Résumé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>Réservés: {todays.filter((t: any) => t.status === 'booked').length}</div>
                  <div>En cours: {todays.filter((t: any) => t.status === 'in_progress').length}</div>
                  <div>Terminés: {todays.filter((t: any) => t.status === 'completed').length}</div>
                  <div>No-show: {todays.filter((t: any) => t.status === 'no_show').length}</div>
                  <div>Annulés: {todays.filter((t: any) => t.status === 'cancelled').length}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
