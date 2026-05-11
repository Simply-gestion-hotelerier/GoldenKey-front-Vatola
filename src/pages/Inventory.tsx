// src/pages/inventory/Inventory.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Package, TrendingDown, TrendingUp, Plus, Search, AlertTriangle, Edit2, Trash2, Upload, List, BarChart3, Download, ChevronDown, FileText, Table, FileCode, File, FileSpreadsheet, X } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

const itemFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  sku: z.string().min(1, "Le SKU est requis"),
  unit: z.enum(["piece", "kg", "g", "L", "cl", "ml"]),
  cost_price: z.number().min(0, "Le prix doit être positif"),
  sale_price_default: z.number().min(0, "Le prix de vente doit être positif"),
  vat_rate: z.number().min(0).max(100, "La TVA doit être entre 0 et 100%"),
  is_active: z.boolean().default(true),
});

const stockFormSchema = z.object({
  item_id: z.number().min(1, "L'article est requis"),
  store_id: z.number().min(1, "Le magasin est requis"),
  qty_on_hand: z.number().min(0, "La quantité doit être positive"),
  min_level: z.number().min(0, "Le seuil minimum doit être positif"),
  max_level: z.number().min(1, "Le seuil maximum doit être au moins 1"),
});

export default function Inventory() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stores = [] } = useQuery({
    queryKey: ["inventory", "stores"],
    queryFn: () => api.get<any[]>("/inventory/stores")
  });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory", "items"],
    queryFn: () => api.get<any[]>("/inventory/items")
  });

  const { data: stocks = [] } = useQuery({
    queryKey: ["inventory", "stocks"],
    queryFn: () => api.get<any[]>("/inventory/stocks")
  });

  const { data: stock_movements = [], error: movementsError } = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: () => api.get<any[]>("/inventory/movements?limit=200"),
    retry: 1,
  });

  const sortedStores = useMemo(() => {
    return [...stores].sort((a: any, b: any) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();

      if (nameA === "restaurant" && nameB !== "restaurant") return -1;
      if (nameB === "restaurant" && nameA !== "restaurant") return 1;

      return nameA.localeCompare(nameB);
    });
  }, [stores]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [items]);

  const sortedAvailableItems = useMemo(() => {
    const presentIds = new Set((stocks || []).map((s: any) => s.itemId || s.item?.id));
    const available = (items || []).filter((it: any) => !presentIds.has(it.id));
    return [...available].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [items, stocks]);

  const [exportInventoryOpen, setExportInventoryOpen] = useState(false);
  const [exportInventoryLoading, setExportInventoryLoading] = useState(false);

  const exportOptions = [
    {
      format: 'excel',
      label: t('export.excel'),
      extension: '.xlsx',
      icon: FileSpreadsheet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverColor: 'hover:bg-green-100',
      description: t('export.excelDescription')
    },
    {
      format: 'csv',
      label: t('export.csv'),
      extension: '.csv',
      icon: Table,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      description: t('export.csvDescription')
    },
    {
      format: 'txt',
      label: t('export.txt'),
      extension: '.txt',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100',
      description: t('export.txtDescription')
    },
    {
      format: 'json',
      label: t('export.json'),
      extension: '.json',
      icon: FileCode,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      hoverColor: 'hover:bg-orange-100',
      description: t('export.jsonDescription')
    }
  ];

  useEffect(() => {
    if (movementsError) {
      console.error("Error loading movements:", movementsError);
    }
  }, [movementsError]);

  const [storeId, setStoreId] = useState<number | "">("");
  const [selectedItem, setSelectedItem] = useState<number | "">("");
  const [qty, setQty] = useState<number>(0);
  const [type, setType] = useState<"IN" | "OUT" | "ADJUST">("IN");
  const [searchTerm, setSearchTerm] = useState("");
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [editStockDialog, setEditStockDialog] = useState(false);
  const [importing, setImporting] = useState(false);

  const itemForm = useForm<z.infer<typeof itemFormSchema>>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      sku: "",
      unit: "piece",
      cost_price: 0,
      sale_price_default: 0,
      vat_rate: 20,
      is_active: true
    }
  });

  const stockForm = useForm<z.infer<typeof stockFormSchema>>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      item_id: 0,
      store_id: 0,
      qty_on_hand: 0,
      min_level: 0,
      max_level: 100
    }
  });

  const combinedEditFormSchema = z.object({
    qty_on_hand: z.number().min(0, "La quantité doit être positive"),
    min_level: z.number().min(0, "Le seuil minimum doit être positif"),
    max_level: z.number().min(1, "Le seuil maximum doit être au moins 1"),
    name: z.string().min(1, "Le nom est requis"),
    cost_price: z.number().min(0, "Le prix doit être positif"),
    sale_price_default: z.number().min(0, "Le prix de vente doit être positif"),
    vat_rate: z.number().min(0).max(100, "La TVA doit être entre 0 et 100%"),
    is_active: z.boolean().default(true),
    sku: z.string().optional(),
    unit: z.enum(["piece", "kg", "g", "L", "cl", "ml"]).optional(),
  });

  const combinedEditForm = useForm<z.infer<typeof combinedEditFormSchema>>({
    resolver: zodResolver(combinedEditFormSchema),
    defaultValues: {
      qty_on_hand: 0,
      min_level: 0,
      max_level: 100,
      name: "",
      cost_price: 0,
      sale_price_default: 0,
      vat_rate: 20,
      is_active: true,
    }
  });

  const stocksByStore = useMemo(() => {
    const s = (stocks || []).filter((st: any) => (st.storeId || st.store?.id || st.store_id) === storeId);
    if (!searchTerm) return s;
    const searchLower = searchTerm.toLowerCase();
    return s.filter((st: any) => {
      const it = st.item || st.Item || {};
      return (it.name || "").toLowerCase().includes(searchLower) ||
        (it.sku || "").toLowerCase().includes(searchLower);
    });
  }, [stocks, storeId, searchTerm]);

  const sortedStocksByStore = useMemo(() => {
    return [...stocksByStore].sort((a: any, b: any) => {
      const nameA = a.item?.name || a.Item?.name || "";
      const nameB = b.item?.name || b.Item?.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [stocksByStore]);

  const lowLevel = useMemo(() =>
    sortedStocksByStore.filter((s: any) => (s.qty || s.qty_on_hand || 0) <= (s.minQty || s.min_level || 0)),
    [sortedStocksByStore]
  );

  const outOfStock = useMemo(() =>
    sortedStocksByStore.filter((s: any) => (s.qty || s.qty_on_hand || 0) === 0),
    [sortedStocksByStore]
  );

  const totalValue = useMemo(() =>
    sortedStocksByStore.reduce((sum: number, s: any) => {
      const item = s.item || (items || []).find((i: any) => i.id === s.itemId) || {};
      return sum + ((s.qty || s.qty_on_hand || 0) * (item.costPrice || 0));
    }, 0),
    [sortedStocksByStore, items]
  );

  const prepareExportData = () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const magasinActuel = sortedStores.find((s: any) => s.id === storeId);

    const donneesStocks = sortedStocksByStore.map((stock: any) => {
      const item = stock.item || stock.Item || {};
      return {
        numero: stock.id,
        nomArticle: item.name || 'N/A',
        sku: item.sku || 'N/A',
        unite: item.unit || 'piece',
        quantite: stock.qty || stock.qty_on_hand || 0,
        seuilMinimum: stock.minQty || stock.min_level || 0,
        seuilMaximum: stock.maxQty || stock.max_level || 100,
        prixCout: item.costPrice || 0,
        prixVente: item.salePriceDefault || 0,
        statutStock: (stock.qty || stock.qty_on_hand || 0) === 0 ? 'RUPTURE' :
          (stock.qty || stock.qty_on_hand || 0) <= (stock.minQty || stock.min_level || 0) ? 'SEUIL_BAS' : 'OK',
        pourcentageRemplissage: Math.round(((stock.qty || stock.qty_on_hand || 0) / ((stock.maxQty || stock.max_level) || 100)) * 100)
      };
    });

    const statistiques = {
      magasin: magasinActuel?.name || t('inventory.allStores'),
      totalArticles: sortedStocksByStore.length,
      articlesSeuilBas: lowLevel.length,
      articlesRupture: outOfStock.length,
      unitesTotales: sortedStocksByStore.reduce((sum: any, s: any) => sum + ((s.qty || s.qty_on_hand) || 0), 0),
      valeurStockTotal: sortedStocksByStore.reduce((sum: any, s: any) => {
        const item = s.item || s.Item || {};
        return sum + ((s.qty || s.qty_on_hand) || 0) * (item.costPrice || 0);
      }, 0),
      dateExport: new Date().toLocaleString('fr-FR')
    };

    return {
      metadata: {
        hotelName: "Simply Hotel - " + t('inventory.title'),
        exportDate: new Date().toLocaleString('fr-FR'),
        periode: aujourdhui,
        totalStocks: sortedStocksByStore.length
      },
      statistiques,
      stocks: donneesStocks
    };
  };

  const exportToCSV = (data: any) => {
    let csvContent = "\uFEFF";
    csvContent += `${t('inventory.exportReport')}\n`;
    csvContent += `${t('common.date')}: ${data.metadata.periode}\n`;
    csvContent += `${t('export.title')}: ${data.metadata.exportDate}\n`;
    csvContent += `${t('inventory.totalStocks')}: ${data.metadata.totalStocks}\n\n`;

    csvContent += `${t('inventory.statisticsSummary')}\n`;
    csvContent += `${t('inventory.store')},${data.statistiques.magasin}\n`;
    csvContent += `${t('inventory.totalItems')},${data.statistiques.totalArticles}\n`;
    csvContent += `${t('inventory.lowStock')},${data.statistiques.articlesSeuilBas}\n`;
    csvContent += `${t('inventory.outOfStock')},${data.statistiques.articlesRupture}\n`;
    csvContent += `${t('inventory.totalUnits')},${data.statistiques.unitesTotales}\n`;
    csvContent += `${t('inventory.totalValue')},${new Intl.NumberFormat('fr-FR').format(data.statistiques.valeurStockTotal)} Ar\n\n`;

    csvContent += `${t('inventory.stockDetails')}\n`;
    csvContent += `${t('inventory.number')},${t('inventory.itemName')},${t('inventory.sku')},${t('inventory.unit')},${t('inventory.quantity')},${t('inventory.minThreshold')},${t('inventory.maxThreshold')},${t('inventory.costPrice')},${t('inventory.salePrice')},${t('inventory.status')},${t('inventory.fillRate')}\n`;

    data.stocks.forEach((stock: any) => {
      csvContent += `${stock.numero},${stock.nomArticle},${stock.sku},${stock.unite},${stock.quantite},${stock.seuilMinimum},${stock.seuilMaximum},${stock.prixCout},${stock.prixVente},${stock.statutStock},${stock.pourcentageRemplissage}%\n`;
    });

    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `inventory-${data.metadata.periode}.csv`);
  };

  const exportToExcel = (data: any) => {
    const workbook = XLSX.utils.book_new();

    const syntheseData = [
      [t('inventory.exportReport'), ""],
      [t('common.date'), data.metadata.periode],
      [t('export.title'), data.metadata.exportDate],
      [t('inventory.totalStocks'), data.metadata.totalStocks],
      ["", ""],
      [t('inventory.statisticsSummary'), ""],
      [t('inventory.store'), data.statistiques.magasin],
      [t('inventory.totalItems'), data.statistiques.totalArticles],
      [t('inventory.lowStock'), data.statistiques.articlesSeuilBas],
      [t('inventory.outOfStock'), data.statistiques.articlesRupture],
      [t('inventory.totalUnits'), data.statistiques.unitesTotales],
      [t('inventory.totalValue'), data.statistiques.valeurStockTotal],
      ["", ""],
      [t('inventory.performance'), ""],
      [t('inventory.outOfStockRate'), `${data.statistiques.totalArticles > 0 ? Math.round((data.statistiques.articlesRupture / data.statistiques.totalArticles) * 100) : 0}%`],
      [t('inventory.lowStockRate'), `${data.statistiques.totalArticles > 0 ? Math.round((data.statistiques.articlesSeuilBas / data.statistiques.totalArticles) * 100) : 0}%`]
    ];

    const syntheseWorksheet = XLSX.utils.aoa_to_sheet(syntheseData);
    syntheseWorksheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, syntheseWorksheet, t('inventory.summary'));

    const detailsHeaders = [t('inventory.number'), t('inventory.itemName'), t('inventory.sku'), t('inventory.unit'), t('inventory.quantity'), t('inventory.minThreshold'), t('inventory.maxThreshold'), t('inventory.costPriceAr'), t('inventory.salePriceAr'), t('inventory.status'), t('inventory.fillRate')];
    const detailsData = data.stocks.map((stock: any) => [stock.numero, stock.nomArticle, stock.sku, stock.unite, stock.quantite, stock.seuilMinimum, stock.seuilMaximum, stock.prixCout, stock.prixVente, stock.statutStock, `${stock.pourcentageRemplissage}%`]);
    const detailsWorksheet = XLSX.utils.aoa_to_sheet([detailsHeaders, ...detailsData]);
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, t('inventory.stockDetails'));

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `inventory-${data.metadata.periode}.xlsx`);
  };

  const exportToTXT = (data: any) => {
    const textContent = `
${t('inventory.exportReport')}
${"=".repeat(50)}

${t('inventory.generalInfo')}
${t('inventory.hotel')}: ${data.metadata.hotelName}
${t('common.date')}: ${data.metadata.periode}
${t('export.title')}: ${data.metadata.exportDate}
${t('inventory.totalStocks')}: ${data.metadata.totalStocks}

${t('inventory.statisticsSummary')}
• ${t('inventory.store')}: ${data.statistiques.magasin}
• ${t('inventory.totalItems')}: ${data.statistiques.totalArticles}
• ${t('inventory.lowStock')}: ${data.statistiques.articlesSeuilBas}
• ${t('inventory.outOfStock')}: ${data.statistiques.articlesRupture}
• ${t('inventory.totalUnits')}: ${data.statistiques.unitesTotales}
• ${t('inventory.totalValue')}: ${new Intl.NumberFormat('fr-FR').format(data.statistiques.valeurStockTotal)} Ar
• ${t('inventory.outOfStockRate')}: ${data.statistiques.totalArticles > 0 ? Math.round((data.statistiques.articlesRupture / data.statistiques.totalArticles) * 100) : 0}%
• ${t('inventory.lowStockRate')}: ${data.statistiques.totalArticles > 0 ? Math.round((data.statistiques.articlesSeuilBas / data.statistiques.totalArticles) * 100) : 0}%

${t('inventory.stockDetails')}
${data.stocks.map((stock: any, index: number) => `
${index + 1}. ${stock.nomArticle}
   ${t('inventory.sku')}: ${stock.sku}
   ${t('inventory.unit')}: ${stock.unite}
   ${t('inventory.quantity')}: ${stock.quantite} (${t('inventory.min')}: ${stock.seuilMinimum}, ${t('inventory.max')}: ${stock.seuilMaximum})
   ${t('inventory.costPrice')}: ${new Intl.NumberFormat('fr-FR').format(stock.prixCout)} Ar → ${t('inventory.salePrice')}: ${new Intl.NumberFormat('fr-FR').format(stock.prixVente)} Ar
   ${t('inventory.status')}: ${stock.statutStock}
   ${t('inventory.fillRate')}: ${stock.pourcentageRemplissage}%
`).join('\n')}

---
${t('inventory.reportGenerated')}
    `.trim();

    saveAs(new Blob([textContent], { type: 'text/plain;charset=utf-8' }), `inventory-${data.metadata.periode}.txt`);
  };

  const exportToJSON = (data: any) => {
    const jsonData = {
      hotel: "Simply Hotel",
      service: t('inventory.title'),
      exportDate: new Date().toISOString(),
      period: data.metadata.periode,
      totalStocks: data.metadata.totalStocks,
      statistics: data.statistiques,
      stocks: data.stocks
    };
    saveAs(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }), `inventory-${data.metadata.periode}.json`);
  };

  const exporterInventaire = async (formatType: string) => {
    if (sortedStocksByStore.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportInventoryLoading(true);
    setExportInventoryOpen(false);

    try {
      const data = prepareExportData();

      switch (formatType) {
        case 'csv': exportToCSV(data); break;
        case 'excel': exportToExcel(data); break;
        case 'txt': exportToTXT(data); break;
        case 'json': exportToJSON(data); break;
      }

      toast({ title: t('export.exportSuccess'), description: `${data.metadata.totalStocks} ${t('inventory.itemsExported')} ${formatType.toUpperCase()}` });
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportInventoryLoading(false);
    }
  };

  const stockCardRef = useRef<HTMLDivElement>(null);

  const handleAlertClick = (itemName: string) => {
    setSearchTerm(itemName);
    setTimeout(() => {
      if (stockCardRef.current) {
        stockCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    toast({ title: t('inventory.searchLaunched'), description: `${t('inventory.searchingFor')} "${itemName}" ${t('inventory.inStock')}` });
  };

  const addItemMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/items', {
      sku: data.sku,
      name: data.name,
      unit: data.unit,
      vatRate: data.vat_rate,
      costPrice: data.cost_price,
      salePriceDefault: data.sale_price_default,
      isActive: data.is_active
    }),
    onSuccess: (createdItem: any) => {
      qc.invalidateQueries({ queryKey: ["inventory", "items"] });
      itemForm.reset();
      setShowItemDialog(false);
      toast({ title: t('inventory.itemCreated'), description: `"${createdItem.name}" ${t('inventory.itemCreatedDesc')}` });

      stockForm.reset({
        item_id: createdItem.id,
        store_id: storeId || sortedStores[0]?.id || 0,
        qty_on_hand: 0,
        min_level: 0,
        max_level: 100
      });
      setShowStockDialog(true);
    },
    onError: (err: any) => toast({ title: t('common.error'), description: String(err), variant: 'destructive' }),
  });

  const addStockMut = useMutation({
    mutationFn: (data: any) => api.post('/inventory/stocks', {
      storeId: data.store_id,
      itemId: data.item_id,
      qty: data.qty_on_hand,
      minQty: data.min_level,
      maxQty: data.max_level
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "stocks"] });
      stockForm.reset();
      setShowStockDialog(false);
      toast({ title: t('inventory.stockCreated'), description: t('inventory.stockCreatedDesc') });
    },
    onError: (err: any) => {
      const msg = err?.message || String(err);
      toast({ title: t('common.error'), description: msg.includes('Store not found') ? t('inventory.storeNotFound') : msg, variant: 'destructive' });
    },
  });

  const moveMut = useMutation({
    mutationFn: (m: any) => api.post('/inventory/movements', {
      storeId: m.storeId,
      itemId: m.itemId,
      qty: m.qty,
      type: m.type,
      reason: m.reason
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "stocks"] });
      qc.invalidateQueries({ queryKey: ["inventory", "movements"] });
      toast({ title: t('inventory.movementRecorded'), description: t('inventory.movementRecordedDesc') });
      setQty(0);
    },
    onError: (err: any) => toast({ title: t('common.error'), description: String(err), variant: 'destructive' }),
  });

  const deleteItemWithStocksMut = useMutation({
    mutationFn: (itemId: number) => api.del(`/inventory/items/${itemId}/with-stocks`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "items"] });
      qc.invalidateQueries({ queryKey: ["inventory", "stocks"] });
      qc.invalidateQueries({ queryKey: ["inventory", "movements"] });
      qc.invalidateQueries({ queryKey: ["inventory", "alerts"] });

      toast({ title: t('inventory.itemDeleted'), description: t('inventory.itemDeletedDesc') });
    },
    onError: (err: any) => toast({ title: t('common.error'), description: String(err), variant: 'destructive' }),
  });

  const editStockWithItemMut = useMutation({
    mutationFn: (p: { stockId: number; stockData?: any; itemData?: any; itemId?: number }) => {
      return api.patch(`/inventory/stocks/${p.stockId}/with-item`, {
        stock: p.stockData,
        item: p.itemData
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "stocks"] });
      qc.invalidateQueries({ queryKey: ["inventory", "items"] });
      qc.invalidateQueries({ queryKey: ["inventory", "movements"] });
      toast({ title: t('inventory.changesSaved'), description: t('inventory.changesSavedDesc') });
      setEditingStock(null);
      setEditStockDialog(false);
    },
    onError: (err: any) => {
      console.error("Update error:", err);
      toast({ title: t('common.error'), description: err?.message || String(err), variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (sortedStores.length && !storeId) {
      setStoreId(sortedStores[0].id);
    }
  }, [sortedStores, storeId]);

  const doMove = () => {
    if (!selectedItem || selectedItem === "" || qty === 0 || !storeId || storeId === "") {
      toast({ title: t('common.error'), description: t('inventory.missingFields'), variant: 'destructive' });
      return;
    }
    moveMut.mutate({
      storeId: storeId as number,
      itemId: selectedItem as number,
      qty,
      type,
      reason: type === 'IN' ? t('inventory.receipt') : type === 'OUT' ? t('inventory.exit') : t('inventory.adjustment')
    });
  };

  const onEditClick = (s: any) => {
    setEditingStock(s);
    setEditStockDialog(true);

    combinedEditForm.reset({
      qty_on_hand: s.qty,
      min_level: s.minQty || 0,
      max_level: s.maxQty || 100,
      name: s.item?.name || "",
      cost_price: s.item?.costPrice || 0,
      sale_price_default: s.item?.salePriceDefault || 0,
      vat_rate: s.item?.vatRate || 20,
      is_active: s.item?.isActive !== false,
      sku: s.item?.sku || "",
      unit: s.item?.unit || "piece",
    });
  };

  const onDeleteClick = (stock: any) => {
    const itemId = stock.itemId || stock.item?.id;
    const itemName = stock.item?.name || t('inventory.theItem');

    if (!itemId) {
      toast({ title: t('common.error'), description: t('inventory.itemNotFound'), variant: 'destructive' });
      return;
    }

    if (confirm(t('inventory.deleteConfirm', { name: itemName }))) {
      deleteItemWithStocksMut.mutate(itemId);
    }
  };

  const onSaveEdit = (data: z.infer<typeof combinedEditFormSchema>) => {
    if (!editingStock) return;

    const stockData = {
      qty: data.qty_on_hand,
      minQty: data.min_level,
      maxQty: data.max_level
    };

    const hasItemChanges =
      data.name !== editingStock.item?.name ||
      data.unit !== editingStock.item?.unit ||
      data.cost_price !== editingStock.item?.costPrice ||
      data.sale_price_default !== editingStock.item?.salePriceDefault ||
      data.vat_rate !== editingStock.item?.vatRate ||
      data.is_active !== editingStock.item?.isActive;

    editStockWithItemMut.mutate({
      stockId: editingStock.id,
      stockData: stockData,
      itemData: hasItemChanges ? {
        name: data.name,
        unit: data.unit,
        vatRate: data.vat_rate,
        costPrice: data.cost_price,
        salePriceDefault: data.sale_price_default,
        isActive: data.is_active
      } : undefined,
      itemId: editingStock.itemId
    });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
      let created = 0;
      let failed = 0;

      for (const r of rows) {
        const obj: any = {};
        header.forEach((h, i) => obj[h] = r[i]);
        try {
          const storeIdVal = Number(obj.storeid || obj.store_id);
          const itemIdVal = Number(obj.itemid || obj.item_id);
          const qtyVal = Number(obj.qty || obj.qty_on_hand || obj.quantity || 0);
          const minVal = Number(obj.min || obj.minlevel || obj.min_qty || 0);
          const maxVal = Number(obj.max || obj.maxlevel || obj.max_qty || 100);

          if (!storeIdVal || !itemIdVal) throw new Error(t('inventory.missingIds'));
          await api.post('/inventory/stocks', {
            storeId: storeIdVal,
            itemId: itemIdVal,
            qty: qtyVal,
            minQty: minVal,
            maxQty: maxVal
          });
          created++;
        } catch (e) { failed++; }
      }

      qc.invalidateQueries({ queryKey: ["inventory", "stocks"] });
      toast({ title: t('inventory.importComplete'), description: `${created} ${t('inventory.stocksCreated')}, ${failed} ${t('inventory.failures')}` });
    } catch (error) {
      toast({ title: t('inventory.importError'), description: t('inventory.importReadError'), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const onAddItem = (data: z.infer<typeof itemFormSchema>) => addItemMut.mutate(data);
  const onAddStock = (data: z.infer<typeof stockFormSchema>) => addStockMut.mutate(data);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t('inventory.title')}</h1>
              <p className="text-muted-foreground">{t('inventory.subtitle')}</p>
            </div>

            <div className="flex gap-3">
              {/* Export button */}
              <div className="relative">
                <button
                  onClick={() => setExportInventoryOpen(!exportInventoryOpen)}
                  disabled={exportInventoryLoading}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold group"
                >
                  {exportInventoryLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>{t('export.exporting')}</span></>
                  ) : (
                    <><Download className="w-4 h-4 group-hover:scale-110 transition-transform" /><span>{t('inventory.exportInventory')}</span><ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" /></>
                  )}
                </button>

                {exportInventoryOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                      <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                      <p className="text-xs text-blue-600 mt-1">{t('inventory.chooseFormat')}</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {exportOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                          <button
                            key={option.format}
                            onClick={() => exporterInventaire(option.format)}
                            className={`flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 ${option.bgColor} ${option.hoverColor}`}
                          >
                            <div className={`p-2 rounded-lg ${option.bgColor}`}>
                              <IconComponent className={`w-5 h-5 ${option.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{option.label}</span>
                                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{option.extension}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 text-center">{sortedStocksByStore.length} {t('inventory.items')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Add Item Dialog */}
              <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />{t('inventory.newItem')}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{t('inventory.addItem')}</DialogTitle>
                    <DialogDescription>{t('inventory.addItemDesc')}</DialogDescription>
                  </DialogHeader>
                  <Form {...itemForm}>
                    <form onSubmit={itemForm.handleSubmit(onAddItem)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={itemForm.control} name="name" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>{t('inventory.itemName')}</FormLabel>
                            <FormControl><Input placeholder={t('inventory.itemNamePlaceholder')} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={itemForm.control} name="sku" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.sku')}</FormLabel>
                            <FormControl><Input placeholder={t('inventory.skuPlaceholder')} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={itemForm.control} name="unit" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.unit')}</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder={t('inventory.selectUnit')} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="piece">{t('inventory.unitPiece')}</SelectItem>
                                  <SelectItem value="kg">{t('inventory.unitKg')}</SelectItem>
                                  <SelectItem value="g">{t('inventory.unitG')}</SelectItem>
                                  <SelectItem value="L">{t('inventory.unitL')}</SelectItem>
                                  <SelectItem value="cl">{t('inventory.unitCl')}</SelectItem>
                                  <SelectItem value="ml">{t('inventory.unitMl')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={itemForm.control} name="cost_price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.costPrice')}</FormLabel>
                            <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={itemForm.control} name="sale_price_default" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.salePrice')}</FormLabel>
                            <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={itemForm.control} name="vat_rate" render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>{t('inventory.vatRate')}</FormLabel>
                            <FormControl><Input type="number" min="0" max="100" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setShowItemDialog(false)}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={addItemMut.isPending}>{addItemMut.isPending ? t('common.loading') : t('inventory.createItem')}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Add Stock Dialog */}
              <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Package className="w-4 h-4 mr-2" />{t('inventory.newStock')}</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{t('inventory.addStock')}</DialogTitle>
                    <DialogDescription>{t('inventory.addStockDesc')}</DialogDescription>
                  </DialogHeader>
                  <Form {...stockForm}>
                    <form onSubmit={stockForm.handleSubmit(onAddStock)} className="space-y-4">
                      <FormField control={stockForm.control} name="item_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('inventory.item')}</FormLabel>
                          <FormControl>
                            <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                              <SelectTrigger><SelectValue placeholder={t('inventory.selectItem')} /></SelectTrigger>
                              <SelectContent>
                                {sortedAvailableItems.map((item: any) => (
                                  <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.sku})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={stockForm.control} name="store_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('inventory.store')}</FormLabel>
                          <FormControl>
                            <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value)}>
                              <SelectTrigger><SelectValue placeholder={t('inventory.selectStore')} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem key={3} value="3">{t('inventory.restaurant')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-3 gap-4">
                        <FormField control={stockForm.control} name="qty_on_hand" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.quantity')}</FormLabel>
                            <FormControl><Input min={0} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={stockForm.control} name="min_level" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.minThreshold')}</FormLabel>
                            <FormControl><Input min={0} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={stockForm.control} name="max_level" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.maxThreshold')}</FormLabel>
                            <FormControl><Input min={1} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setShowStockDialog(false)}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={addStockMut.isPending}>{addStockMut.isPending ? t('common.loading') : t('inventory.addStockButton')}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Edit Stock Dialog */}
              <Dialog open={editStockDialog} onOpenChange={setEditStockDialog}>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>{t('inventory.editStockAndItem')}</DialogTitle>
                    <DialogDescription>{t('inventory.editStockAndItemDesc')}</DialogDescription>
                  </DialogHeader>

                  {editingStock && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm font-medium text-blue-800">{t('inventory.item')}: {editingStock.item?.name || t('common.loading')}</p>
                      <p className="text-xs text-blue-600">{t('inventory.sku')}: {editingStock.item?.sku || "N/A"} • {t('inventory.unit')}: {editingStock.item?.unit || "N/A"}</p>
                    </div>
                  )}

                  <Form {...combinedEditForm}>
                    <form onSubmit={combinedEditForm.handleSubmit(onSaveEdit)} className="space-y-4">
                      <div className="border-b pb-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" />{t('inventory.stockInfo')}</h3>

                        <FormField control={combinedEditForm.control} name="qty_on_hand" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('inventory.stockQuantity')}</FormLabel>
                            <FormControl><Input min={0} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <FormField control={combinedEditForm.control} name="min_level" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('inventory.minThreshold')}</FormLabel>
                              <FormControl><Input min={0} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />

                          <FormField control={combinedEditForm.control} name="max_level" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('inventory.maxThreshold')}</FormLabel>
                              <FormControl><Input min={1} type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>

                      {editingStock && (
                        <div className="pt-2">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Edit2 className="h-4 w-4" />{t('inventory.itemInfo')}</h3>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <FormField control={combinedEditForm.control} name="sku" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('inventory.sku')}</FormLabel>
                                <FormControl><Input {...field} disabled /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />

                            <FormField control={combinedEditForm.control} name="unit" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('inventory.unit')}</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder={t('inventory.selectUnit')} /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="piece">{t('inventory.unitPiece')}</SelectItem>
                                      <SelectItem value="kg">{t('inventory.unitKg')}</SelectItem>
                                      <SelectItem value="g">{t('inventory.unitG')}</SelectItem>
                                      <SelectItem value="L">{t('inventory.unitL')}</SelectItem>
                                      <SelectItem value="cl">{t('inventory.unitCl')}</SelectItem>
                                      <SelectItem value="ml">{t('inventory.unitMl')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>

                          <div className="space-y-4">
                            <FormField control={combinedEditForm.control} name="name" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('inventory.itemName')}</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={combinedEditForm.control} name="cost_price" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('inventory.costPrice')}</FormLabel>
                                  <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />

                              <FormField control={combinedEditForm.control} name="sale_price_default" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('inventory.salePrice')}</FormLabel>
                                  <FormControl><Input type="number" min="0" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>

                            <FormField control={combinedEditForm.control} name="vat_rate" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('inventory.vatRate')}</FormLabel>
                                <FormControl><Input type="number" min="0" max="100" {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />

                            <FormField control={combinedEditForm.control} name="is_active" render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                </FormControl>
                                <FormLabel className="font-normal">{t('inventory.activeItem')}</FormLabel>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setEditStockDialog(false)}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={editStockWithItemMut.isPending}>{editStockWithItemMut.isPending ? t('common.loading') : t('inventory.saveChanges')}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-4">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center"><div className="text-2xl font-bold text-primary">{sortedStocksByStore.length}</div><div className="text-sm text-muted-foreground">{t('inventory.itemsInStock')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-destructive">{lowLevel.length}</div><div className="text-sm text-muted-foreground">{t('inventory.lowStock')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-orange-500">{outOfStock.length}</div><div className="text-sm text-muted-foreground">{t('inventory.outOfStock')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-success">{sortedStocksByStore.reduce((sum: any, s: any) => sum + ((s.qty || s.qty_on_hand) || 0), 0)}</div><div className="text-sm text-muted-foreground">{t('inventory.totalUnits')}</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-blue-600">{totalValue.toLocaleString()} Ar</div><div className="text-sm text-muted-foreground">{t('inventory.totalValue')}</div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stock Movement */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{t('inventory.stockMovement')}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Select value={storeId ? String(storeId) : ""} onValueChange={(v) => setStoreId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={t('inventory.selectStore')} /></SelectTrigger>
                  <SelectContent>{sortedStores.map((st: any) => (<SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>))}</SelectContent>
                </Select>

                <Select value={selectedItem ? String(selectedItem) : ""} onValueChange={(v) => setSelectedItem(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={t('inventory.selectItem')} /></SelectTrigger>
                  <SelectContent>
                    {sortedItems.filter((item: any) => (stocks || []).some((s: any) => (s.itemId || s.item?.id) === item.id && (s.storeId || s.store?.id) === storeId)).map((it: any) => (<SelectItem key={it.id} value={String(it.id)}>{it.name}</SelectItem>))}
                  </SelectContent>
                </Select>

                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue placeholder={t('inventory.movementType')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{t('inventory.movementIn')} (IN)</SelectItem>
                    <SelectItem value="OUT">{t('inventory.movementOut')} (OUT)</SelectItem>
                    <SelectItem value="ADJUST">{t('inventory.movementAdjust')}</SelectItem>
                  </SelectContent>
                </Select>

                <Input min={0} type="number" value={qty || ''} placeholder={t('inventory.quantity')} onChange={(e) => setQty(Number(e.target.value))} />

                <Button onClick={doMove} disabled={!selectedItem || qty === 0 || moveMut.isPending}>{moveMut.isPending ? t('common.loading') : t('inventory.validate')}</Button>
              </div>
            </CardContent>
          </Card>

          {/* Stock and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stock List */}
            <Card className="lg:col-span-2" ref={stockCardRef}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Package className="h-5 w-5" />{t('inventory.storeStock')}</span>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t('inventory.searchItem')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-48" />
                    {searchTerm && (<Button variant="ghost" size="sm" onClick={() => setSearchTerm("")} className="h-6 w-6 p-0"><X className="h-4 w-4" /></Button>)}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 overflow-y-auto">
                  {sortedStocksByStore.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-2 opacity-50" /><div className="text-sm">{t('inventory.noStockFound')}</div><div className="text-xs">{t('inventory.addItemsFirst')}</div></div>
                  ) : (
                    sortedStocksByStore.map((s: any) => {
                      const it = s.item || s.Item || (items || []).find((i: any) => i.id === s.itemId) || {};
                      const low = (s.qty || s.qty_on_hand || 0) <= (s.minQty || s.min_level || 0);
                      const out = (s.qty || s.qty_on_hand || 0) === 0;
                      const fillPercentage = (((s.qty || s.qty_on_hand) || 0) / ((s.maxQty || s.max_level) || 100) * 100);

                      return (
                        <div key={s.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-accent/50 transition-colors">
                          <div className="flex-1">
                            <div className="font-semibold flex items-center gap-2">{it.name}{out && <AlertTriangle className="h-4 w-4 text-red-500" />}</div>
                            <div className="text-sm text-muted-foreground">{t('inventory.sku')}: {it.sku} • {t('inventory.quantity')}: {s.qty || s.qty_on_hand} {it.unit} • {t('inventory.threshold')}: {s.minQty || s.min_level} / {s.maxQty || s.max_level}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('inventory.cost')}: {it.costPrice?.toLocaleString?.()} Ar • {t('inventory.sale')}: {it.salePriceDefault?.toLocaleString?.()} Ar</div>
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${out ? 'bg-red-500' : low ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min(fillPercentage, 100)}%` }} /></div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            {out ? <Badge variant="destructive">{t('inventory.outOfStockBadge')}</Badge> : low ? <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{t('inventory.lowStockBadge')}</Badge> : <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('inventory.okBadge')}</Badge>}
                            <div className="text-xs text-muted-foreground">{fillPercentage.toFixed(0)}% {t('inventory.filled')}</div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => onEditClick(s)}><Edit2 className="w-4 h-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => onDeleteClick(s)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />{t('inventory.alerts')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {outOfStock.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{t('inventory.stockOutages')} ({outOfStock.length})</h4>
                      <div className="space-y-2">
                        {outOfStock.map((s: any) => {
                          const item = s.item || (items || []).find((i: any) => i.id === s.itemId) || {};
                          return (<button key={s.id} onClick={() => handleAlertClick(item.name)} className="w-full text-left p-3 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors cursor-pointer"><div className="font-medium text-red-800">{item.name}</div><div className="text-red-600 text-xs">{t('inventory.stockExhausted')} • {t('inventory.sku')}: {item.sku}</div></button>);
                        })}
                      </div>
                    </div>
                  )}

                  {lowLevel.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-2"><TrendingDown className="h-4 w-4" />{t('inventory.lowStockAlert')} ({lowLevel.length})</h4>
                      <div className="space-y-2">
                        {lowLevel.map((s: any) => {
                          const item = s.item || (items || []).find((i: any) => i.id === s.itemId) || {};
                          return (<button key={s.id} onClick={() => handleAlertClick(item.name)} className="w-full text-left p-3 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors cursor-pointer"><div className="font-medium text-orange-800">{item.name}</div><div className="text-orange-600 text-xs">{t('inventory.quantity')}: {s.qty || s.qty_on_hand} • {t('inventory.min')}: {s.minQty || s.min_level} • {t('inventory.sku')}: {item.sku}</div></button>);
                        })}
                      </div>
                    </div>
                  )}

                  {lowLevel.length === 0 && outOfStock.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground"><BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" /><div className="text-sm">{t('inventory.noAlerts')}</div><div className="text-xs">{t('inventory.allStockNormal')}</div></div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Movements */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />{t('inventory.recentMovements')}</CardTitle>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 hover:bg-accent transition-colors">
                  <Upload className="w-4 h-4" /><span className="text-sm">{t('inventory.importCSV')}</span>
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} disabled={importing} />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {(stock_movements || []).slice(0, 50).map((m: any) => {
                  const it = m.item || (items || []).find((i: any) => i.id === m.itemId) || {};
                  const st = m.store || (stores || []).find((s: any) => s.id === m.storeId) || {};
                  return (
                    <div key={m.id} className="p-3 border rounded-md flex items-center justify-between hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3"><Badge variant={m.type === 'IN' ? 'default' : m.type === 'OUT' ? 'destructive' : 'outline'}>{m.type}</Badge><span className="font-medium">{it.name}</span><span className="text-muted-foreground">× {m.qty}</span></div>
                      <div className="text-xs text-muted-foreground">{st.name} • {new Date(m.createdAt || m.created_at).toLocaleString('fr-FR')}</div>
                    </div>
                  );
                })}
                {(stock_movements || []).length === 0 && (<div className="text-center py-8 text-muted-foreground"><TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" /><div className="text-sm">{t('inventory.noMovements')}</div><div className="text-xs">{t('inventory.movementsWillAppear')}</div></div>)}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}