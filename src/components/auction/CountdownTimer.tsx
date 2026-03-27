import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  endTime: string | Date;
  onComplete?: () => void;
  wasExtended?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({ endTime, onComplete, wasExtended }: CountdownProps) {
  const calculateTimeLeft = useCallback((): TimeLeft => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const total = Math.max(0, end - now);

    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((total % (1000 * 60)) / 1000),
      total,
    };
  }, [endTime]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onComplete]);

  // Recalculate immediately when endTime changes (for extension animation)
  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
  }, [calculateTimeLeft]);

  const isUrgent = timeLeft.total < 3600000; // Less than 1 hour
  const isCritical = timeLeft.total < 300000; // Less than 5 minutes

  const formatNumber = (n: number) => n.toString().padStart(2, "0");

  if (timeLeft.total <= 0) {
    return (
      <div className="oxy-countdown text-muted-foreground">
        Encerrado
      </div>
    );
  }

  return (
    <div
      className={cn(
        "oxy-countdown transition-all duration-300",
        isCritical
          ? "text-[hsl(var(--oxy-danger))] animate-pulse"
          : isUrgent
          ? "text-[hsl(var(--oxy-warning))]"
          : "text-foreground",
        wasExtended && "ring-2 ring-primary/50 px-2 py-1 rounded-md bg-primary/10"
      )}
    >
      {timeLeft.days > 0 && (
        <span>
          {timeLeft.days}d{" "}
        </span>
      )}
      <span>{formatNumber(timeLeft.hours)}</span>
      <span className="opacity-50">:</span>
      <span>{formatNumber(timeLeft.minutes)}</span>
      <span className="opacity-50">:</span>
      <span>{formatNumber(timeLeft.seconds)}</span>
      {wasExtended && (
        <span className="ml-2 text-xs text-primary font-normal">+tempo</span>
      )}
    </div>
  );
}
