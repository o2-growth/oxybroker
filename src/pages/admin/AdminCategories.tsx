import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["franchise_categories"]["Row"];

export default function AdminCategories() {
  const { loading: authLoading } = useRoleGuard("admin");
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("franchise_categories")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async () => {
    if (!newCategory.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase.from("franchise_categories").insert({
        name: newCategory.trim(),
      });

      if (error) throw error;

      toast({
        title: "Categoria criada",
        description: `A categoria "${newCategory}" foi criada com sucesso.`,
      });

      setNewCategory("");
      setDialogOpen(false);
      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderTree className="h-6 w-6 text-primary" />
              Categorias
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as categorias de franquias
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Categoria</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Categoria</Label>
                  <Input
                    id="name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ex: Premium"
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newCategory.trim()}
                  className="w-full"
                >
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Categoria
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {categories.length === 0 ? (
          <div className="oxy-card p-8 text-center">
            <FolderTree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma categoria</h3>
            <p className="text-muted-foreground">
              Crie categorias para organizar as franquias
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="oxy-card p-4">
                <h3 className="font-semibold">{category.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Criada em{" "}
                  {new Date(category.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
