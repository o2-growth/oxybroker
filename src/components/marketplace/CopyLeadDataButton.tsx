import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Copy, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";

export interface LeadCopyData {
  razao_social: string;
  cnpj?: string | null;
  setor: string;
  faturamento_bracket: string;
  contato_nome: string;
  contato_telefone?: string | null;
  contato_email?: string | null;
  contato_cargo?: string | null;
  origem?: string;
  observacoes?: string | null;
}

const BRACKET_LABELS: Record<string, string> = {
  "200k_350k": "R$ 200k – R$ 350k",
  "350k_500k": "R$ 350k – R$ 500k",
  "500k_1m": "R$ 500k – R$ 1M",
  "1m_5m": "R$ 1M – R$ 5M",
  "5m_plus": "R$ 5M+",
};

function formatMarkdown(lead: LeadCopyData): string {
  const lines = [
    `# ${lead.razao_social}`,
    "",
    "| Campo | Valor |",
    "| --- | --- |",
    `| Razão Social | ${lead.razao_social} |`,
    lead.cnpj ? `| CNPJ | ${lead.cnpj} |` : null,
    `| Setor | ${lead.setor} |`,
    `| Faturamento | ${BRACKET_LABELS[lead.faturamento_bracket] ?? lead.faturamento_bracket} |`,
    `| Contato | ${lead.contato_nome} |`,
    lead.contato_cargo ? `| Cargo | ${lead.contato_cargo} |` : null,
    lead.contato_telefone ? `| Telefone | ${lead.contato_telefone} |` : null,
    lead.contato_email ? `| Email | ${lead.contato_email} |` : null,
    lead.origem ? `| Origem | ${lead.origem} |` : null,
  ].filter((l): l is string => l !== null);

  if (lead.observacoes) {
    lines.push("", "## Observações", "", lead.observacoes);
  }

  return lines.join("\n");
}

function formatJson(lead: LeadCopyData): string {
  return JSON.stringify(
    {
      razao_social: lead.razao_social,
      cnpj: lead.cnpj ?? null,
      setor: lead.setor,
      faturamento_bracket: lead.faturamento_bracket,
      faturamento_label: BRACKET_LABELS[lead.faturamento_bracket] ?? lead.faturamento_bracket,
      contato: {
        nome: lead.contato_nome,
        cargo: lead.contato_cargo ?? null,
        telefone: lead.contato_telefone ?? null,
        email: lead.contato_email ?? null,
      },
      origem: lead.origem ?? null,
      observacoes: lead.observacoes ?? null,
    },
    null,
    2,
  );
}

interface CopyLeadDataButtonProps {
  lead: LeadCopyData;
  disabled?: boolean;
}

/**
 * Sprint 4 STORY-026
 * Botão dropdown para copiar dados do lead em formato Markdown tabular ou JSON.
 * Útil para o franqueado colar no CRM/WhatsApp após compra.
 */
export function CopyLeadDataButton({ lead, disabled }: CopyLeadDataButtonProps) {
  const [copied, setCopied] = useState<"markdown" | "json" | null>(null);

  const handleCopy = async (format: "markdown" | "json") => {
    const text = format === "markdown" ? formatMarkdown(lead) : formatJson(lead);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(format);
      toast.success(`Dados copiados (${format === "markdown" ? "Markdown" : "JSON"})`);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("clipboard error:", err);
      toast.error("Não foi possível copiar — verifique permissões do navegador");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copiar dados
          <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCopy("markdown")}>
          <FileText className="h-4 w-4 mr-2" />
          Markdown tabular
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopy("json")}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
