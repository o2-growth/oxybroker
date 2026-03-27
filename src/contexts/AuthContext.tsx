import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export type AppRole = "admin" | "master_franquia" | "franquia" | "oxy_hacker";
const SUSPENDED_REASON = "suspended";
const SUSPENDED_MESSAGE = "Sua conta está suspensa. Entre em contato com o administrador.";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  avatar_url: string | null;
  suspended_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ user: User | null; session: Session | null }>;
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

function isSuspendedProfile(profile: Profile | null): boolean {
  return Boolean(profile?.suspended_at);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleSuspendedUser = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
    navigate(`/auth/login?reason=${SUSPENDED_REASON}`, { replace: true });
  }, [navigate]);

  const syncSessionState = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const nextProfile = await fetchProfile(nextSession.user.id);

    if (isSuspendedProfile(nextProfile)) {
      await handleSuspendedUser();
      return;
    }

    setProfile(nextProfile);
    setLoading(false);
  }, [handleSuspendedUser]);

  useEffect(() => {
    let mounted = true;

    const runSessionSync = async (nextSession: Session | null) => {
      if (!mounted) return;
      await syncSessionState(nextSession);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setTimeout(() => {
          void runSessionSync(newSession);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      await runSessionSync(existingSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncSessionState]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const nextProfile = payload.new as Profile;

          if (isSuspendedProfile(nextProfile)) {
            void handleSuspendedUser();
            return;
          }

          setProfile(nextProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleSuspendedUser, user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      const nextProfile = await fetchProfile(data.user.id);

      if (isSuspendedProfile(nextProfile)) {
        await supabase.auth.signOut();
        throw new Error(SUSPENDED_MESSAGE);
      }
    }

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
