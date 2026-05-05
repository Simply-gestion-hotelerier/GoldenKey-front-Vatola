import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UserPlus, 
  ClipboardList, 
  Package, 
  Calendar,
  PlusCircle,
  Receipt
} from "lucide-react";

const quickActions = [
  {
    title: "Nouvelle Arrivée",
    description: "Enregistrer un client",
    icon: UserPlus,
    action: "hotel-checkin",
    variant: "default" as const
  },
  {
    title: "Nouvelle Commande",
    description: "Restaurant/Bar",
    icon: ClipboardList,
    action: "new-order",
    variant: "default" as const
  },
  {
    title: "Gestion Stock",
    description: "Inventaire rapide",
    icon: Package,
    action: "inventory",
    variant: "default" as const
  },
  {
    title: "Planning Spa",
    description: "Nouveau RDV",
    icon: Calendar,
    action: "spa-booking",
    variant: "default" as const
  },
  {
    title: "Ajouter Produit",
    description: "Nouveau article",
    icon: PlusCircle,
    action: "add-product",
    variant: "default" as const
  },
  {
    title: "Facture Rapide",
    description: "Génération facture",
    icon: Receipt,
    action: "quick-invoice",
    variant: "default" as const
  }
];

import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();
  const handleAction = (action: string) => {
    if (action === 'hotel-checkin') navigate('/hotel/plan');
    else if (action === 'new-order') navigate('/restaurant/pos');
    else if (action === 'inventory') navigate('/inventory');
    else if (action === 'spa-booking') navigate('/spa/agenda');
    else if (action === 'add-product') navigate('/inventory');
    else if (action === 'quick-invoice') navigate('/invoices/daily');
    else navigate('/');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Actions Rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.action}
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2 hover:bg-accent hover:shadow-elegant transition-all duration-200"
              onClick={() => handleAction(action.action)}
            >
              <action.icon className="h-6 w-6 text-primary" />
              <div className="text-center">
                <div className="font-medium text-sm">{action.title}</div>
                <div className="text-xs text-muted-foreground">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
