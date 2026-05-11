// src/pages/restaurant/RestaurantMenu.tsx
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
import { Plus, Search, Utensils, Clock, DollarSign, Edit2, Trash2, ChefHat, List, Download, ChevronDown, Table, FileText, FileCode, File, FileSpreadsheet } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";

// Schema de validation frontend
const dishFormSchema = z.object({
  name: z.string().min(1, "Le nom du plat est requis"),
  description: z.string().optional(),
  category: z.enum(["appetizer", "main_course", "dessert", "beverage", "side_dish", "dejeuner", "snack"]),
  preparationTime: z.number().min(1, "Le temps de préparation est requis"),
  price: z.number().min(0, "Le prix doit être positif"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

// Types
interface DishIngredient {
  itemId: number;
  itemName: string;
  quantity: number;
  unit: string;
  cost: number;
  costPrice: number;
}

interface Dish {
  id: number;
  name: string;
  description?: string;
  category: string;
  preparationTime: number;
  price: number;
  difficulty: string;
  isActive: boolean;
  ingredients: DishIngredient[];
  createdAt: string;
}

interface ItemForDish {
  id: number;
  name: string;
  sku: string;
  unit: string;
  costPrice: number;
}

export default function RestaurantMenu() {
  const { t } = useTranslation();
  const { toast } = useToast();

  // États locaux
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [items, setItems] = useState<ItemForDish[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDishDialog, setShowDishDialog] = useState(false);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemForDish | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [ingredients, setIngredients] = useState<DishIngredient[]>([]);
  const [loading, setLoading] = useState(false);

  // États pour l'exportation
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuLoading, setExportMenuLoading] = useState(false);

  // Form setup
  const dishForm = useForm<z.infer<typeof dishFormSchema>>({
    resolver: zodResolver(dishFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "main_course",
      preparationTime: 0,
      price: 0,
      difficulty: "medium",
    }
  });

  // Charger les données au montage du composant
  useEffect(() => {
    loadDishes();
    loadItems();
  }, []);

  // Fonction de téléchargement de fichier
  const telechargerFichier = (contenu: string, nomFichier: string, typeMime: string) => {
    const blob = new Blob([contenu], { type: typeMime });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  };

  // Fonctions d'exportation des plats
  const exporterPlats = async (formatType: string) => {
    if (dishes.length === 0) {
      toast({ title: t('export.noDataToExport'), variant: "destructive" });
      return;
    }

    setExportMenuLoading(true);
    setExportMenuOpen(false);

    try {
      const aujourdhui = new Date().toISOString().slice(0, 10);

      const donneesPlats = dishes.map((plat: Dish) => {
        const { totalCost, profitMargin } = calculateDishStats(plat);
        return {
          nom: plat.name,
          description: plat.description || '',
          categorie: plat.category,
          categorieFormatee: getCategoryLabel(plat.category),
          tempsPreparation: plat.preparationTime,
          prix: plat.price,
          prixFormate: `${new Intl.NumberFormat('fr-FR').format(plat.price)} Ar`,
          difficulte: plat.difficulty,
          difficulteFormatee: getDifficultyLabel(plat.difficulty),
          statut: plat.isActive ? t('common.active') : t('common.inactive'),
          nombreIngredients: plat.ingredients?.length || 0,
          coutIngredients: totalCost,
          coutIngredientsFormate: `${new Intl.NumberFormat('fr-FR').format(totalCost)} Ar`,
          marge: profitMargin,
          margeFormatee: `${profitMargin.toFixed(1)}%`,
          dateCreation: new Date(plat.createdAt).toLocaleDateString('fr-FR')
        };
      });

      const statistiques = {
        totalPlats: dishes.length,
        platsActifs: dishes.filter((p: Dish) => p.isActive).length,
        platsInactifs: dishes.filter((p: Dish) => !p.isActive).length,
        prixMoyen: dishes.reduce((sum: number, p: Dish) => sum + p.price, 0) / dishes.length,
        ingredientsTotal: dishes.reduce((sum: number, p: Dish) => sum + (p.ingredients?.length || 0), 0),
        dateExport: new Date().toLocaleString('fr-FR')
      };

      switch (formatType) {
        case 'excel':
          exporterPlatsExcel(donneesPlats, statistiques, aujourdhui);
          break;
        case 'csv':
          exporterPlatsCSV(donneesPlats, statistiques, aujourdhui);
          break;
        case 'txt':
          exporterPlatsTXT(donneesPlats, statistiques, aujourdhui);
          break;
        case 'json':
          exporterPlatsJSON(donneesPlats, statistiques, aujourdhui);
          break;
        default:
          break;
      }
    } catch (erreur) {
      console.error('Export error:', erreur);
      toast({ title: t('export.exportError'), description: String(erreur), variant: 'destructive' });
    } finally {
      setExportMenuLoading(false);
    }
  };

  const exporterPlatsCSV = (donnees: any[], statistiques: any, date: string) => {
    const entetes = [
      t('restaurant.dishName'),
      t('common.description'),
      t('restaurant.category'),
      t('restaurant.preparationTimeMin'),
      `${t('restaurant.price')} (Ar)`,
      t('restaurant.difficulty'),
      t('common.status'),
      t('restaurant.ingredientsCount'),
      `${t('restaurant.ingredientsCost')} (Ar)`,
      `${t('restaurant.margin')} (%)`,
      t('common.createdAt')
    ];

    const lignes = donnees.map(plat => [
      `"${plat.nom}"`,
      `"${plat.description}"`,
      `"${plat.categorieFormatee}"`,
      plat.tempsPreparation,
      plat.prix,
      `"${plat.difficulteFormatee}"`,
      `"${plat.statut}"`,
      plat.nombreIngredients,
      plat.coutIngredients,
      plat.marge,
      `"${plat.dateCreation}"`
    ]);

    const contenuCSV = [entetes.join(','), ...lignes.map(ligne => ligne.join(','))].join('\n');
    telechargerFichier(contenuCSV, `restaurant-dishes-${date}.csv`, 'text/csv');
    toast({ title: t('export.csv'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsExcel = async (donnees: any[], statistiques: any, date: string) => {
    const entetes = [
      t('restaurant.dishName'),
      t('common.description'),
      t('restaurant.category'),
      t('restaurant.preparationTimeMin'),
      `${t('restaurant.price')} (Ar)`,
      t('restaurant.difficulty'),
      t('common.status'),
      t('restaurant.ingredientsCount'),
      `${t('restaurant.ingredientsCost')} (Ar)`,
      `${t('restaurant.margin')} (%)`,
      t('common.createdAt')
    ];

    const lignes = donnees.map(plat => [
      plat.nom,
      plat.description,
      plat.categorieFormatee,
      plat.tempsPreparation,
      plat.prix,
      plat.difficulteFormatee,
      plat.statut,
      plat.nombreIngredients,
      plat.coutIngredients,
      plat.marge,
      plat.dateCreation
    ]);

    const contenuExcel = [entetes.join('\t'), ...lignes.map(ligne => ligne.join('\t'))].join('\n');
    telechargerFichier(contenuExcel, `restaurant-dishes-${date}.xls`, 'application/vnd.ms-excel');
    toast({ title: t('export.excel'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsTXT = (donnees: any[], statistiques: any, date: string) => {
    const contenuTexte = `
${t('restaurant.dishReport')}
${"=".repeat(40)}

${t('restaurant.generationDate')}: ${statistiques.dateExport}

${t('restaurant.statistics')}:
=============
• ${t('restaurant.totalDishes')}: ${statistiques.totalPlats}
• ${t('restaurant.activeDishes')}: ${statistiques.platsActifs}
• ${t('restaurant.inactiveDishes')}: ${statistiques.platsInactifs}
• ${t('restaurant.averagePrice')}: ${new Intl.NumberFormat('fr-FR').format(statistiques.prixMoyen)} Ar
• ${t('restaurant.totalIngredients')}: ${statistiques.ingredientsTotal}

${t('restaurant.dishList')}:
================
${donnees.map((plat, index) => `
${index + 1}. ${plat.nom}
    ${t('restaurant.category')}: ${plat.categorieFormatee}
    ${t('common.description')}: ${plat.description || t('common.none')}
    ${t('restaurant.preparationTime')}: ${plat.tempsPreparation} min
    ${t('restaurant.price')}: ${plat.prixFormate}
    ${t('restaurant.difficulty')}: ${plat.difficulteFormatee}
    ${t('common.status')}: ${plat.statut}
    ${t('restaurant.ingredients')}: ${plat.nombreIngredients}
    ${t('restaurant.ingredientsCost')}: ${plat.coutIngredientsFormate}
    ${t('restaurant.margin')}: ${plat.margeFormatee}
    ${t('common.createdAt')}: ${plat.dateCreation}
`).join('\n')}

---
${t('restaurant.reportFooter')}
    `.trim();

    telechargerFichier(contenuTexte, `restaurant-dishes-${date}.txt`, 'text/plain');
    toast({ title: t('export.txt'), description: t('restaurant.exportSuccess') });
  };

  const exporterPlatsJSON = (donnees: any[], statistiques: any, date: string) => {
    const donneesJSON = {
      restaurant: t('restaurant.hotelName'),
      exportDate: new Date().toISOString(),
      statistiques: {
        totalPlats: statistiques.totalPlats,
        platsActifs: statistiques.platsActifs,
        platsInactifs: statistiques.platsInactifs,
        prixMoyen: Math.round(statistiques.prixMoyen),
        totalIngredients: statistiques.ingredientsTotal
      },
      plats: donnees
    };

    telechargerFichier(JSON.stringify(donneesJSON, null, 2), `restaurant-dishes-${date}.json`, 'application/json');
    toast({ title: t('export.json'), description: t('restaurant.exportSuccess') });
  };

  // Fonctions utilitaires pour les labels
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      appetizer: t('restaurant.categoryAppetizer'),
      main_course: t('restaurant.categoryMainCourse'),
      dessert: t('restaurant.categoryDessert'),
      beverage: t('restaurant.categoryBeverage'),
      side_dish: t('restaurant.categorySideDish'),
      dejeuner: t('restaurant.categoryBreakfast'),
      snack: t('restaurant.categorySnack')
    };
    return labels[category] || category;
  };

  const getDifficultyLabel = (difficulty: string): string => {
    const labels: Record<string, string> = {
      easy: t('restaurant.difficultyEasy'),
      medium: t('restaurant.difficultyMedium'),
      hard: t('restaurant.difficultyHard')
    };
    return labels[difficulty] || difficulty;
  };

  // Fonction pour calculer le coût total des ingrédients
  const calculateTotalCost = (ingredients: DishIngredient[]): number => {
    return ingredients.reduce((total, ingredient) => total + ingredient.cost, 0);
  };

  const loadDishes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dishes');
      
      let dishesData = [];
      if (Array.isArray(response.data?.data)) {
        dishesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        dishesData = response.data;
      } else {
        dishesData = [];
      }

      setDishes(dishesData);
    } catch (error) {
      console.error('Error loading dishes:', error);
      toast({
        title: t('common.error'),
        description: t('restaurant.loadDishesError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dishes/for-dishes');
      
      let itemsData;
      if (response.data && Array.isArray(response.data.data)) {
        itemsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        itemsData = response.data;
      } else {
        itemsData = response.data?.data || response.data || [];
      }

      const itemsForDish: ItemForDish[] = itemsData.map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        costPrice: Number(item.costPrice) || 0,
        salePriceDefault: Number(item.salePriceDefault) || 0
      }));

      setItems(itemsForDish);
    } catch (error) {
      console.error('Error loading items:', error);
      toast({
        title: t('common.error'),
        description: t('restaurant.loadItemsError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les plats par recherche
  const filteredDishes = useMemo(() => {
    if (!searchTerm) return dishes;
    const searchLower = searchTerm.toLowerCase();
    return dishes.filter(dish =>
      dish.name.toLowerCase().includes(searchLower) ||
      dish.category.toLowerCase().includes(searchLower) ||
      dish.description?.toLowerCase().includes(searchLower)
    );
  }, [dishes, searchTerm]);

  // Calculer le coût total et la marge d'un plat
  const calculateDishStats = (dish: Dish) => {
    try {
      const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
      const totalCost = ingredients.reduce((total: number, ing: DishIngredient) => {
        return total + (ing.cost || 0);
      }, 0);
      const profitMargin = dish.price > 0 ? ((dish.price - totalCost) / dish.price) * 100 : 0;
      return { totalCost, profitMargin };
    } catch (error) {
      console.error('Error calculating dish stats:', error);
      return { totalCost: 0, profitMargin: 0 };
    }
  };

  // Ajouter un ingrédient
  const addIngredient = () => {
    if (!selectedItem || quantity <= 0) {
      toast({
        title: t('common.error'),
        description: t('restaurant.selectItemAndQuantity'),
        variant: 'destructive'
      });
      return;
    }

    const newIngredient: DishIngredient = {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      quantity: quantity,
      unit: selectedItem.unit,
      cost: quantity * selectedItem.costPrice,
      costPrice: selectedItem.costPrice
    };

    setIngredients(prev => [...prev, newIngredient]);
    setSelectedItem(null);
    setQuantity(0);
    setShowIngredientDialog(false);

    toast({
      title: t('restaurant.ingredientAdded'),
      description: `${selectedItem.name} ${t('restaurant.ingredientAddedDesc')}`
    });
  };

  // Supprimer un ingrédient
  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  // Soumettre le plat (création ou modification)
  const onSubmitDish = async (data: z.infer<typeof dishFormSchema>) => {
    try {
      if (ingredients.length === 0) {
        const confirmCreate = window.confirm(t('restaurant.noIngredientsConfirm'));
        if (!confirmCreate) return;
      }

      const dishData = {
        name: data.name,
        description: data.description || "",
        category: data.category,
        preparationTime: data.preparationTime,
        price: data.price,
        difficulty: data.difficulty,
        isActive: true,
        ingredients: ingredients.map(ing => ({
          itemId: ing.itemId,
          itemName: ing.itemName,
          quantity: ing.quantity,
          unit: ing.unit,
          cost: ing.cost,
          costPrice: ing.costPrice
        }))
      };

      let response;
      if (editingDish) {
        response = await api.patch(`/dishes/${editingDish.id}`, dishData);
        toast({
          title: t('restaurant.dishUpdated'),
          description: `"${data.name}" ${t('restaurant.dishUpdatedDesc', { count: ingredients.length })}`
        });
      } else {
        response = await api.post('/dishes', dishData);
        toast({
          title: t('restaurant.dishCreated'),
          description: `"${data.name}" ${t('restaurant.dishCreatedDesc', { count: ingredients.length })}`
        });
      }

      await loadDishes();
      resetForm();

    } catch (error: any) {
      console.error('Error saving dish:', error);

      if (error.response?.data?.error?.includes('stock') || error.response?.data?.error?.includes('Stock')) {
        toast({
          title: t('restaurant.stockWarning'),
          description: t('restaurant.stockWarningDesc'),
          variant: 'default'
        });
        await loadDishes();
        resetForm();
      } else {
        let errorMessage = t('restaurant.saveError');
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };
  
  // Supprimer un plat
  const handleDeleteDish = async (dish: Dish) => {
    if (confirm(t('restaurant.deleteConfirm', { name: dish.name }))) {
      try {
        await api.del(`/dishes/${dish.id}`);
        toast({ title: t('common.success'), description: t('restaurant.dishDeleted') });
        await loadDishes();
      } catch (error: any) {
        console.error('Error deleting dish:', error);
        const errorMessage = error.response?.data?.error || t('restaurant.deleteError');
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };

  // Préparer l'édition d'un plat
  const prepareEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIngredients(dish.ingredients || []);

    dishForm.reset({
      name: dish.name,
      description: dish.description || "",
      category: dish.category as any,
      preparationTime: dish.preparationTime,
      price: dish.price,
      difficulty: dish.difficulty as any,
    });

    setShowDishDialog(true);
  };

  // Réinitialiser le formulaire
  const resetForm = () => {
    setShowDishDialog(false);
    setEditingDish(null);
    setIngredients([]);
    dishForm.reset();
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <div className="text-center">{t('common.loading')}</div>
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

          {/* En-tête */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t('restaurant.dishManagement')}</h1>
              <p className="text-muted-foreground">{t('restaurant.dishSubtitle')}</p>
            </div>

            <div className="flex gap-3">
              {/* Bouton d'exportation */}
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  disabled={exportMenuLoading || dishes.length === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white px-4 py-2.5 rounded-lg transition-all duration-200 shadow-lg font-semibold group"
                >
                  {exportMenuLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('export.exporting')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>{t('restaurant.exportDishes')}</span>
                      <ChevronDown className="w-4 h-4 group-hover:rotate-180 transition-transform" />
                    </>
                  )}
                </button>

                {exportMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-10 overflow-hidden backdrop-blur-sm">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                      <p className="text-sm font-bold text-blue-900">{t('export.formats')}</p>
                      <p className="text-xs text-blue-600 mt-1">{t('restaurant.chooseFormat')}</p>
                    </div>
                    <div className="p-3 space-y-2">
                      <button onClick={() => exporterPlats('excel')} className="flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 bg-green-50 hover:bg-green-100">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <div><span className="font-semibold text-gray-900">{t('export.excel')}</span><p className="text-xs text-gray-500">{t('export.excelDescription')}</p></div>
                      </button>
                      <button onClick={() => exporterPlats('csv')} className="flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 bg-blue-50 hover:bg-blue-100">
                        <Table className="w-5 h-5 text-blue-600" />
                        <div><span className="font-semibold text-gray-900">{t('export.csv')}</span><p className="text-xs text-gray-500">{t('export.csvDescription')}</p></div>
                      </button>
                      <button onClick={() => exporterPlats('txt')} className="flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 bg-purple-50 hover:bg-purple-100">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <div><span className="font-semibold text-gray-900">{t('export.txt')}</span><p className="text-xs text-gray-500">{t('export.txtDescription')}</p></div>
                      </button>
                      <button onClick={() => exporterPlats('json')} className="flex items-center gap-4 w-full text-left p-3 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200 bg-orange-50 hover:bg-orange-100">
                        <FileCode className="w-5 h-5 text-orange-600" />
                        <div><span className="font-semibold text-gray-900">{t('export.json')}</span><p className="text-xs text-gray-500">{t('export.jsonDescription')}</p></div>
                      </button>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 text-center">{dishes.length} {t('restaurant.dishes')}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={() => setShowDishDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('restaurant.newDish')}
              </Button>
            </div>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-4">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{dishes.length}</div>
                    <div className="text-sm text-muted-foreground">{t('restaurant.dishesCreated')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {dishes.reduce((total, dish) => total + (dish.ingredients?.length || 0), 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('restaurant.totalIngredients')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {dishes.filter(dish => dish.ingredients?.length > 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('restaurant.dishesWithIngredients')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {dishes.filter(dish => !dish.ingredients || dish.ingredients.length === 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">{t('restaurant.dishesWithoutIngredients')}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dialog pour créer/modifier un plat */}
          <Dialog open={showDishDialog} onOpenChange={(open) => !open && resetForm()}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDish ? t('restaurant.editDish') : t('restaurant.addDish')}
                </DialogTitle>
                <DialogDescription>
                  {editingDish ? t('restaurant.editDishDesc') : t('restaurant.addDishDesc')}
                </DialogDescription>
              </DialogHeader>

              <Form {...dishForm}>
                <form onSubmit={dishForm.handleSubmit(onSubmitDish)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={dishForm.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('restaurant.dishName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('restaurant.dishNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="category" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('restaurant.category')}</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder={t('restaurant.selectCategory')} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="appetizer">{t('restaurant.categoryAppetizer')}</SelectItem>
                              <SelectItem value="main_course">{t('restaurant.categoryMainCourse')}</SelectItem>
                              <SelectItem value="dessert">{t('restaurant.categoryDessert')}</SelectItem>
                              <SelectItem value="beverage">{t('restaurant.categoryBeverage')}</SelectItem>
                              <SelectItem value="side_dish">{t('restaurant.categorySideDish')}</SelectItem>
                              <SelectItem value="dejeuner">{t('restaurant.categoryBreakfast')}</SelectItem>
                              <SelectItem value="snack">{t('restaurant.categorySnack')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="description" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('common.description')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('restaurant.descriptionPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="preparationTime" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('restaurant.preparationTime')}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('restaurant.price')}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="difficulty" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>{t('restaurant.difficulty')}</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">{t('restaurant.difficultyEasy')}</SelectItem>
                              <SelectItem value="medium">{t('restaurant.difficultyMedium')}</SelectItem>
                              <SelectItem value="hard">{t('restaurant.difficultyHard')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Section Ingrédients */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <FormLabel>{t('restaurant.ingredients')} ({ingredients.length})</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowIngredientDialog(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        {t('restaurant.addIngredient')}
                      </Button>
                    </div>

                    {ingredients.length > 0 ? (
                      <div className="space-y-2 border rounded-lg p-4">
                        {ingredients.map((ingredient, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-sm">{ingredient.itemName}</span>
                              <span className="text-xs text-muted-foreground">
                                {ingredient.quantity} {ingredient.unit}
                              </span>
                              <span className="text-xs text-green-600">
                                {ingredient.cost.toLocaleString()} Ar
                              </span>
                            </div>
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeIngredient(index)}>
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ))}
                        <div className="pt-2 border-t">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">{t('restaurant.totalIngredientsCost')}:</span>
                            <span className="text-green-600 font-bold">
                              {calculateTotalCost(ingredients).toLocaleString()} Ar
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground border rounded-md">
                        <div className="text-sm">{t('restaurant.noIngredients')}</div>
                        <div className="text-xs">{t('restaurant.clickToAddIngredient')}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit">
                      {editingDish ? t('common.edit') : t('restaurant.createDish')}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* Dialog pour ajouter un ingrédient */}
          <Dialog open={showIngredientDialog} onOpenChange={setShowIngredientDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('restaurant.addIngredient')}</DialogTitle>
                <DialogDescription>{t('restaurant.selectItemAndQuantityDesc')}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('inventory.item')}</label>
                  <Select onValueChange={(value) => {
                    const selected = items.find(item => item.id === Number(value));
                    setSelectedItem(selected || null);
                  }}>
                    <SelectTrigger><SelectValue placeholder={t('inventory.selectItem')} /></SelectTrigger>
                    <SelectContent>
                      {items.length === 0 ? (
                        <SelectItem value="loading" disabled>{t('common.loading')}</SelectItem>
                      ) : (
                        items.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name} ({item.sku}) - {item.costPrice} Ar/{item.unit}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {items.length} {t('inventory.itemsAvailable')}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('inventory.quantity')}</label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder={t('restaurant.quantityNeeded')}
                    value={quantity || ''}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>

                {selectedItem && quantity > 0 && (
                  <div className="p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>{t('inventory.unit')}:</span>
                      <span className="font-medium">{selectedItem.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('inventory.unitCost')}:</span>
                      <span className="font-medium">{selectedItem.costPrice.toLocaleString()} Ar</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>{t('restaurant.totalCost')}:</span>
                      <span>{(quantity * selectedItem.costPrice).toLocaleString()} Ar</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowIngredientDialog(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="button" onClick={addIngredient} disabled={!selectedItem || quantity <= 0}>
                    {t('restaurant.addIngredient')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Liste des plats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Utensils className="h-5 w-5" />
                  {t('restaurant.dishList')}
                </span>
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('restaurant.searchDish')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                {filteredDishes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">{t('restaurant.noDishes')}</div>
                    <div className="text-xs">{t('restaurant.startAddingDishes')}</div>
                  </div>
                ) : (
                  filteredDishes.map((dish) => {
                    const { totalCost, profitMargin } = calculateDishStats(dish);
                    const dishIngredients = dish.ingredients || [];

                    return (
                      <div key={dish.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{dish.name}</h3>
                              <Badge variant="outline">{getCategoryLabel(dish.category)}</Badge>
                              <Badge variant={dish.difficulty === "easy" ? "default" : dish.difficulty === "medium" ? "secondary" : "destructive"}>
                                {getDifficultyLabel(dish.difficulty)}
                              </Badge>
                            </div>

                            {dish.description && (
                              <p className="text-sm text-muted-foreground mb-3">{dish.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {dish.preparationTime} min
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                {dish.price.toLocaleString()} Ar
                              </div>
                              {totalCost > 0 && (
                                <>
                                  <div>{t('restaurant.cost')}: {totalCost.toLocaleString()} Ar</div>
                                  <div className={profitMargin >= 30 ? "text-green-600" : profitMargin >= 15 ? "text-orange-600" : "text-red-600"}>
                                    {t('restaurant.margin')}: {profitMargin.toFixed(1)}%
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                  <List className="h-4 w-4" />
                                  {t('restaurant.ingredients')} ({dishIngredients.length})
                                </h4>
                              </div>

                              {dishIngredients.length > 0 ? (
                                <div className="space-y-1">
                                  {dishIngredients.map((ingredient: DishIngredient, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                      <div className="flex items-center gap-3">
                                        <span className="font-medium text-sm">{ingredient.itemName}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {ingredient.quantity} {ingredient.unit}
                                        </span>
                                        <span className="text-xs text-green-600">
                                          {ingredient.cost.toLocaleString()} Ar
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-2 text-muted-foreground border rounded-md">
                                  <div className="text-xs">{t('restaurant.noIngredientsForDish')}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button size="sm" variant="outline" onClick={() => prepareEditDish(dish)}>
                              <Edit2 className="w-4 h-4 mr-1" />
                              {t('common.edit')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteDish(dish)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4 mr-1" />
                              {t('common.delete')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}