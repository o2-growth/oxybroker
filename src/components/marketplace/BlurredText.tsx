import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

interface BlurredTextProps {
  /** Se `true`, exibe o conteúdo sem blur (pós-compra ou admin). */
  unlocked?: boolean;
  /** Conteúdo real (somente exibido quando unlocked). */
  children: ReactNode;
  /** Placeholder opcional exibido no lugar do conteúdo quando blurred. */
  placeholder?: string;
  className?: string;
  /** Mostra ícone de cadeado. Default: true */
  showLockIcon?: boolean;
}

/**
 * Sprint 4 STORY-024
 * Aplica blur em dados sensíveis pré-compra (nome da empresa, contato, etc.).
 * Conteúdo real só é renderizado quando `unlocked=true` — evita vazamento via DOM.
 */
export function BlurredText({
  unlocked = false,
  children,
  placeholder = "••••••••",
  className,
  showLockIcon = true,
}: BlurredTextProps) {
  if (unlocked) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 select-none blur-sm opacity-70",
        className,
      )}
      aria-label="Dado disponível apenas após compra"
      title="Dado disponível apenas após compra"
    >
      {showLockIcon && <Lock className="h-3 w-3" aria-hidden="true" />}
      <span>{placeholder}</span>
    </span>
  );
}
