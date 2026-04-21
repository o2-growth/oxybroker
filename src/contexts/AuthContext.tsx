import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  avatar_url: string | null;
  can_withdraw: boolean;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

type AuthContextType = {
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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[OXY:Auth] fetchProfile error:", error.message);
      } else if (data) {
        console.log("[OXY:Auth] profile loaded — role:", data.role);
        setProfile(data as Profile);
      } else {
        console.warn("[OXY:Auth] fetchProfile returned null data");
      }
    } catch (err) {
      console.error("[OXY:Auth] fetchProfile exception:", err);
    } finally {
      console.log("[OXY:Auth] loading=false");
      setLoading(false);
    }
  }

  useEffect(() => {
    console.log("[OXY:Auth] init — subscribing to auth events…");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[OXY:Auth] event=${event}`, session ? `user=${session.user.id}` : "no session");
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    navigate("/auth/login");
  };

  const hasRole = (roles: AppRole | AppRole[]) => {
    if (!profile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  };

  const isAdmin = () => hasRole("admin");
  const isFranchise = () => hasRole(["franquia", "master_franquia"]);
  const canAudit = () => hasRole(["admin", "oxy_hacker"]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin,
        isFranchise,
        canAudit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
