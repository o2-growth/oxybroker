import { X, Filter, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const ACTIVE_ASSET_TYPES: AssetType[] = ["lead", "mql", "meeting", "client"];

export function MarketplaceFilters({
  filters,
  setFilter,
  clearFilters,
  hasActiveFilters,
  availableSectors,
  availableStates,
}: MarketplaceFiltersProps) {
  const isMobile = useIsMobile();

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

  // Desktop: Horizontal filter bar with popovers
  const DesktopFilters = () => (
    <div className="flex flex-wrap items-center gap-2">
      {/* Asset Type Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5",
              filters.assetTypes.length > 0 && "border-primary text-primary"
            )}
          >
            Tipo de Ativo
            {filters.assetTypes.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {filters.assetTypes.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="space-y-1">
            {ACTIVE_ASSET_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted cursor-pointer"
                onClick={() => toggleAssetType(type)}
              >
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
          </div>
        </PopoverContent>
      </Popover>

      {/* States Filter */}
      {availableStates.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                filters.states.length > 0 && "border-primary text-primary"
              )}
            >
              Estado
              {filters.states.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {filters.states.length}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <ScrollArea className="max-h-64">
              <div className="flex flex-wrap gap-1.5">
                {availableStates.map((state) => (
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
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Sectors Filter */}
      {availableSectors.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-1.5",
                filters.sectors.length > 0 && "border-primary text-primary"
              )}
            >
              Setor
              {filters.sectors.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {filters.sectors.length}
                </Badge>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <ScrollArea className="max-h-64">
              <div className="flex flex-wrap gap-1.5">
                {availableSectors.map((sector) => (
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
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 gap-1.5 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );

  // Mobile: Sheet with vertical filter list
  const MobileFilterContent = () => (
    <div className="space-y-6">
      {/* Asset Type */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Tipo de Ativo</p>
        <div className="space-y-2">
          {ACTIVE_ASSET_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
              onClick={() => toggleAssetType(type)}
            >
              <Checkbox
                id={`mobile-type-${type}`}
                checked={filters.assetTypes.includes(type)}
                onCheckedChange={() => toggleAssetType(type)}
              />
              <label
                htmlFor={`mobile-type-${type}`}
                className="text-sm cursor-pointer flex-1"
              >
                {ASSET_TYPE_LABELS[type]}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* States */}
      {availableStates.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Estado</p>
          <div className="flex flex-wrap gap-1.5">
            {availableStates.map((state) => (
              <Badge
                key={state}
                variant={filters.states.includes(state) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleState(state)}
              >
                {state}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sectors */}
      {availableSectors.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Setor</p>
          <div className="flex flex-wrap gap-1.5">
            {availableSectors.map((sector) => (
              <Badge
                key={sector}
                variant={filters.sectors.includes(sector) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleSector(sector)}
              >
                {sector}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Clear */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="w-full gap-2"
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
            <MobileFilterContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return <DesktopFilters />;
}
