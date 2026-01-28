import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppSettings {
  id: string;
  return_window_hours: number;
  bidding_extension_seconds: number;
  scoring_weights: Record<string, number>;
}

export default function AdminSettings() {
  const { loading: authLoading } = useRoleGuard("admin");
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .single();

      if (error) {
        console.error(error);
      } else if (data) {
        setSettings({
          id: data.id,
          return_window_hours: data.return_window_hours,
          bidding_extension_seconds: data.bidding_extension_seconds,
          scoring_weights: (data.scoring_weights as Record<string, number>) || {},
        });
      }
      setLoading(false);
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({
          return_window_hours: settings.return_window_hours,
          bidding_extension_seconds: settings.bidding_extension_seconds,
          scoring_weights: settings.scoring_weights,
        })
        .eq("id", settings.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As alterações foram aplicadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do sistema
          </p>
        </div>

        {settings && (
          <div className="space-y-6">
            <div className="oxy-card p-6 space-y-6">
              <h2 className="font-semibold">Leilão</h2>

              <div className="space-y-2">
                <Label htmlFor="return_window">
                  Prazo de Devolução (horas)
                </Label>
                <Input
                  id="return_window"
                  type="number"
                  value={settings.return_window_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      return_window_hours: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tempo que o comprador tem para solicitar devolução após a
                  compra
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bidding_extension">
                  Extensão de Lance (segundos)
                </Label>
                <Input
                  id="bidding_extension"
                  type="number"
                  value={settings.bidding_extension_seconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      bidding_extension_seconds: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Segundos adicionados ao leilão quando um lance é dado nos
                  últimos minutos
                </p>
              </div>
            </div>

            <div className="oxy-card p-6 space-y-6">
              <h2 className="font-semibold">Pesos de Scoring</h2>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(settings.scoring_weights || {}).map(
                  ([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`weight_${key}`} className="capitalize">
                        {key}
                      </Label>
                      <Input
                        id={`weight_${key}`}
                        type="number"
                        value={value}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            scoring_weights: {
                              ...settings.scoring_weights,
                              [key]: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
