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

export default function Cash() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dept, setDept] = useState<'hotel' | 'restaurant' | 'pub' | 'spa'>('restaurant');
  const [opening, setOpening] = useState<number>(50000);
  const [closing, setClosing] = useState<number>(0);
  const [transactionAmount, setTransactionAmount] = useState<string>("");
  const [transactionDescription, setTransactionDescription] = useState<string>("");
  const [transactionType, setTransactionType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

  const { data: sessions = [] } = useQuery({
    queryKey: ["cash", "sessions", dept],
    queryFn: () => api.get(`/cash/sessions?dept=${dept}`), // Pas de /api ici
    refetchInterval: 10000,
  });

  const perDept = useMemo(() => sessions, [sessions]);
  const open = perDept.find((c: any) => c.status === 'open');

  // Mutation pour créer une transaction - URL CORRIGÉE
  const transactionMut = useMutation({
    mutationFn: (transactionData: {
      userId: number;
      department: string;
      prix: number;
      description: string;
      type: 'DEBIT' | 'CREDIT';
    }) => api.post('/transactions', transactionData), // ⬅️ CORRIGÉ: /transactions au lieu de /api/transactions
    onSuccess: () => {
      toast({
        title: 'Transaction créée',
        description: 'La transaction a été enregistrée avec succès'
      });
      setTransactionAmount("");
      setTransactionDescription("");
    },
    onError: (err: any) => {
      toast({
        title: 'Erreur transaction',
        description: err.response?.data?.error || 'Erreur lors de la création',
        variant: 'destructive'
      });
    },
  });

  const openMut = useMutation({
    mutationFn: () => api.post(`/cash/sessions/open`, { department: dept, openingFloat: opening, openedBy: user.username }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["cash", "sessions", dept] }); 
      toast({ 
        title: 'Session ouverte', 
        description: 'La session de caisse est ouverte.' 
      }); 
    },
    onError: (err: any) => toast({ 
      title: 'Erreur ouverture', 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const closeMut = useMutation({
    mutationFn: () => open ? api.post(`/cash/sessions/${open.id}/close`, { closingAmount: closing }) : Promise.resolve(null),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["cash", "sessions", dept] }); 
      toast({ 
        title: 'Session clôturée', 
        description: 'La session a été clôturée.' 
      }); 
    },
    onError: (err: any) => toast({ 
      title: 'Erreur clôture', 
      description: String(err), 
      variant: 'destructive' 
    }),
  });

  const handleTransaction = () => {
    if (!transactionAmount || !transactionDescription) {
      toast({
        title: 'Champs manquants',
        description: 'Veuillez remplir tous les champs',
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Erreur utilisateur',
        description: 'Utilisateur non connecté',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Le montant doit être un nombre positif',
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
    const labels = {
      hotel: 'Hôtel',
      restaurant: 'Restaurant',
      pub: 'Pub',
      spa: 'Spa'
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
            <h1 className="text-3xl font-bold tracking-tight">Caisse & Clôture</h1>
            <p className="text-muted-foreground">
              Sessions de caisse par département • {getDeptLabel(dept)}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Département</CardTitle>
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
                  Actions de Caisse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!open ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="opening-float">Fond de caisse (Ar)</Label>
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
                      {openMut.isPending ? "Ouverture..." : "Ouvrir la Session"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="closing-amount">Montant de clôture (Ar)</Label>
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
                      {closeMut.isPending ? "Clôture..." : "Clôturer la Session"}
                    </Button>
                  </div>
                )}
                
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Statut:</span>
                    <Badge variant={open ? "default" : "secondary"}>
                      {open ? "Session Ouverte" : "Session Fermée"}
                    </Badge>
                  </div>
                  {open && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Ouverte par {open.openedBy || open.opened_by} • 
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
                  Historique des Sessions
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
                          {c.status === 'open' ? 'Ouverte' : 'Fermée'}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {c.openedBy || c.opened_by}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Ouvert: {new Date(c.openedAt || c.opened_at).toLocaleString('fr-FR')}</div>
                        {(c.closedAt || c.closed_at) && (
                          <div>Fermé: {new Date(c.closedAt || c.closed_at).toLocaleString('fr-FR')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {perDept.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucune session enregistrée</p>
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