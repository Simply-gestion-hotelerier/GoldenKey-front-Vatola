import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Utensils, Edit2, Trash2, PlusSquare, Search, Clock, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/rbac";

export default function BarPOS() {
  const { hasScope } = useAuth();
  const qc = useQueryClient();
  const [tableCode, setTableCode] = useState<string | null>(null);
  const [newTableCode, setNewTableCode] = useState("");
  const [editingTable, setEditingTable] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingItem, setAddingItem] = useState<number | null>(null);

  const queryOptions = {
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  };

  // Charger les tables
  const { data: tables = [] } = useQuery({
    queryKey: ["restaurant", "tables"],
    queryFn: () => api.get<any[]>("/restaurant/tables"),
    ...queryOptions
  });

  // Charger le menu pub
  const { data: menu = [], isLoading: menuLoading, error: menuError } = useQuery({
    queryKey: ["menu", "pub"],
    queryFn: async () => {
      try {
        const response = await api.get("/inventory/items?isMenu=true&dept=pub");
        return Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        console.error("Erreur chargement menu pub:", error);
        throw error;
      }
    },
    ...queryOptions
  });

  // Charger TOUTES les commandes pub
  const { data: allOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["orders", "pub"],
    queryFn: () => api.get<any[]>(`/restaurant/orders?dept=pub&status=open`),
    ...queryOptions
  });

  // Charger les tabs
  const { data: tabs = [] } = useQuery({
    queryKey: ["bar", "tabs"],
    queryFn: () => api.get<any[]>("/bar/tabs"),
    ...queryOptions
  });

  useEffect(() => {
    if (tables.length && !tableCode) {
      const firstPub = tables.find((t: any) => t.department === 'pub') || tables[0];
      setTableCode(firstPub?.code || null);
    }
  }, [tables]);

  // Filtrer les tables pub
  const pubTables = useMemo(() => {
    return tables.filter((t: any) => t.department === 'pub');
  }, [tables]);

  // Filtrer les commandes pour la table sélectionnée
  const tableOrders = useMemo(() => {
    if (!tableCode) return [];
    return allOrders.filter((order: any) => order.table?.code === tableCode);
  }, [allOrders, tableCode]);

  // Filtrer le menu
  const filteredMenu = useMemo(() => {
    if (!Array.isArray(menu)) return [];
    if (!searchTerm) return menu;

    const searchLower = searchTerm.toLowerCase();
    return menu.filter((item: any) =>
      item.name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower)
    );
  }, [menu, searchTerm]);

  // Fonction utilitaire pour vérifier si une table a des commandes actives
  const getTableOrders = (tableCode: string) => {
    return allOrders.filter((order: any) =>
      order.table?.code === tableCode && order.status === 'open'
    );
  };

  // Mutations
  const createTable = useMutation({
    mutationFn: (code: string) => api.post('/restaurant/tables', { code, department: 'pub' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
      setNewTableCode('');
      toast({ title: 'Table créée' });
    }
  });






  //creatiçon

  // Fonction pour créer ou récupérer un plat bar
  const getOrCreateBarDish = async (item: any): Promise<number> => {
    console.log('🟡 Recherche/Création plat bar pour:', item.name);

    try {
      // D'abord, essayez de trouver un plat existant avec le même nom
      const dishesResponse = await api.get('/dishes');
      const existingDish = dishesResponse.data.find((dish: any) =>
        dish.name.toLowerCase() === item.name.toLowerCase() && dish.category === 'beverage'
      );

      if (existingDish) {
        console.log('🟢 Plat bar existant trouvé:', existingDish.id);
        return existingDish.id;
      }

      // Si aucun plat existant, créez-en un nouveau
      console.log('🟡 Création nouveau plat bar...');
      const dishData = {
        name: item.name,
        description: `Article bar: ${item.name}`,
        category: 'beverage',
        preparationTime: 2, // Temps rapide pour le bar
        price: item.salePriceDefault,
        difficulty: 'easy',
        isActive: true,
        ingredients: []
      };

      const newDishResponse = await api.post('/dishes', dishData);
      const newDishId = newDishResponse.data.id;
      console.log('🟢 Nouveau plat bar créé:', newDishId);

      return newDishId;

    } catch (error) {
      console.error('🔴 Erreur création plat bar:', error);
      throw error;
    }
  };




  const editTable = useMutation({
    mutationFn: (p: { id: number; code: string }) => api.patch(`/restaurant/tables/${p.id}`, { code: p.code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
      setEditingTable(null);
      toast({ title: 'Table modifiée' });
    }
  });

  const removeTable = useMutation({
    mutationFn: (id: number) => api.del(`/restaurant/tables/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] });
      toast({ title: 'Table supprimée' });
    },
    onError: (e: any) => {
      const errorMessage = e.response?.data?.error || e.response?.data?.message || 'Erreur inconnue';
      if (e.response?.status === 400) {
        toast({
          title: 'Impossible de supprimer',
          description: errorMessage.includes('orders')
            ? 'Cette table a des commandes associées. Clôturez-les d\'abord.'
            : errorMessage,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Erreur suppression',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  });

  const createTab = useMutation({
    mutationFn: (name?: string) => api.post('/bar/tabs', { customerName: name || '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bar', 'tabs'] });
    }
  });

  const createOrder = useMutation({
    mutationFn: (p: { tableCode: string; tabId?: number }) =>
      api.post(`/restaurant/orders`, {
        dept: 'pub',  // Important: department = 'pub' mais endpoint restaurant
        tableCode: p.tableCode,
        tabId: p.tabId
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
      toast({ title: 'Commande bar créée', description: 'Nouvelle commande bar ouverte.' });
    },
    onError: (err: any) => {
      console.error('🔴 Erreur création commande bar:', err);
      toast({
        title: 'Erreur création',
        description: 'Impossible de créer la commande bar.',
        variant: 'destructive'
      });
    },
  });

  const addLine = useMutation({
    mutationFn: async (p: { orderId: number; itemId: number }) => {
      console.log('🟡 Appel endpoint RESTAURANT avec dishId:', p.itemId);

      const response = await api.post(`/restaurant/orders/${p.orderId}/lines`, {
        itemId: Number(p.itemId),  // Maintenant c'est un dishId valide
        qty: 1
      });

      return response;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "pub"] });
      toast({
        title: 'Article ajouté',
        description: 'L\'article a été ajouté à la commande bar'
      });
    },
    onError: (error: any) => {
      console.error('🔴 Erreur addLine:', error);

      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'Erreur lors de l\'ajout';

      toast({
        title: 'Erreur ajout',
        description: errorMessage,
        variant: 'destructive'
      });
    },
  });

  const deleteLine = useMutation({
    mutationFn: (p: { orderId: number; lineId: number }) => api.del(`/restaurant/orders/${p.orderId}/lines/${p.lineId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
      toast({ title: 'Ligne supprimée' });
    },
  });

  const closeOrder = useMutation({
    mutationFn: (orderId: number) => api.post(`/restaurant/orders/${orderId}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
      toast({ title: 'Commande clôturée' });
    },
    onError: (err: any) => toast({
      title: 'Erreur clôture',
      description: String(err),
      variant: 'destructive'
    }),
  });

  const payMut = useMutation({
    mutationFn: (p: { id: number; amount: number; method?: 'cash' | 'card' | 'mobile' | 'bank' }) => api.post(`/bar/tabs/${p.id}/pay`, { amount: p.amount, method: p.method || 'cash' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bar", "tabs"] });
      toast({ title: 'Encaissement', description: 'Paiement enregistré.' });
    },
    onError: (err: any) => toast({
      title: 'Erreur encaissement',
      description: String(err),
      variant: 'destructive'
    }),
  });

  const unpaidMut = useMutation({
    mutationFn: (id: number) => api.post(`/bar/tabs/${id}/mark-unpaid`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bar", "tabs"] });
      toast({ title: 'Marqué impayé', description: 'Le ticket a été marqué impayé.' });
    },
    onError: (err: any) => toast({
      title: 'Erreur',
      description: String(err),
      variant: 'destructive'
    }),
  });

  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mobile' | 'bank'>('cash');
  const payOrder = useMutation({
    mutationFn: (p: { orderId: number; amount: number; method: 'cash' | 'card' | 'mobile' | 'bank' }) => api.post('/cash/payments', { department: 'pub', method: p.method, amount: p.amount, orderId: p.orderId }),
    onSuccess: () => {
      toast({ title: 'Paiement enregistré' });
      setPayAmount(0);
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
    },
    onError: (e: any) => toast({
      title: 'Erreur paiement',
      description: String(e),
      variant: 'destructive'
    }),
  });

  const chargeToFolio = useMutation({
    mutationFn: (p: { orderId: number; folioId: number; close?: boolean }) => api.post(`/restaurant/orders/${p.orderId}/charge-to-folio`, { folioId: p.folioId, closeOrder: !!p.close }),
    onSuccess: () => {
      toast({ title: 'Imputé au folio' });
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
      setChargeOpen(false);
      setDetailsOpen(false);
    },
    onError: (e: any) => toast({
      title: 'Erreur imputation',
      description: String(e),
      variant: 'destructive'
    }),
  });

  // États pour les dialogs
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<any>(null);
  const [editQty, setEditQty] = useState<number>(1);

  // Fonction pour créer une commande si nécessaire
  const createOrderIfNeeded = async (tableCode: string): Promise<number> => {
    const existingOrder = allOrders.find((o: any) => o.table?.code === tableCode && o.status === 'open');
    if (existingOrder) return existingOrder.id;

    // Créer un tab automatiquement pour le pub
    const tab = await createTab.mutateAsync(tableCode);
    const tabId = (tab as any)?.id;

    const newOrder = await createOrder.mutateAsync({ tableCode, tabId });
    return (newOrder as any).id;
  };

  // Fonction pour ajouter un article
  const addItem = async (item: { id: number; name: string; salePriceDefault: number }) => {
    if (!hasScope('orders:write') || !tableCode || addingItem === item.id) {
      return;
    }

    const itemExists = menu.find((m: any) => m.id === item.id);
    if (!itemExists) {
      toast({
        title: 'Article non trouvé',
        description: `L'article "${item.name}" n'existe pas dans le menu`,
        variant: 'destructive'
      });
      return;
    }

    setAddingItem(item.id);

    try {
      console.log('🟡 Début ajout article bar:', item.name);

      // Créer ou récupérer la commande
      const orderId = await createOrderIfNeeded(tableCode);
      console.log('🟡 Order ID:', orderId);

      // Pour le bar, nous devons utiliser un plat (dish) plutôt qu'un item d'inventaire
      console.log('🟡 Conversion article bar en plat...');
      const dishId = await getOrCreateBarDish(item);
      console.log('🟡 Dish ID à utiliser:', dishId);

      // Utiliser l'endpoint restaurant avec le dishId
      console.log('🟡 Appel endpoint restaurant avec dishId...');
      await addLine.mutateAsync({
        orderId,
        itemId: dishId  // Maintenant c'est un dishId valide
      });

      console.log('🟢 Article bar ajouté avec succès via plat');

    } catch (error: any) {
      console.error('🔴 Erreur détaillée dans addItem:', error);

      toast({
        title: 'Erreur ajout article',
        description: error.response?.data?.message || 'Erreur technique lors de l\'ajout',
        variant: 'destructive'
      });
    } finally {
      setAddingItem(null);
    }
  };

  // Fonctions d'édition de ligne
  const openEditLine = (order: any, line: any) => {
    setEditingLine({ orderId: order.id, line });
    setEditQty(line.qty || 1);
  };

  const updateLine = useMutation({
    mutationFn: (p: { orderId: number; lineId: number; body: any }) => api.patch(`/restaurant/orders/${p.orderId}/lines/${p.lineId}`, p.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'pub'] });
      toast({ title: 'Ligne mise à jour' });
      setEditingLine(null);
    },
  });

  const saveEditLine = async () => {
    if (!editingLine) return;
    await updateLine.mutateAsync({
      orderId: editingLine.orderId,
      lineId: editingLine.line.id,
      body: { qty: editQty }
    });
  };

  // Récupérer les réservations pour l'imputation
  const today = new Date().toISOString().slice(0, 10);
  const { data: todaysReservations = [] } = useQuery({
    queryKey: ['hotel', 'reservations', today],
    queryFn: () => api.get<any[]>(`/hotel/reservations?date=${today}`),
    ...queryOptions
  });

  const checkedIn = (todaysReservations || []).filter((r: any) => r.status === 'checked_in' && r.folio);

  // Badge de statut
  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      open: "bg-warning/10 text-warning border-warning/20",
      closed: "bg-success/10 text-success border-success/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
    };
    const labels: Record<string, string> = {
      open: 'Active',
      closed: 'Fermée',
      cancelled: 'Annulée'
    };
    return <Badge variant="outline" className={styles[s] || styles.open}>
      {labels[s] || labels.open}
    </Badge>;
  };

  if (menuError) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-md">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="text-2xl font-bold text-destructive">Serveur indisponible</div>
                    <p className="text-muted-foreground">
                      Impossible de se connecter au serveur backend.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      Réessayer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Bar POS</h1>
            <p className="text-muted-foreground">Création de commandes • Gestion tables Pub</p>
          </div>

          {menuError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="text-destructive font-semibold">Connexion au serveur perdue</div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Certaines fonctionnalités peuvent ne pas être disponibles.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Carte Tables Pub */}
            <Card>
              <CardHeader>
                <CardTitle>Tables Pub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Code table (ex: B1)"
                    value={newTableCode}
                    onChange={(e) => setNewTableCode(e.target.value)}
                  />
                  <Button
                    onClick={() => newTableCode.trim() && createTable.mutate(newTableCode.trim())}
                    disabled={createTable.isPending}
                  >
                    <PlusSquare className="w-4 h-4 mr-2" />
                    {createTable.isPending ? "Création..." : "Créer"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {pubTables.map((t: any) => {
                    const code = t.code;
                    const active = tableCode === code;
                    const tableOrders = getTableOrders(code);
                    const hasActiveOrders = tableOrders.length > 0;

                    return (
                      <div key={t.id} className="flex items-center gap-2">
                        <Button
                          variant={active ? 'default' : 'outline'}
                          onClick={() => setTableCode(code)}
                          className="relative"
                        >
                          {code}
                          {hasActiveOrders && (
                            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                              {tableOrders.length}
                            </Badge>
                          )}
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingTable(t)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (hasActiveOrders) {
                              toast({
                                title: 'Commandes actives',
                                description: `La table ${code} a ${tableOrders.length} commande(s) ouverte(s). Clôturez-les d'abord.`,
                                variant: 'destructive'
                              });
                              return;
                            }

                            if (confirm(`Supprimer définitivement la table ${code} ?`)) {
                              removeTable.mutate(t.id);
                            }
                          }}
                          disabled={removeTable.isPending || hasActiveOrders}
                          title={hasActiveOrders ? `${tableOrders.length} commande(s) active(s)` : "Supprimer la table"}
                        >
                          {removeTable.isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : hasActiveOrders ? (
                            <Clock className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-600" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {editingTable && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={editingTable.code}
                      onChange={(e) => setEditingTable({ ...editingTable, code: e.target.value })}
                    />
                    <Button
                      onClick={() => editTable.mutate({ id: editingTable.id, code: editingTable.code })}
                      disabled={editTable.isPending}
                    >
                      {editTable.isPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingTable(null)}>
                      Annuler
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Carte Menu Pub */}
            <Card>
              <CardHeader>
                <CardTitle>Menu Pub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Rechercher un article..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>

                {menuLoading && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Chargement du menu...
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {filteredMenu.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-sm text-muted-foreground">
                      {searchTerm ? "Aucun article trouvé" : "Aucun article dans le menu"}
                    </div>
                  ) : (
                    filteredMenu.map((item: any) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto p-3 flex flex-col"
                        onClick={() => addItem({
                          id: item.id,
                          name: item.name,
                          salePriceDefault: item.salePriceDefault
                        })}
                        disabled={addingItem === item.id || !hasScope('orders:write') || !tableCode || menuError}
                      >
                        <Utensils className="h-5 w-5 mb-1" />
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat('fr-FR').format(item.salePriceDefault)} Ar
                        </span>
                        {addingItem === item.id && (
                          <div className="text-xs text-blue-600 mt-1">Ajout...</div>
                        )}
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Carte Commande */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" /> Commande
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetchOrders();
                    toast({ title: 'Rafraîchissement...' });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>


              <CardContent>
                {!tableCode ? (
                  <div className="text-sm text-muted-foreground">Sélectionnez une table</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">Commandes pour {tableCode}</div>

                    {/* MODIFICATION : Filtrer seulement les commandes avec status 'open' */}
                    {tableOrders
                      .filter((order: any) => order.status === 'open') // ← Ajoutez cette ligne
                      .length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
                        Aucune commande active
                      </div>
                    ) : (
                      tableOrders
                        .filter((order: any) => order.status === 'open') // ← Ajoutez cette ligne aussi
                        .map((order: any) => (
                          <div key={order.id} className="p-3 border rounded-md bg-white shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-semibold">Commande #{order.id}</div>
                              <Badge variant={
                                order.status === 'open' ? 'default' :
                                  order.status === 'closed' ? 'secondary' : 'destructive'
                              }>
                                {order.status === 'open' ? 'Active' :
                                  order.status === 'closed' ? 'Fermée' : 'Annulée'}
                              </Badge>
                            </div>

                            <div className="mb-3">
                              {order.lines?.length > 0 ? (
                                <div className="space-y-1">
                                  {order.lines.map((line: any, index: number) => (
                                    <div key={line.id || index} className="flex justify-between text-sm">
                                      <span
                                        className="cursor-pointer hover:text-blue-600 transition-colors"
                                        onClick={() => openEditLine && openEditLine(order, line)}
                                      >
                                        {line.itemName || line.name} ×{line.qty || line.quantity}
                                      </span>
                                      <span className="font-medium">
                                        {new Intl.NumberFormat('fr-FR').format(
                                          (line.unitPrice || line.price || 0) * (line.qty || line.quantity || 0)
                                        )} Ar
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground italic">
                                  Aucun article
                                </div>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t">
                              <div className="text-sm font-semibold">
                                Total: {new Intl.NumberFormat('fr-FR').format(
                                  order.lines?.reduce((total: number, line: any) =>
                                    total + (line.unitPrice || line.price || 0) * (line.qty || line.quantity || 0), 0
                                  ) || 0
                                )} Ar
                              </div>
                              <div className="flex gap-2">
                                {order.status === 'open' && closeOrder && (
                                  <Button
                                    size="sm"
                                    onClick={() => closeOrder.mutate(order.id)}
                                    disabled={closeOrder.isPending}
                                  >
                                    {closeOrder.isPending ? "..." : "Clôturer"}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setDetailsOpen(true);
                                  }}
                                >
                                  Détails
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                    )}

                    {/* Section Tickets/Comptes */}
                    {(() => {
                      // Rechercher le tab correspondant à la table
                      const tab = tabs.find((t: any) =>
                        (t.customerName || t.customer_name) === tableCode &&
                        t.status !== 'paid'
                      );

                      if (!tab) return null;

                      return (
                        <div className="mt-4 p-3 border rounded-md bg-blue-50">
                          {/* Contenu du ticket */}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Dialog Détails Commande */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Détails de la commande {selectedOrder ? `#${selectedOrder.id}` : ''}</DialogTitle>
            <DialogDescription>
              Table {selectedOrder?.table?.code || '—'} • Statut: {selectedOrder?.status || '—'}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-4 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-2">Article</div>
                  <div className="text-right">Qté</div>
                  <div className="text-right">Sous-total</div>
                </div>
                <div className="divide-y">
                  {selectedOrder.lines?.map((l: any) => (
                    <div key={l.id} className="grid grid-cols-4 px-3 py-2 text-sm">
                      <div className="col-span-2 truncate">{l.itemName}</div>
                      <div className="text-right">{l.qty}</div>
                      <div className="text-right">{new Intl.NumberFormat('fr-FR').format((l.unitPrice || 0) * l.qty)} Ar</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">
                  {new Intl.NumberFormat('fr-FR').format(selectedOrder.lines?.reduce((s: any, l: any) => s + (l.unitPrice || 0) * l.qty, 0) || 0)} Ar
                </div>
              </div>

              {selectedOrder.status === 'open' && (
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    min={0}
                    type="number"
                    placeholder="Montant"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                  />
                  <Select value={payMethod} onValueChange={(v) => setPayMethod(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Méthode" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Espèces</SelectItem>
                      <SelectItem value="card">Carte</SelectItem>
                      <SelectItem value="mobile">Mobile Money</SelectItem>
                      <SelectItem value="bank">Virement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => payAmount > 0 && payOrder.mutate({ orderId: selectedOrder.id, amount: payAmount, method: payMethod })}
                    disabled={payOrder.isPending || payAmount <= 0}
                  >
                    {payOrder.isPending ? "Encaissement..." : "Encaisser"}
                  </Button>
                </div>
              )}

              {selectedOrder.status === 'open' && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setChargeOpen(true)}>Imputer au folio chambre</Button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {selectedOrder.status === 'open' && (
                  <Button
                    onClick={() => { closeOrder.mutate(selectedOrder.id); }}
                    disabled={closeOrder.isPending}
                  >
                    {closeOrder.isPending ? "Clôture..." : "Clôturer la commande"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Imputation Folio */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Imputer la commande au folio</DialogTitle>
            <DialogDescription>Sélectionnez la réservation (client en chambre)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select onValueChange={(v) => setSelectedOrder(sel => sel ? { ...sel, targetFolioId: Number(v) } : sel)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une réservation" /></SelectTrigger>
              <SelectContent>
                {checkedIn.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.folio.id)}>{r.guest.fullName} • Ch {r.room.number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setChargeOpen(false)}>Annuler</Button>
              <Button
                onClick={() => {
                  if (selectedOrder && (selectedOrder as any).targetFolioId)
                    chargeToFolio.mutate({
                      orderId: selectedOrder.id,
                      folioId: (selectedOrder as any).targetFolioId,
                      close: true
                    });
                }}
                disabled={chargeToFolio.isPending || !selectedOrder || !(selectedOrder as any).targetFolioId}
              >
                {chargeToFolio.isPending ? "Imputation..." : "Imputer & Clôturer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Édition Ligne */}
      <Dialog open={!!editingLine} onOpenChange={(open) => { if (!open) setEditingLine(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Modifier ligne</DialogTitle></DialogHeader>
          {editingLine && (
            <div className="space-y-3">
              <div className="text-sm font-medium">{editingLine.line?.itemName}</div>
              <div className="text-xs text-muted-foreground">Prix unitaire: {new Intl.NumberFormat('fr-FR').format(editingLine.line?.unitPrice || 0)} Ar</div>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingLine(null)}>Annuler</Button>
                <Button onClick={saveEditLine} disabled={updateLine.isPending}>
                  {updateLine.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}