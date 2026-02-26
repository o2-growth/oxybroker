/**
 * Utilitários canônicos de formatação — STORY-010
 * Fonte única da verdade para formatação de moeda e data no projeto.
 */

/**
 * Formata um valor numérico como moeda brasileira (BRL).
 * @example formatCurrency(1500.5) → "R$ 1.500,50"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata uma data ISO string ou Date para o padrão brasileiro (data + hora).
 * @example formatDate("2026-02-26T10:30:00Z") → "26/02/2026 10:30"
 */
export function formatDate(date: string | Date): string {
  return new Date(typeof date === "string" ? date : date).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

/**
 * Formata apenas a data (sem hora) no padrão brasileiro.
 * @example formatDateOnly("2026-02-26T10:30:00Z") → "26/02/2026"
 */
export function formatDateOnly(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(
    typeof date === "string" ? new Date(date) : date
  );
}

/**
 * Formata data e hora com componentes explícitos no padrão brasileiro.
 * @example formatDateTime("2026-02-26T10:30:00Z") → "26/02/2026 10:30"
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}
