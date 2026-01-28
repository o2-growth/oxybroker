import { X, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import type { MarketplaceFilters as FiltersType } from "@/hooks/useMarketplaceFilters";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type AssetType = Database["public"]["Enums"]["asset_type"];

interface MarketplaceFiltersProps {
  filters: FiltersType;
  setFilter: <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  availableSectors: string[];
  availableStates: string[];
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  lead: "Lead",
  mql: "MQL",
  meeting: "Meeting",
  client: "Cliente",
  mlq: "MLQ (Legacy)",
};

const SORT_OPTIONS = [
  { value: "time_remaining", label: "Mais tempo restante" },
  { value: "highest_score", label: "Maior score" },
  { value: "lowest_price", label: "Menor preço" },
  { value: "highest_price", label: "Maior preço" },
];

export function MarketplaceFilters({
  filters,
  setFilter,
  clearFilters,
  hasActiveFilters,
  availableSectors,
  availableStates,
}: MarketplaceFiltersProps) {
  const isMobile = useIsMobile();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    type: true,
    price: false,
    score: false,
    location: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleAssetType = (type: AssetType) => {
    const current = filters.assetTypes;
    if (current.includes(type)) {
      setFilter(
        "assetTypes",
        current.filter((t) => t !== type)
      );
    } else {
      setFilter("assetTypes", [...current, type]);
    }
  };

  const toggleSector = (sector: string) => {
    const current = filters.sectors;
    if (current.includes(sector)) {
      setFilter(
        "sectors",
        current.filter((s) => s !== sector)
      );
    } else {
      setFilter("sectors", [...current, sector]);
    }
  };

  const toggleState = (state: string) => {
    const current = filters.states;
    if (current.includes(state)) {
      setFilter(
        "states",
        current.filter((s) => s !== state)
      );
    } else {
      setFilter("states", [...current, state]);
    }
  };

  const FilterContent = () => (
    <div className="space-y-4">
      {/* Sort */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Ordenar por
        </Label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) =>
            setFilter("sortBy", value as FiltersType["sortBy"])
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Status
        </Label>
        <div className="flex gap-1 flex-wrap">
          {["live", "ended", "all"].map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                setFilter("status", status as FiltersType["status"])
              }
            >
              {status === "live"
                ? "Ao Vivo"
                : status === "ended"
                ? "Encerrados"
                : "Todos"}
            </Button>
          ))}
        </div>
      </div>

      {/* Asset Type */}
      <Collapsible open={openSections.type} onOpenChange={() => toggleSection("type")}>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tipo de Ativo
          </Label>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              openSections.type && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {(["lead", "mql", "meeting", "client"] as AssetType[]).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <Checkbox
                id={`type-${type}`}
                checked={filters.assetTypes.includes(type)}
                onCheckedChange={() => toggleAssetType(type)}
              />
              <label
                htmlFor={`type-${type}`}
                className="text-sm cursor-pointer flex-1"
              >
                {ASSET_TYPE_LABELS[type]}
              </label>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Price Range */}
      <Collapsible open={openSections.price} onOpenChange={() => toggleSection("price")}>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Faixa de Preço
          </Label>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              openSections.price && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Mín"
              value={filters.minPrice ?? ""}
              onChange={(e) =>
                setFilter(
                  "minPrice",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="h-8"
            />
            <Input
              type="number"
              placeholder="Máx"
              value={filters.maxPrice ?? ""}
              onChange={(e) =>
                setFilter(
                  "maxPrice",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="h-8"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Score Range */}
      <Collapsible open={openSections.score} onOpenChange={() => toggleSection("score")}>
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Faixa de Score
          </Label>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              openSections.score && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Mín"
              value={filters.minScore ?? ""}
              onChange={(e) =>
                setFilter(
                  "minScore",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="h-8"
            />
            <Input
              type="number"
              placeholder="Máx"
              value={filters.maxScore ?? ""}
              onChange={(e) =>
                setFilter(
                  "maxScore",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="h-8"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Location */}
      <Collapsible
        open={openSections.location}
        onOpenChange={() => toggleSection("location")}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Localização
          </Label>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              openSections.location && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {availableStates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Estados</p>
              <div className="flex flex-wrap gap-1">
                {availableStates.slice(0, 10).map((state) => (
                  <Badge
                    key={state}
                    variant={filters.states.includes(state) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleState(state)}
                  >
                    {state}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Sectors */}
      {availableSectors.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Setores
          </Label>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {availableSectors.slice(0, 15).map((sector) => (
              <Badge
                key={sector}
                variant={filters.sectors.includes(sector) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleSector(sector)}
              >
                {sector}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Clear button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full gap-2 text-muted-foreground"
        >
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">
                !
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)] mt-4 pr-4">
            <FilterContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="w-64 shrink-0 space-y-4 border-r border-border pr-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </h3>
        {hasActiveFilters && (
          <Badge variant="secondary" className="text-xs">
            Ativos
          </Badge>
        )}
      </div>
      <FilterContent />
    </div>
  );
}
