import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  franchise_category_name: string | null;
  created_at: string;
  suspended_at: string | null;
}

export interface UpdateUserData {
  full_name?: string;
  role?: AppRole;
  franchise_category_id?: string | null;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
  franchise_category_id?: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          role,
          franchise_category_id,
          created_at,
          suspended_at,
          franchise_categories (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedUsers: UserProfile[] = (data || []).map((user) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        franchise_category_id: user.franchise_category_id,
        franchise_category_name: user.franchise_categories?.name || null,
        created_at: user.created_at,
        suspended_at: user.suspended_at,
      }));

      setUsers(formattedUsers);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId: string, data: UpdateUserData) => {
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          role: data.role,
          franchise_category_id: data.franchise_category_id,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // If role changed, also update user_roles table
      if (data.role) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: data.role })
          .eq("user_id", userId);

        if (roleError) throw roleError;
      }

      toast({
        title: "Usuário atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const suspendUser = async (userId: string, suspend: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          suspended_at: suspend ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: suspend ? "Usuário suspenso" : "Usuário reativado",
        description: suspend
          ? "O usuário foi suspenso e não poderá acessar o sistema."
          : "O usuário foi reativado com sucesso.",
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Delete from user_roles first (foreign key constraint)
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      // Delete wallet if exists
      await supabase.from("wallets").delete().eq("user_id", userId);

      // Note: We cannot delete from auth.users via client SDK
      // The profile will remain but user cannot login
      // For full deletion, admin needs to use Supabase dashboard
      
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "Usuário excluído",
        description: "O perfil do usuário foi removido do sistema.",
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const createUser = async (data: CreateUserData) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar usuários.",
          variant: "destructive",
        });
        return false;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: data.role,
          franchise_category_id: data.franchise_category_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar usuário");
      }

      toast({
        title: "Usuário criado",
        description: `O usuário ${data.full_name} foi criado com sucesso.`,
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    createUser,
    updateUser,
    suspendUser,
    deleteUser,
  };
}
