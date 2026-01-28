import { useState, useEffect, useMemo } from "react";

interface CountdownProps {
  endTime: string | Date;
  onComplete?: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function CountdownTimer({ endTime, onComplete }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  function calculateTimeLeft(): TimeLeft {
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
  }

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
  }, [endTime, onComplete]);

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
      className={`oxy-countdown ${
        isCritical
          ? "text-oxy-danger animate-pulse"
          : isUrgent
          ? "text-oxy-warning"
          : "text-foreground"
      }`}
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
    </div>
  );
}
