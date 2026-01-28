import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Wallet, Package } from "lucide-react";

export default function Transfers() {
  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Transferências
          </h1>
          <p className="text-muted-foreground mt-1">
            Transfira saldo ou ativos para outros usuários
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="oxy-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Transferir Saldo</h3>
                <p className="text-sm text-muted-foreground">
                  Envie saldo para outro franqueado
                </p>
              </div>
            </div>
            <Button className="w-full">Iniciar Transferência</Button>
          </div>

          <div className="oxy-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-oxy-info/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-oxy-info" />
              </div>
              <div>
                <h3 className="font-semibold">Transferir Ativo</h3>
                <p className="text-sm text-muted-foreground">
                  Transfira um ativo adquirido
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              Selecionar Ativo
            </Button>
          </div>
        </div>

        <div className="oxy-card p-8 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            Nenhuma transferência ainda
          </h3>
          <p className="text-muted-foreground">
            Suas transferências aparecerão aqui
          </p>
        </div>
      </div>
    </AppShell>
  );
}
