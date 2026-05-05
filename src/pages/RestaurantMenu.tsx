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
import { Plus, Search, Utensils, Clock, DollarSign, Edit2, Trash2, ChefHat, List, Download, ChevronDown, Table, FileText, FileCode, File } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";

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

interface CreateDishData {
  name: string;
  description?: string;
  category: string;
  preparationTime: number;
  price: number;
  difficulty: string;
  isActive?: boolean;
  ingredients: DishIngredient[];
}

export default function RestaurantMenu() {
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
          statut: plat.isActive ? 'Actif' : 'Inactif',
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
      console.error('Erreur lors de l\'export:', erreur);
      toast({ title: 'Erreur exportation', description: String(erreur), variant: 'destructive' });
    } finally {
      setExportMenuLoading(false);
    }
  };

  const exporterPlatsCSV = (donnees: any[], statistiques: any, date: string) => {
    const entetes = ['Nom', 'Description', 'Catégorie', 'Temps Préparation (min)', 'Prix (Ar)', 'Difficulté', 'Statut', 'Nombre Ingrédients', 'Coût Ingrédients (Ar)', 'Marge (%)', 'Date Création'];

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

    const contenuCSV = [
      entetes.join(','),
      ...lignes.map(ligne => ligne.join(','))
    ].join('\n');

    telechargerFichier(contenuCSV, `plats-restaurant-${date}.csv`, 'text/csv');
    toast({ title: 'Export CSV réussi', description: 'Les plats ont été exportés en CSV' });
  };

  const exporterPlatsExcel = async (donnees: any[], statistiques: any, date: string) => {
    const entetes = ['Nom', 'Description', 'Catégorie', 'Temps Préparation (min)', 'Prix (Ar)', 'Difficulté', 'Statut', 'Nombre Ingrédients', 'Coût Ingrédients (Ar)', 'Marge (%)', 'Date Création'];

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

    const contenuExcel = [
      entetes.join('\t'),
      ...lignes.map(ligne => ligne.join('\t'))
    ].join('\n');

    telechargerFichier(contenuExcel, `plats-restaurant-${date}.xls`, 'application/vnd.ms-excel');
    toast({ title: 'Export Excel réussi', description: 'Les plats ont été exportés en Excel' });
  };

  const exporterPlatsTXT = (donnees: any[], statistiques: any, date: string) => {
    const contenuTexte = `
PLATS RESTAURANT - SIMPLY HOTEL
================================

Date de génération: ${statistiques.dateExport}

STATISTIQUES:
=============
• Total plats: ${statistiques.totalPlats}
• Plats actifs: ${statistiques.platsActifs}
• Plats inactifs: ${statistiques.platsInactifs}
• Prix moyen: ${new Intl.NumberFormat('fr-FR').format(statistiques.prixMoyen)} Ar
• Total ingrédients: ${statistiques.ingredientsTotal}

LISTE DES PLATS:
================
${donnees.map((plat, index) => `
${index + 1}. ${plat.nom}
    Catégorie: ${plat.categorieFormatee}
    Description: ${plat.description || 'Aucune'}
    Temps préparation: ${plat.tempsPreparation} min
    Prix: ${plat.prixFormate}
    Difficulté: ${plat.difficulteFormatee}
    Statut: ${plat.statut}
    Ingrédients: ${plat.nombreIngredients}
    Coût ingrédients: ${plat.coutIngredientsFormate}
    Marge: ${plat.margeFormatee}
    Créé le: ${plat.dateCreation}
`).join('\n')}

---
Plats générés automatiquement par Simply Hotel
    `.trim();

    telechargerFichier(contenuTexte, `plats-restaurant-${date}.txt`, 'text/plain');
    toast({ title: 'Export TXT réussi', description: 'Les plats ont été exportés en texte' });
  };

  const exporterPlatsJSON = (donnees: any[], statistiques: any, date: string) => {
    const donneesJSON = {
      restaurant: "Simply Hotel - Restaurant",
      dateExport: new Date().toISOString(),
      statistiques: {
        totalPlats: statistiques.totalPlats,
        platsActifs: statistiques.platsActifs,
        platsInactifs: statistiques.platsInactifs,
        prixMoyen: Math.round(statistiques.prixMoyen),
        totalIngredients: statistiques.ingredientsTotal
      },
      plats: donnees
    };

    telechargerFichier(JSON.stringify(donneesJSON, null, 2), `plats-restaurant-${date}.json`, 'application/json');
    toast({ title: 'Export JSON réussi', description: 'Les plats ont été exportés en JSON' });
  };

  // Fonctions utilitaires pour les labels
  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case "appetizer": return "Entrée";
      case "main_course": return "Plat principal";
      case "dessert": return "Dessert";
      case "beverage": return "Boisson";
      case "side_dish": return "Accompagnement";
      case "dejeuner": return "Petit déjeuner";
      case "snack": return "Snack";
      default: return category;
    }
  };

  const getDifficultyLabel = (difficulty: string): string => {
    switch (difficulty) {
      case "easy": return "Facile";
      case "medium": return "Moyen";
      case "hard": return "Difficile";
      default: return difficulty;
    }
  };

  // Fonction pour formater les ingrédients dans la description
  const formatIngredientsForDescription = (ingredients: DishIngredient[]): string => {
    if (ingredients.length === 0) return '';

    const totalCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
    const ingredientsList = ingredients.map(ing =>
      `• ${ing.quantity} ${ing.unit} ${ing.itemName} - ${ing.cost.toLocaleString()} Ar`
    ).join('\n');

    return `\n\n--- 🧮 INGRÉDIENTS ---\n${ingredientsList}\n📊 Coût total: ${totalCost.toLocaleString()} Ar`;
  };

  // Fonction pour calculer le coût total des ingrédients
  const calculateTotalCost = (ingredients: DishIngredient[]): number => {
    return ingredients.reduce((total, ingredient) => total + ingredient.cost, 0);
  };

  // Fonction pour déterminer le menuDept basé sur la catégorie
  const getMenuDeptFromCategory = (category: string): string => {
    switch (category) {
      case "beverage":
        return "bar";
      case "appetizer":
      case "main_course":
      case "dessert":
      case "side_dish":
      case "dejeuner":
      case "snack":
      default:
        return "restaurant";
    }
  };

  // Fonction pour générer un SKU unique
  const generateDishSku = (): string => {
    return `DISH-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  };

  const loadDishes = async () => {
    try {
      setLoading(true);
      console.log('🔄 Chargement des plats...');

      const response = await api.get('/dishes');
      console.log('🔍 REPONSE dishes COMPLETE:', response);

      // DEBUG de la structure
      console.log('📦 Response.data:', response.data);

      console.log('📦 Response.data?.data:', response.data?.data);
      console.log('🔢 Type de response.data?.data:', typeof response.data?.data);
      console.log('🔢 Is array:', Array.isArray(response.data?.data));

      // Extraction flexible des données
      let dishesData = [];

      if (Array.isArray(response.data?.data)) {
        dishesData = response.data.data;
        console.log('📋 Structure: response.data.data');
      } else if (Array.isArray(response.data)) {
        dishesData = response.data;
        console.log('📋 Structure: response.data');
      } else {
        dishesData = [];
        console.log('📋 Structure: autre ou vide');
      }

      console.log('🎯 Dishes data finaux:', dishesData);
      console.log('🔢 Nombre de plats chargés:', dishesData.length);

      // Vérification de chaque plat
      dishesData.forEach((dish: any, index: number) => {
        console.log(`🍽️ Plat ${index + 1}:`);
        console.log(`   - ID: ${dish.id}`);
        console.log(`   - Nom: ${dish.name}`);
        console.log(`   - Ingrédients:`, dish.ingredients);
        console.log(`   - Type ingrédients: ${typeof dish.ingredients}`);
        console.log(`   - Is array: ${Array.isArray(dish.ingredients)}`);
      });

      setDishes(dishesData);

    } catch (error) {
      console.error('❌ Error loading dishes:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les plats',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      console.log('🔄 Chargement des items pour ingrédients...');

      const response = await api.get('/dishes/for-dishes');
      console.log('🔍 REPONSE items COMPLETE:', response);
      console.log('📦 Données items brutes:', response.data);

      // CORRECTION : Les données peuvent être directement dans response.data
      // ou dans response.data.data selon la structure de votre API
      let itemsData;

      if (response.data && Array.isArray(response.data.data)) {
        // Structure: { data: [...] }
        itemsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Structure: [...]
        itemsData = response.data;
      } else {
        // Autre structure, essayons d'extraire les données
        itemsData = response.data?.data || response.data || [];
      }

      console.log('🎯 Items data extraits:', itemsData);

      const itemsForDish: ItemForDish[] = itemsData.map((item: any) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        // Conversion explicite des Decimal en number
        costPrice: Number(item.costPrice) || 0,
        salePriceDefault: Number(item.salePriceDefault) || 0
      }));

      console.log('✅ Items formatés pour le select:', itemsForDish);
      setItems(itemsForDish);

    } catch (error) {
      console.error('❌ Error loading items:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les articles',
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
      console.log(`🔍 Calcul des stats pour: ${dish.name}`);
      console.log(`   - Ingrédients reçus:`, dish.ingredients);

      // S'assurer que les ingrédients sont bien un tableau
      const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
      console.log(`   - Ingrédients après vérification:`, ingredients);

      const totalCost = ingredients.reduce((total: number, ing: DishIngredient) => {
        const cost = ing.cost || 0;
        console.log(`   - Ingredient ${ing.itemName}: cost = ${cost}`);
        return total + cost;
      }, 0);

      console.log(`   - Coût total: ${totalCost}, Prix: ${dish.price}`);

      const profitMargin = dish.price > 0 ? ((dish.price - totalCost) / dish.price) * 100 : 0;

      console.log(`   - Marge: ${profitMargin}%`);

      return { totalCost, profitMargin };
    } catch (error) {
      console.error('❌ Error calculating dish stats:', error);
      return { totalCost: 0, profitMargin: 0 };
    }
  };

  // Ajouter un ingrédient
  const addIngredient = () => {
    if (!selectedItem || quantity <= 0) {
      toast({
        title: 'Erreur',
        description: 'Veuillez sélectionner un item et une quantité valide.',
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
      title: 'Ingrédient ajouté',
      description: `${selectedItem.name} a été ajouté au plat.`
    });
  };

  // Supprimer un ingrédient
  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  // Soumettre le plat (création ou modification)
  /*const onSubmitDish = async (data: z.infer<typeof dishFormSchema>) => {
    try {
      // Vérifier s'il y a des ingrédients
      if (ingredients.length === 0) {
        const confirmCreate = window.confirm(
          "⚠️ Aucun ingrédient n'a été ajouté à ce plat. \n\nLe coût du plat sera de 0 Ar et la marge ne pourra pas être calculée. \n\nVoulez-vous quand même créer ce plat ?"
        );
        if (!confirmCreate) return;
      }

      // Préparer les données pour le backend
      const dishData = {
        name: data.name,
        description: data.description || "",
        category: data.category,
        preparationTime: data.preparationTime,
        price: data.price,
        difficulty: data.difficulty,
        isActive: true,
        ingredients: ingredients
      };

      console.log('📤 Données envoyées:', dishData);

      let response;
      if (editingDish) {
        // Modification
        response = await api.patch(`/dishes/${editingDish.id}`, dishData);
        toast({
          title: '✅ Plat modifié avec succès',
          description: `"${data.name}" a été mis à jour avec ${ingredients.length} ingrédient(s).`
        });
      } else {
        // Création
        response = await api.post('/dishes', dishData);
        toast({
          title: '✅ Plat créé avec succès',
          description: `"${data.name}" a été créé avec ${ingredients.length} ingrédient(s).`
        });
      }

      console.log('📥 Réponse du serveur:', response);

      // Recharger les plats et réinitialiser
      await loadDishes();
      resetForm();

    } catch (error: any) {
      console.error('❌ Erreur sauvegarde plat:', error);

      let errorMessage = 'Erreur lors de la sauvegarde du plat';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: '❌ Erreur',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };*/

  // Soumettre le plat (création ou modification)
  const onSubmitDish = async (data: z.infer<typeof dishFormSchema>) => {
    try {
      // Vérifier s'il y a des ingrédients (optionnel, peut être ignoré)
      if (ingredients.length === 0) {
        const confirmCreate = window.confirm(
          "⚠️ Aucun ingrédient n'a été ajouté à ce plat. \n\nLe coût du plat sera de 0 Ar et la marge ne pourra pas être calculée. \n\nVoulez-vous quand même créer ce plat ?"
        );
        if (!confirmCreate) return;
      }

      // Préparer les données pour le backend
      const dishData = {
        name: data.name,
        description: data.description || "",
        category: data.category,
        preparationTime: data.preparationTime,
        price: data.price,
        difficulty: data.difficulty,
        isActive: true,
        // On envoie toujours les ingrédients, même si le stock est insuffisant
        // Le backend ne vérifiera pas les stocks car c'est une création de plat
        ingredients: ingredients.map(ing => ({
          itemId: ing.itemId,
          itemName: ing.itemName,
          quantity: ing.quantity,
          unit: ing.unit,
          cost: ing.cost,
          costPrice: ing.costPrice
        }))
      };

      console.log('📤 Données envoyées:', dishData);

      let response;
      if (editingDish) {
        // Modification
        response = await api.patch(`/dishes/${editingDish.id}`, dishData);
        toast({
          title: '✅ Plat modifié avec succès',
          description: `"${data.name}" a été mis à jour avec ${ingredients.length} ingrédient(s).`
        });
      } else {
        // Création
        response = await api.post('/dishes', dishData);
        toast({
          title: '✅ Plat créé avec succès',
          description: `"${data.name}" a été créé avec ${ingredients.length} ingrédient(s).`
        });
      }

      console.log('📥 Réponse du serveur:', response);

      // Recharger les plats et réinitialiser
      await loadDishes();
      resetForm();

    } catch (error: any) {
      console.error('❌ Erreur sauvegarde plat:', error);

      // Gestion spécifique des erreurs de stock (au cas où le backend les vérifierait)
      if (error.response?.data?.error?.includes('stock') || error.response?.data?.error?.includes('Stock')) {
        // Message plus explicite pour l'utilisateur
        toast({
          title: '⚠️ Attention - Stock insuffisant',
          description: 'Le plat a été créé mais certains ingrédients ont un stock insuffisant. Pensez à réapprovisionner.',
          variant: 'default' // ou 'warning' si vous avez ce variant
        });

        // On recharge quand même les plats car la création a probablement réussi
        await loadDishes();
        resetForm();
      } else {
        // Autres erreurs
        let errorMessage = 'Erreur lors de la sauvegarde du plat';
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }

        toast({
          title: '❌ Erreur',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    }
  };
  
  // Supprimer un plat
  const handleDeleteDish = async (dish: Dish) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le plat "${dish.name}" ?`)) {
      try {
        await api.del(`/dishes/${dish.id}`);
        toast({ title: 'Succès', description: 'Plat supprimé avec succès.' });
        await loadDishes();
      } catch (error: any) {
        console.error('Error deleting dish:', error);
        const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression du plat';
        toast({
          title: 'Erreur',
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
            <div className="text-center">Chargement des plats...</div>
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
              <h1 className="text-3xl font-bold">Gestion des Plats</h1>
              <p className="text-muted-foreground">Création • Ingrédients • Coûts • Marges</p>
            </div>

            <div className="flex gap-3">
              {/* Bouton d'exportation */}
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  disabled={exportMenuLoading || dishes.length === 0}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm"
                >
                  {exportMenuLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Export...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Exporter les plats
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>

                {exportMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={() => exporterPlats('excel')}
                      className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-gray-50 rounded-t-lg border-b border-gray-100"
                    >
                      <Table className="w-4 h-4 text-green-600" />
                      <span>Excel (.xls)</span>
                    </button>

                    <button
                      onClick={() => exporterPlats('csv')}
                      className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>CSV (.csv)</span>
                    </button>

                    <button
                      onClick={() => exporterPlats('txt')}
                      className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
                    >
                      <FileCode className="w-4 h-4 text-gray-600" />
                      <span>Texte (.txt)</span>
                    </button>

                    <button
                      onClick={() => exporterPlats('json')}
                      className="flex items-center gap-2 w-full text-left px-4 py-3 hover:bg-gray-50 rounded-b-lg"
                    >
                      <File className="w-4 h-4 text-yellow-600" />
                      <span>JSON (.json)</span>
                    </button>
                  </div>
                )}
              </div>

              <Button onClick={() => setShowDishDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Plat
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
                    <div className="text-sm text-muted-foreground">Plats créés</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {dishes.reduce((total, dish) => total + (dish.ingredients?.length || 0), 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Ingrédients total</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {dishes.filter(dish => dish.ingredients?.length > 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Plats avec ingrédients</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {dishes.filter(dish => !dish.ingredients || dish.ingredients.length === 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Plats sans ingrédients</div>
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
                  {editingDish ? "Modifier le plat" : "Ajouter un nouveau plat"}
                </DialogTitle>
                <DialogDescription>
                  {editingDish ? "Modifiez les informations du plat" : "Créez un nouveau plat avec ses ingrédients"}
                </DialogDescription>
              </DialogHeader>

              <Form {...dishForm}>
                <form onSubmit={dishForm.handleSubmit(onSubmitDish)} className="space-y-6">
                  {/* Informations de base du plat */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={dishForm.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nom du plat</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Pizza Margherita" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="category" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Catégorie</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="appetizer">Entrée</SelectItem>
                              <SelectItem value="main_course">Plat principal</SelectItem>
                              <SelectItem value="dessert">Dessert</SelectItem>
                              <SelectItem value="beverage">Boisson</SelectItem>
                              <SelectItem value="side_dish">Accompagnement</SelectItem>
                              <SelectItem value="dejeuner">Petit déjeuner</SelectItem>
                              <SelectItem value="snack">Snack</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="description" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Description du plat..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="preparationTime" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temps de préparation (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix de vente (Ar)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={dishForm.control} name="difficulty" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Difficulté</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Facile</SelectItem>
                              <SelectItem value="medium">Moyen</SelectItem>
                              <SelectItem value="hard">Difficile</SelectItem>
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
                      <FormLabel>Ingrédients ({ingredients.length})</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowIngredientDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter un ingrédient
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
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeIngredient(index)}
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        ))}

                        {/* Affichage du coût total */}
                        <div className="pt-2 border-t">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Coût total des ingrédients:</span>
                            <span className="text-green-600 font-bold">
                              {calculateTotalCost(ingredients).toLocaleString()} Ar
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground border rounded-md">
                        <div className="text-sm">Aucun ingrédient ajouté</div>
                        <div className="text-xs">Cliquez sur "Ajouter un ingrédient" pour commencer</div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Annuler
                    </Button>
                    <Button type="submit">
                      {editingDish ? "Modifier" : "Créer le plat"}
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
                <DialogTitle>Ajouter un ingrédient</DialogTitle>
                <DialogDescription>
                  Sélectionnez un item et sa quantité
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Select pour choisir un item */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Article</label>
                  <Select
                    onValueChange={(value) => {
                      console.log('🎯 Item sélectionné:', value);
                      const selected = items.find(item => item.id === Number(value));
                      console.log('🔍 Item trouvé:', selected);
                      setSelectedItem(selected || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un article" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.length === 0 ? (
                        <SelectItem value="loading" disabled>
                          Chargement des articles...
                        </SelectItem>
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
                    {items.length} articles disponibles
                  </div>
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantité</label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Quantité nécessaire"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>

                {/* Informations calculées */}
                {selectedItem && quantity > 0 && (
                  <div className="p-3 bg-muted/50 rounded-md space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Unité:</span>
                      <span className="font-medium">{selectedItem.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coût unitaire:</span>
                      <span className="font-medium">{selectedItem.costPrice.toLocaleString()} Ar</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Coût total:</span>
                      <span>{(quantity * selectedItem.costPrice).toLocaleString()} Ar</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowIngredientDialog(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={addIngredient}
                    disabled={!selectedItem || quantity <= 0}
                  >
                    Ajouter l'ingrédient
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
                  Liste des Plats
                </span>

                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un plat..."
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
                    <div className="text-sm">Aucun plat créé</div>
                    <div className="text-xs">Commencez par ajouter votre premier plat</div>
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
                              <Badge variant={
                                dish.difficulty === "easy" ? "default" :
                                  dish.difficulty === "medium" ? "secondary" : "destructive"
                              }>
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
                                  <div>Coût: {totalCost.toLocaleString()} Ar</div>
                                  <div className={
                                    profitMargin >= 30 ? "text-green-600" :
                                      profitMargin >= 15 ? "text-orange-600" : "text-red-600"
                                  }>
                                    Marge: {profitMargin.toFixed(1)}%
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Liste des ingrédients */}
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                  <List className="h-4 w-4" />
                                  Ingrédients ({dishIngredients.length})
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
                                  <div className="text-xs">Aucun ingrédient pour ce plat</div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => prepareEditDish(dish)}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Modifier
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteDish(dish)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Supprimer
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
