/**
 * useAuth — retrocompatibility re-export.
 *
 * A implementacao real esta em src/contexts/AuthContext.tsx.
 * Este arquivo existe para que todos os imports existentes de "@/hooks/useAuth"
 * continuem funcionando sem nenhuma alteracao.
 */
export { useAuth, AuthProvider } from "@/contexts/AuthContext";
export type { AppRole, Profile } from "@/contexts/AuthContext";
