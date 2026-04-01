import React from "react";
import { Trophy, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuctionStatus } from "@/hooks/useAuctionStatus";

interface AuctionStatusBadgeProps {
  status: AuctionStatus;
  myBidAmount?: number | null;
  className?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const AuctionStatusBadge = React.forwardRef<HTMLDivElement, AuctionStatusBadgeProps>(({
  status,
  myBidAmount,
  className,
}, ref) => {
  const config = {
    winning: {
      icon: Trophy,
      label: "Você está ganhando!",
      badgeClass: "oxy-badge-success",
      containerClass: "bg-[hsl(var(--oxy-success))]/10 border-[hsl(var(--oxy-success))]/30",
      textClass: "text-[hsl(var(--oxy-success))]",
    },
    losing: {
      icon: TrendingDown,
      label: "Você foi superado",
      badgeClass: "oxy-badge-warning",
      containerClass: "bg-[hsl(var(--oxy-warning))]/10 border-[hsl(var(--oxy-warning))]/30",
      textClass: "text-[hsl(var(--oxy-warning))]",
    },
    no_bid: {
      icon: Minus,
      label: "Você ainda não deu lance",
      badgeClass: "oxy-badge",
      containerClass: "bg-muted/50 border-border",
      textClass: "text-muted-foreground",
    },
  };

  const { icon: Icon, label, containerClass, textClass } = config[status];

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300",
        containerClass,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", textClass)} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span className={cn("font-medium text-sm", textClass)}>{label}</span>
        {myBidAmount && status === "losing" && (
          <span className={cn("text-xs opacity-75", textClass)}>
            (Seu lance: {formatCurrency(myBidAmount)})
          </span>
        )}
      </div>
    </div>
  );
});
AuctionStatusBadge.displayName = "AuctionStatusBadge";
