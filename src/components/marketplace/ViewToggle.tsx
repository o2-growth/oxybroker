import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ view, onViewChange, className }: ViewToggleProps) {
  return (
    <div className={cn("flex gap-1 bg-muted/50 p-1 rounded-lg", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange("list")}
        className={cn(
          "h-7 w-7 p-0 rounded-md transition-all",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Visualização em lista"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange("grid")}
        className={cn(
          "h-7 w-7 p-0 rounded-md transition-all",
          view === "grid"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Visualização em grade"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
