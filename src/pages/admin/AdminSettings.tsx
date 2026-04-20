import { AppShell } from "@/components/layout/AppShell";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Save, Loader2 } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { AppSettings } from "@/hooks/useAppSettings";

export default function AdminSettings() {
  const { loading: authLoading } = useRoleGuard("admin");
  const { settings, loading, saving, save } = useAppSettings();

  // Local state para formulario controlado
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);

  // Sincroniza o estado local quando os dados chegam do servidor
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = () => {
    if (!localSettings) return;
    save(localSettings);
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

        {localSettings && (
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
                  value={localSettings.return_window_hours}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
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
                  value={localSettings.bidding_extension_seconds}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
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
              <h2 className="font-semibold">Precificação de Leads (Sprint 4)</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mql_base">MQL base (R$)</Label>
                  <Input
                    id="mql_base"
                    type="number"
                    step="0.01"
                    value={localSettings.mql_base_value}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        mql_base_value: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Preço do lead = MQL base × multiplicador da faixa.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buy_now_premium">Premium Buy Now pré-leilão</Label>
                  <Input
                    id="buy_now_premium"
                    type="number"
                    step="0.01"
                    value={localSettings.buy_now_premium_multiplier}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        buy_now_premium_multiplier: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Aplicado ao preço base quando lead é comprado antes do leilão abrir.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sla_min">Duração do leilão (min)</Label>
                  <Input
                    id="sla_min"
                    type="number"
                    value={localSettings.sla_minutes}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        sla_minutes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_snipe">Máx. extensões anti-sniping</Label>
                  <Input
                    id="max_snipe"
                    type="number"
                    value={localSettings.max_sniping_extensions}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        max_sniping_extensions: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Cada lance nos últimos segundos estende {localSettings.bidding_extension_seconds}s.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Multiplicadores por faixa de faturamento</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(Object.keys(localSettings.bracket_multipliers) as (keyof typeof localSettings.bracket_multipliers)[]).map(
                    (bracket) => (
                      <div key={bracket} className="space-y-1">
                        <Label htmlFor={`mult_${bracket}`} className="text-xs">
                          {bracket.replace("_", "–").replace("_", " ")}
                        </Label>
                        <Input
                          id={`mult_${bracket}`}
                          type="number"
                          step="0.1"
                          value={localSettings.bracket_multipliers[bracket]}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              bracket_multipliers: {
                                ...localSettings.bracket_multipliers,
                                [bracket]: Number(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    ),
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Exemplo: MQL base R$ {localSettings.mql_base_value.toFixed(2)} × 1.3 (500k–1M) = R$
                  {" "}
                  {(localSettings.mql_base_value * 1.3).toFixed(2)}.
                </p>
              </div>
            </div>

            <div className="oxy-card p-6 space-y-6">
              <h2 className="font-semibold">Pesos de Scoring</h2>

              <div className="grid grid-cols-2 gap-4">
                {Object.entries(localSettings.scoring_weights || {}).map(
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
                          setLocalSettings({
                            ...localSettings,
                            scoring_weights: {
                              ...localSettings.scoring_weights,
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
