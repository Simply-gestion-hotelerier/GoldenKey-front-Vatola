import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export default function RoomInspection() {
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({ queryKey: ["hotel","rooms"], queryFn: () => api.get<any[]>("/hotel/rooms") });
  const [roomId, setRoomId] = useState<number | null>(null);
  const [cleanliness, setCleanliness] = useState<string>('Propre');
  const [damages, setDamages] = useState<string>('');

  useEffect(() => {
    if (rooms.length && roomId == null) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  const setStatus = useMutation({
    mutationFn: (id:number) => api.patch(`/hotel/rooms/${id}/status`, { status: 'available' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hotel","rooms"] }); toast({ title: 'Inspection', description: 'Chambre marquée inspectée.' }); },
    onError: (err:any) => toast({ title: 'Erreur inspection', description: String(err), variant: 'destructive' }),
  });

  const submit = () => {
    if (!roomId) return;
    setStatus.mutate(roomId);
    setDamages('');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Inspection de chambre</h1>
            <p className="text-muted-foreground">Saisie état, remarques, photos</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fiche d'inspection</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={roomId ? String(roomId) : undefined} onValueChange={(v)=>setRoomId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Chambre" /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r:any) => (
                    <SelectItem key={r.id} value={String(r.id)}>Ch {r.number} • {r.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input value={cleanliness} onChange={(e)=>setCleanliness(e.target.value)} placeholder="Propreté" />
              <div className="md:col-span-2">
                <Textarea value={damages} onChange={(e)=>setDamages(e.target.value)} placeholder="Dommages / remarques" />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={()=>setDamages('')}>Réinitialiser</Button>
                <Button onClick={submit}>Valider inspection</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
