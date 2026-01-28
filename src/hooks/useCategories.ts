import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database, Json } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["franchise_categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["franchise_categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["franchise_categories"]["Update"];

interface UseCategoriesOptions {
  page?: number;
  pageSize?: number;
}

export function useCategories(options: UseCategoriesOptions = {}) {
  const { page = 1, pageSize = 12 } = options;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["categories", page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("franchise_categories")
        .select("*", { count: "exact" })
        .order("name")
        .range(from, to);

      if (error) throw error;
      return { categories: data as Category[], totalCount: count || 0 };
    },
  });

  const categories = data?.categories || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const createMutation = useMutation({
    mutationFn: async (inputData: { name: string; limits_json?: Json }) => {
      const insertData: CategoryInsert = {
        name: inputData.name.trim(),
      };
      if (inputData.limits_json !== undefined) {
        insertData.limits_json = inputData.limits_json;
      }
      
      const { data, error } = await supabase
        .from("franchise_categories")
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Categoria criada",
        description: "A categoria foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryUpdate }) => {
      const { data: result, error } = await supabase
        .from("franchise_categories")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Categoria atualizada",
        description: "A categoria foi atualizada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if category has linked users
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("franchise_category_id", id);

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error(`Esta categoria possui ${count} usuário(s) vinculado(s). Remova os vínculos antes de excluir.`);
      }

      const { error } = await supabase
        .from("franchise_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    categories,
    totalCount,
    totalPages,
    isLoading,
    error,
    refetch,
    createCategory: createMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    deleteCategory: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
