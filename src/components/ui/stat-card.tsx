import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: "default" | "gold" | "success" | "warning";
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  className,
  variant = "default"
}: StatCardProps) {
  const variantStyles = {
    default: "border-border bg-card",
    gold: "border-gold/20 bg-gradient-to-br from-gold/5 to-gold/10",
    success: "border-success/20 bg-gradient-to-br from-success/5 to-success/10",
    warning: "border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10"
  };

  const iconStyles = {
    default: "text-primary",
    gold: "text-gold",
    success: "text-success",
    warning: "text-warning"
  };

  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-elegant hover:-translate-y-1",
      variantStyles[variant],
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", iconStyles[variant])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend && (
          <p className={cn(
            "text-xs mt-1",
            trend.isPositive ? "text-success" : "text-destructive"
          )}>
            {trend.isPositive ? "+" : ""}{trend.value}% ce mois
          </p>
        )}
      </CardContent>
    </Card>
  );
}