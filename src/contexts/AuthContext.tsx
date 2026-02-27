import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type AppRole = "admin" | "master_franquia" | "franquia" | "oxy_hacker";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signOut: () => Promise<void>;
  hasRole: (roles: AppRole | AppRole[]) => boolean;
  isAdmin: () => boolean;
  isFranchise: () => boolean;
  canAudit: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock, but only set loading=false AFTER profile resolves
          setTimeout(async () => {
            if (!mounted) return;
            const p = await fetchProfile(newSession.user.id);
            if (mounted) {
              setProfile(p);
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;

      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        const p = await fetchProfile(existingSession.user.id);
        if (mounted) {
          setProfile(p);
          setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    navigate("/auth/login");
  }, [navigate]);

  const hasRole = useCallback((roles: AppRole | AppRole[]) => {
    if (!profile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  }, [profile]);

  const isAdmin = useCallback(() => hasRole("admin"), [hasRole]);
  const isFranchise = useCallback(() => hasRole(["franquia", "master_franquia"]), [hasRole]);
  const canAudit = useCallback(() => hasRole(["admin", "oxy_hacker"]), [hasRole]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, hasRole, isAdmin, isFranchise, canAudit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
