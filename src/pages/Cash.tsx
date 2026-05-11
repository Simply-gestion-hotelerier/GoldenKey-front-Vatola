// src/pages/cash/Cash.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/rbac";
import { api } from "@/lib/api";
import { DollarSign, Plus, Calendar, User } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";

export default function Cash() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dept, setDept] = useState<'hotel' | 'restaurant' | 'pub' | 'spa'>('restaurant');
  const [opening, setOpening] = useState<number>(50000);
  const [closing, setClosing] = useState<number>(0);
  const [transactionAmount, setTransactionAmount] = useState<string>("");
  const [transactionDescription, setTransactionDescription] = useState<string>("");
  const [transactionType, setTransactionType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

  const { data: sessions = [] } = useQuery({
    queryKey: ["cash", "sessions", dept],
    queryFn: () => api.get(`/cash/sessions?dept=${dept}`),
    refetchInterval: 10000,
  });

  const perDept = useMemo(() => sessions, [sessions]);
  const open = perDept.find((c: any) => c.status === 'open');

  const transactionMut = useMutation({
    mutationFn: (transactionData: {
      userId: number;
      department: string;
      prix: number;
      description: string;
      type: 'DEBIT' | 'CREDIT';
    }) => api.post('/transactions', transactionData),
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('common.success')
      });
      setTransactionAmount("");
      setTransactionDescription("");
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err.response?.data?.error || t('errors.generic'),
        variant: 'destructive'
      });
    },
  });

  const openMut = useMutation({
    mutationFn: () => api.post(`/cash/sessions/open`, { department: dept, openingFloat: opening, openedBy: user?.username || user?.email }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["cash", "sessions", dept] }); 
      toast({ 
        title: t('common.success'), 
        description: t('common.success')
      }); 
    },
    onError: (err: any) => toast({ 
      title: t('common.error'), 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const closeMut = useMutation({
    mutationFn: () => open ? api.post(`/cash/sessions/${open.id}/close`, { closingAmount: closing }) : Promise.resolve(null),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["cash", "sessions", dept] }); 
      toast({ 
        title: t('common.success'), 
        description: t('common.success')
      }); 
    },
    onError: (err: any) => toast({ 
      title: t('common.error'), 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const handleTransaction = () => {
    if (!transactionAmount || !transactionDescription) {
      toast({
        title: t('common.error'),
        description: t('common.required'),
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t('common.error'),
        description: t('common.unauthorized'),
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: t('common.error'),
        description: t('common.invalidAmount'),
        variant: 'destructive'
      });
      return;
    }

    transactionMut.mutate({
      userId: user.id,
      department: dept,
      prix: amount,
      description: transactionDescription,
      type: transactionType
    });
  };

  const getDeptLabel = (dept: string) => {
    const labels: Record<string, string> = {
      hotel: t('nav.hotel'),
      restaurant: t('nav.restaurant'),
      pub: 'Pub',
      spa: t('nav.spa')
    };
    return labels[dept as keyof typeof labels] || dept;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{t('nav.cash')}</h1>
            <p className="text-muted-foreground">
              {t('common.status')} • {getDeptLabel(dept)}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('common.department')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(['hotel', 'restaurant', 'spa'] as const).map(d => (
                  <Button 
                    key={d} 
                    variant={dept === d ? 'default' : 'outline'} 
                    onClick={() => setDept(d)}
                    className="capitalize"
                  >
                    {getDeptLabel(d)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> 
                  {t('common.actions')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!open ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="opening-float">{t('common.amount')} (Ar)</Label>
                      <Input 
                        id="opening-float"
                        min={0} 
                        type="number" 
                        value={opening || ''} 
                        onChange={(e) => setOpening(Number(e.target.value))} 
                        placeholder="50000" 
                      />
                    </div>
                    <Button 
                      onClick={() => openMut.mutate()} 
                      disabled={openMut.isPending}
                      className="w-full"
                    >
                      {openMut.isPending ? t('common.loading') : t('common.open')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="closing-amount">{t('common.amount')} (Ar)</Label>
                      <Input 
                        id="closing-amount"
                        min={0} 
                        type="number" 
                        value={closing || ''} 
                        onChange={(e) => setClosing(Number(e.target.value))} 
                        placeholder="0" 
                      />
                    </div>
                    <Button 
                      onClick={() => closeMut.mutate()} 
                      disabled={closeMut.isPending}
                      variant="destructive"
                      className="w-full"
                    >
                      {closeMut.isPending ? t('common.loading') : t('common.close')}
                    </Button>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t('common.status')}:</span>
                    <Badge variant={open ? "default" : "secondary"}>
                      {open ? t('common.open') : t('common.closed')}
                    </Badge>
                  </div>
                  {open && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {t('common.user')}: {open.openedBy || open.opened_by} • 
                      {new Date(open.openedAt || open.opened_at).toLocaleString('fr-FR')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('common.history')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {perDept.slice().reverse().map((c: any) => (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={c.status === 'open' ? "default" : "outline"}>
                          {c.status === 'open' ? t('common.open') : t('common.closed')}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {c.openedBy || c.opened_by}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{t('common.open')}: {new Date(c.openedAt || c.opened_at).toLocaleString('fr-FR')}</div>
                        {(c.closedAt || c.closed_at) && (
                          <div>{t('common.close')}: {new Date(c.closedAt || c.closed_at).toLocaleString('fr-FR')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {perDept.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>{t('common.noData')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}