import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];
type AssetStatus = Database["public"]["Enums"]["asset_status"];
type AssetType = Database["public"]["Enums"]["asset_type"];

interface AssetFilters {
  search?: string;
  status?: AssetStatus | "all";
  type?: AssetType | "all";
  page?: number;
  pageSize?: number;
}

export function useAssets(filters: AssetFilters = {}) {
  const { search, status, type, page = 1, pageSize = 10 } = filters;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["assets", search, status, type, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("assets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (type && type !== "all") {
        query = query.eq("asset_type", type);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { assets: data as Asset[], totalCount: count || 0 };
    },
  });

  const assets = data?.assets || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Fetch available assets (for linking to lots)
  const { data: availableAssets = [] } = useQuery({
    queryKey: ["assets", "available"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("status", "available")
        .order("title");

      if (error) throw error;
      return data as Asset[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<AssetInsert, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("assets")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Ativo criado",
        description: "O ativo foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar ativo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssetUpdate }) => {
      // Check if asset is editable
      const { data: asset, error: fetchError } = await supabase
        .from("assets")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (asset.status === "in_auction" || asset.status === "sold") {
        throw new Error("Não é possível editar ativos em leilão ou vendidos.");
      }

      const { data: result, error } = await supabase
        .from("assets")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Ativo atualizado",
        description: "O ativo foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar ativo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssetStatus }) => {
      const { data: result, error } = await supabase
        .from("assets")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Status atualizado",
        description: "O status do ativo foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if asset is deletable (only draft)
      const { data: asset, error: fetchError } = await supabase
        .from("assets")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (asset.status !== "draft") {
        throw new Error("Apenas ativos em rascunho podem ser excluídos.");
      }

      // Check if asset is linked to any lot
      const { count, error: countError } = await supabase
        .from("lot_items")
        .select("*", { count: "exact", head: true })
        .eq("asset_id", id);

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error("Este ativo está vinculado a um lote. Remova o vínculo antes de excluir.");
      }

      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Ativo excluído",
        description: "O ativo foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir ativo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    assets,
    totalCount,
    totalPages,
    availableAssets,
    isLoading,
    error,
    refetch,
    createAsset: createMutation.mutateAsync,
    updateAsset: updateMutation.mutateAsync,
    updateAssetStatus: updateStatusMutation.mutateAsync,
    deleteAsset: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
