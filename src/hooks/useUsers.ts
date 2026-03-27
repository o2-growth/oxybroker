import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type AppRole = Database["public"]["Enums"]["app_role"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  franchise_category_name: string | null;
  created_at: string;
  suspended_at: string | null;
  can_withdraw: boolean;
  wallet_balance: number;
}

export interface UpdateUserData {
  full_name?: string;
  role?: AppRole;
  franchise_category_id?: string | null;
  can_withdraw?: boolean;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
  franchise_category_id?: string | null;
  can_withdraw?: boolean;
}

interface UseUsersOptions {
  page?: number;
  pageSize?: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro inesperado";
}

export function useUsers(options: UseUsersOptions = {}) {
  const { page = 1, pageSize = 10 } = options;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const totalPages = Math.ceil(totalCount / pageSize);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Fetch profiles
      const { data, error, count } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          role,
          franchise_category_id,
          created_at,
          suspended_at,
          can_withdraw,
          franchise_categories (name)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch wallets for these users
      const userIds = (data || []).map((u) => u.id);
      const { data: walletsData } = await supabase
        .from("wallets")
        .select("user_id, balance")
        .in("user_id", userIds);

      // Create a map of user_id -> balance
      const balanceMap = new Map<string, number>();
      (walletsData || []).forEach((w) => {
        balanceMap.set(w.user_id, w.balance);
      });

      const formattedUsers: UserProfile[] = (data || []).map((user) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        franchise_category_id: user.franchise_category_id,
        franchise_category_name: user.franchise_categories?.name || null,
        created_at: user.created_at,
        suspended_at: user.suspended_at,
        can_withdraw: user.can_withdraw ?? false,
        wallet_balance: balanceMap.get(user.id) ?? 0,
      }));

      setUsers(formattedUsers);
      setTotalCount(count || 0);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar usuários",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, toast]);

  const updateUser = async (userId: string, data: UpdateUserData) => {
    try {
      // Update profiles table
      const updateData: ProfileUpdate = {};
      if (data.full_name !== undefined) updateData.full_name = data.full_name;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.franchise_category_id !== undefined) updateData.franchise_category_id = data.franchise_category_id;
      if (data.can_withdraw !== undefined) updateData.can_withdraw = data.can_withdraw;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
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
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar usuário",
        description: getErrorMessage(error),
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
    } catch (error: unknown) {
      toast({
        title: "Erro ao alterar status",
        description: getErrorMessage(error),
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
    } catch (error: unknown) {
      toast({
        title: "Erro ao excluir usuário",
        description: getErrorMessage(error),
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
          can_withdraw: data.can_withdraw ?? false,
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
    } catch (error: unknown) {
      toast({
        title: "Erro ao criar usuário",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    totalCount,
    totalPages,
    fetchUsers,
    createUser,
    updateUser,
    suspendUser,
    deleteUser,
  };
}
