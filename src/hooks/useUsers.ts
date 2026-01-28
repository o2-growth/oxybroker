import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  franchise_category_id: string | null;
  franchise_category_name: string | null;
  created_at: string;
}

export interface UpdateUserData {
  full_name?: string;
  role?: AppRole;
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

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    fetchUsers,
    updateUser,
  };
}
