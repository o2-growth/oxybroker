import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Lot = Database["public"]["Tables"]["lots"]["Row"];
type LotInsert = Database["public"]["Tables"]["lots"]["Insert"];
type LotUpdate = Database["public"]["Tables"]["lots"]["Update"];
type LotStatus = Database["public"]["Enums"]["lot_status"];
type LotItem = Database["public"]["Tables"]["lot_items"]["Row"];
type Asset = Database["public"]["Tables"]["assets"]["Row"];

interface LotWithAssets extends Lot {
  lot_items?: Array<LotItem & { assets: Asset }>;
}

interface LotFilters {
  search?: string;
  status?: LotStatus | "all";
  page?: number;
  pageSize?: number;
}

export function useAdminLots(filters: LotFilters = {}) {
  const { search, status, page = 1, pageSize = 10 } = filters;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-lots", search, status, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("lots")
        .select(`
          *,
          lot_items (
            asset_id,
            assets (*)
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { lots: data as LotWithAssets[], totalCount: count || 0 };
    },
  });

  const lots = data?.lots || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const createMutation = useMutation({
    mutationFn: async (data: Omit<LotInsert, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await supabase
        .from("lots")
        .insert({
          ...data,
          current_price: data.starting_price || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      toast({
        title: "Lote criado",
        description: "O lote foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LotUpdate }) => {
      // Check if lot is editable (only draft)
      const { data: lot, error: fetchError } = await supabase
        .from("lots")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (lot.status !== "draft") {
        throw new Error("Apenas lotes em rascunho podem ser editados.");
      }

      const updateData: LotUpdate = { ...data };
      if (data.starting_price !== undefined) {
        updateData.current_price = data.starting_price;
      }

      const { data: result, error } = await supabase
        .from("lots")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      toast({
        title: "Lote atualizado",
        description: "O lote foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addAssetMutation = useMutation({
    mutationFn: async ({ lotId, assetId }: { lotId: string; assetId: string }) => {
      // Check if lot is in draft
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("status")
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;

      if (lot.status !== "draft") {
        throw new Error("Apenas lotes em rascunho podem ter ativos vinculados.");
      }

      const { error } = await supabase
        .from("lot_items")
        .insert({ lot_id: lotId, asset_id: assetId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Ativo vinculado",
        description: "O ativo foi vinculado ao lote com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao vincular ativo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeAssetMutation = useMutation({
    mutationFn: async ({ lotId, assetId }: { lotId: string; assetId: string }) => {
      // Check if lot is in draft
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select("status")
        .eq("id", lotId)
        .single();

      if (lotError) throw lotError;

      if (lot.status !== "draft") {
        throw new Error("Apenas lotes em rascunho podem ter ativos removidos.");
      }

      const { error } = await supabase
        .from("lot_items")
        .delete()
        .eq("lot_id", lotId)
        .eq("asset_id", assetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Ativo removido",
        description: "O ativo foi removido do lote com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover ativo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      // Fetch lot with items
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select(`
          *,
          lot_items (asset_id)
        `)
        .eq("id", id)
        .single();

      if (lotError) throw lotError;

      if (lot.status !== "draft") {
        throw new Error("Apenas lotes em rascunho podem ser publicados.");
      }

      const assetIds = lot.lot_items?.map((item: { asset_id: string }) => item.asset_id) || [];

      if (assetIds.length === 0) {
        throw new Error("O lote precisa ter pelo menos um ativo vinculado para ser publicado.");
      }

      if (!lot.ends_at || new Date(lot.ends_at) <= new Date()) {
        throw new Error("A data de término deve ser no futuro.");
      }

      // Update lot status to live
      const { error: updateLotError } = await supabase
        .from("lots")
        .update({
          status: "live",
          starts_at: lot.starts_at || new Date().toISOString(),
        })
        .eq("id", id);

      if (updateLotError) throw updateLotError;

      // Update all linked assets to in_auction
      const { error: updateAssetsError } = await supabase
        .from("assets")
        .update({ status: "in_auction" })
        .in("id", assetIds);

      if (updateAssetsError) throw updateAssetsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Lote publicado",
        description: "O lote está agora disponível no marketplace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao publicar lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      // Fetch lot with items
      const { data: lot, error: lotError } = await supabase
        .from("lots")
        .select(`
          *,
          lot_items (asset_id)
        `)
        .eq("id", id)
        .single();

      if (lotError) throw lotError;

      if (lot.status !== "live") {
        throw new Error("Apenas lotes ao vivo podem ser cancelados.");
      }

      const assetIds = lot.lot_items?.map((item: { asset_id: string }) => item.asset_id) || [];

      // Update lot status to cancelled
      const { error: updateLotError } = await supabase
        .from("lots")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (updateLotError) throw updateLotError;

      // Revert all linked assets to available
      if (assetIds.length > 0) {
        const { error: updateAssetsError } = await supabase
          .from("assets")
          .update({ status: "available" })
          .in("id", assetIds);

        if (updateAssetsError) throw updateAssetsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast({
        title: "Lote cancelado",
        description: "O lote foi cancelado e os ativos foram liberados.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if lot is deletable (only draft or cancelled)
      const { data: lot, error: fetchError } = await supabase
        .from("lots")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      if (lot.status !== "draft" && lot.status !== "cancelled") {
        throw new Error("Apenas lotes em rascunho ou cancelados podem ser excluídos.");
      }

      // Delete lot items first
      const { error: itemsError } = await supabase
        .from("lot_items")
        .delete()
        .eq("lot_id", id);

      if (itemsError) throw itemsError;

      // Delete lot
      const { error } = await supabase
        .from("lots")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lots"] });
      toast({
        title: "Lote excluído",
        description: "O lote foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir lote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    lots,
    totalCount,
    totalPages,
    isLoading,
    error,
    refetch,
    createLot: createMutation.mutateAsync,
    updateLot: updateMutation.mutateAsync,
    addAssetToLot: addAssetMutation.mutateAsync,
    removeAssetFromLot: removeAssetMutation.mutateAsync,
    publishLot: publishMutation.mutateAsync,
    cancelLot: cancelMutation.mutateAsync,
    deleteLot: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
