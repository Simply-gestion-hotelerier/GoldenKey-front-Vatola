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
import { useTranslation } from "react-i18next";

export default function RoomInspection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({ 
    queryKey: ["hotel","rooms"], 
    queryFn: () => api.get<any[]>("/hotel/rooms") 
  });
  const [roomId, setRoomId] = useState<number | null>(null);
  const [cleanliness, setCleanliness] = useState<string>(t('roomInspection.clean'));
  const [damages, setDamages] = useState<string>('');

  useEffect(() => {
    if (rooms.length && roomId == null) setRoomId(rooms[0].id);
  }, [rooms, roomId]);

  const setStatus = useMutation({
    mutationFn: (id:number) => api.patch(`/hotel/rooms/${id}/status`, { status: 'available' }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["hotel","rooms"] }); 
      toast({ 
        title: t('roomInspection.inspection'), 
        description: t('roomInspection.inspectionSuccess') 
      }); 
    },
    onError: (err:any) => toast({ 
      title: t('roomInspection.inspectionError'), 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const submit = () => {
    if (!roomId) return;
    setStatus.mutate(roomId);
    setDamages('');
    setCleanliness(t('roomInspection.clean'));
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{t('roomInspection.title')}</h1>
            <p className="text-muted-foreground">{t('roomInspection.subtitle')}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('roomInspection.inspectionSheet')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={roomId ? String(roomId) : undefined} onValueChange={(v)=>setRoomId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('hotel.room')} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r:any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {t('hotel.room')} {r.number} • {r.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input 
                value={cleanliness} 
                onChange={(e)=>setCleanliness(e.target.value)} 
                placeholder={t('roomInspection.cleanliness')} 
              />
              
              <div className="md:col-span-2">
                <Textarea 
                  value={damages} 
                  onChange={(e)=>setDamages(e.target.value)} 
                  placeholder={t('roomInspection.damagesPlaceholder')} 
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={()=>{
                  setDamages('');
                  setCleanliness(t('roomInspection.clean'));
                }}>
                  {t('common.reset')}
                </Button>
                <Button onClick={submit}>
                  {t('roomInspection.validateInspection')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}