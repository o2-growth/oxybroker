import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "@/pages/admin/AdminAnalytics";

interface DateRangePickerProps {
  preset: "24h" | "7d" | "30d" | "custom";
  dateRange: DateRange;
  onPresetChange: (preset: "24h" | "7d" | "30d" | "custom") => void;
  onCustomRange: (range: DateRange) => void;
}

export function DateRangePicker({
  preset,
  dateRange,
  onPresetChange,
  onCustomRange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1">
        <Button
          variant={preset === "24h" ? "default" : "outline"}
          size="sm"
          onClick={() => onPresetChange("24h")}
        >
          24h
        </Button>
        <Button
          variant={preset === "7d" ? "default" : "outline"}
          size="sm"
          onClick={() => onPresetChange("7d")}
        >
          7d
        </Button>
        <Button
          variant={preset === "30d" ? "default" : "outline"}
          size="sm"
          onClick={() => onPresetChange("30d")}
        >
          30d
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {preset === "custom" ? (
              <>
                {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
              </>
            ) : (
              "Custom"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onCustomRange({ from: range.from, to: range.to });
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
