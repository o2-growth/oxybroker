import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AssetType = Database["public"]["Enums"]["asset_type"];
type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];

const VALID_ASSET_TYPES: AssetType[] = ["lead", "mql", "meeting", "client"];

const CSV_HEADERS = [
  "titulo",
  "tipo",
  "setor",
  "cidade",
  "estado",
  "faixa_receita",
  "funcionarios",
  "score",
];

const CSV_TEMPLATE = `titulo,tipo,setor,cidade,estado,faixa_receita,funcionarios,score
"Empresa ABC",lead,"Tecnologia","São Paulo","SP","100k-500k","10-50",85
"Startup XYZ",mql,"SaaS","Curitiba","PR","500k-1M","51-200",72`;

interface ParsedRow {
  titulo: string;
  tipo: string;
  setor: string;
  cidade: string;
  estado: string;
  faixa_receita: string;
  funcionarios: string;
  score: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  errors: string[];
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Parse a single CSV line handling quoted fields with commas inside.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse full CSV text into header + rows.
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  return { headers, rows };
}

function mapRowToAssetInsert(row: ParsedRow): AssetInsert {
  const employeesNum = row.funcionarios
    ? parseInt(row.funcionarios, 10)
    : null;

  return {
    title: row.titulo.trim(),
    asset_type: row.tipo.trim().toLowerCase() as AssetType,
    status: "draft",
    sector: row.setor.trim() || null,
    location_city: row.cidade.trim() || null,
    location_state: row.estado.trim() || null,
    revenue_range: row.faixa_receita.trim() || null,
    employees_count:
      employeesNum !== null && !isNaN(employeesNum) ? employeesNum : null,
    base_score: parseInt(row.score, 10) || 0,
  };
}

function validateRows(rows: ParsedRow[]): ValidationError[] {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because row 1 is header, data starts at 2

    if (!row.titulo || !row.titulo.trim()) {
      errors.push({
        row: rowNum,
        field: "titulo",
        message: "Titulo é obrigatório",
      });
    }

    if (!row.tipo || !row.tipo.trim()) {
      errors.push({
        row: rowNum,
        field: "tipo",
        message: "Tipo é obrigatório",
      });
    } else if (
      !VALID_ASSET_TYPES.includes(
        row.tipo.trim().toLowerCase() as AssetType
      )
    ) {
      errors.push({
        row: rowNum,
        field: "tipo",
        message: `Tipo inválido "${row.tipo}". Use: ${VALID_ASSET_TYPES.join(", ")}`,
      });
    }

    if (row.score && row.score.trim()) {
      const score = parseInt(row.score, 10);
      if (isNaN(score)) {
        errors.push({
          row: rowNum,
          field: "score",
          message: `Score inválido "${row.score}". Deve ser um número`,
        });
      }
    }

    if (row.funcionarios && row.funcionarios.trim()) {
      const num = parseInt(row.funcionarios, 10);
      if (isNaN(num)) {
        errors.push({
          row: rowNum,
          field: "funcionarios",
          message: `Funcionários inválido "${row.funcionarios}". Deve ser um número`,
        });
      }
    }
  });

  return errors;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CsvImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setValidationErrors([]);
    setHeaderError(null);
    setIsImporting(false);
    setImportProgress(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      resetState();
      onOpenChange(false);
    }
  }, [isImporting, resetState, onOpenChange]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_ativos.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;

      setImportResult(null);
      setHeaderError(null);

      if (!selected.name.endsWith(".csv")) {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo .csv",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const { headers, rows } = parseCsv(text);

        // Validate headers
        const missingHeaders = CSV_HEADERS.filter(
          (h) => !headers.includes(h)
        );
        if (missingHeaders.length > 0) {
          setHeaderError(
            `Colunas ausentes: ${missingHeaders.join(", ")}. Baixe o modelo para ver o formato correto.`
          );
          setFile(selected);
          setParsedRows([]);
          setValidationErrors([]);
          return;
        }

        // Map rows to objects based on header order
        const mapped: ParsedRow[] = rows.map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header] = row[i] || "";
          });
          return {
            titulo: obj.titulo || "",
            tipo: obj.tipo || "",
            setor: obj.setor || "",
            cidade: obj.cidade || "",
            estado: obj.estado || "",
            faixa_receita: obj.faixa_receita || "",
            funcionarios: obj.funcionarios || "",
            score: obj.score || "",
          };
        });

        // Filter out completely empty rows
        const nonEmpty = mapped.filter(
          (row) =>
            row.titulo.trim() ||
            row.tipo.trim() ||
            row.setor.trim() ||
            row.cidade.trim()
        );

        const errors = validateRows(nonEmpty);

        setFile(selected);
        setParsedRows(nonEmpty);
        setValidationErrors(errors);
        setHeaderError(null);
      };

      reader.readAsText(selected, "UTF-8");
    },
    [toast]
  );

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0 || validationErrors.length > 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    const BATCH_SIZE = 50;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const batches: AssetInsert[][] = [];
    for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
      batches.push(
        parsedRows.slice(i, i + BATCH_SIZE).map(mapRowToAssetInsert)
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const { error } = await supabase.from("assets").insert(batch);

        if (error) {
          errorCount += batch.length;
          errors.push(`Lote ${i + 1}: ${error.message}`);
        } else {
          successCount += batch.length;
        }
      } catch (err) {
        errorCount += batch.length;
        errors.push(
          `Lote ${i + 1}: ${err instanceof Error ? err.message : "Erro desconhecido"}`
        );
      }

      setImportProgress(Math.round(((i + 1) / batches.length) * 100));
    }

    setImportResult({ successCount, errorCount, errors });
    setIsImporting(false);

    if (successCount > 0) {
      toast({
        title: "Importação concluída",
        description: `${successCount} ativo(s) importado(s) com sucesso.${errorCount > 0 ? ` ${errorCount} erro(s).` : ""}`,
      });
      onSuccess?.();
    } else {
      toast({
        title: "Erro na importação",
        description: "Nenhum ativo foi importado. Verifique os erros.",
        variant: "destructive",
      });
    }
  }, [parsedRows, validationErrors, toast, onSuccess]);

  const previewRows = parsedRows.slice(0, 5);
  const hasValidData =
    parsedRows.length > 0 &&
    validationErrors.length === 0 &&
    !headerError;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar CSV
          </DialogTitle>
          <DialogDescription>
            Importe ativos em massa a partir de um arquivo CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Download template */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Modelo CSV</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Baixe o modelo para preencher com os dados dos ativos
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Baixar Modelo
              </Button>
            </div>
          </div>

          {/* File input */}
          <div className="space-y-2">
            <div
              className="relative flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isImporting}
              />
              <div className="text-center">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {file ? file.name : "Clique para selecionar um arquivo CSV"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formato aceito: .csv
                </p>
              </div>
            </div>

            {file && !isImporting && !importResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetState}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-3 w-3" />
                Remover arquivo
              </Button>
            )}
          </div>

          {/* Header error */}
          {headerError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{headerError}</p>
              </div>
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  {validationErrors.length} erro(s) de validação
                </p>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive/80">
                    Linha {err.row}, campo "{err.field}": {err.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && !headerError && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Pré-visualização ({parsedRows.length} linha
                  {parsedRows.length !== 1 ? "s" : ""})
                </p>
                {parsedRows.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    Mostrando 5 de {parsedRows.length}
                  </Badge>
                )}
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Título
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Tipo
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Setor
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Cidade
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Estado
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Receita
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Func.
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {row.titulo || "-"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={
                              VALID_ASSET_TYPES.includes(
                                row.tipo
                                  .trim()
                                  .toLowerCase() as AssetType
                              )
                                ? ""
                                : "border-destructive text-destructive"
                            }
                          >
                            {row.tipo || "-"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{row.setor || "-"}</td>
                        <td className="px-3 py-2">{row.cidade || "-"}</td>
                        <td className="px-3 py-2">{row.estado || "-"}</td>
                        <td className="px-3 py-2">
                          {row.faixa_receita || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.funcionarios || "-"}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {row.score || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm font-medium">Importando ativos...</p>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {importProgress}%
              </p>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div
              className={`rounded-lg border p-4 space-y-2 ${
                importResult.errorCount === 0
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-yellow-500/50 bg-yellow-500/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    importResult.errorCount === 0
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                />
                <p className="text-sm font-medium">Resultado da importação</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  {importResult.successCount} importado(s)
                </span>
                {importResult.errorCount > 0 && (
                  <span className="text-destructive">
                    {importResult.errorCount} erro(s)
                  </span>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            {importResult ? "Fechar" : "Cancelar"}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={!hasValidData || isImporting}
              className="gap-2"
            >
              {isImporting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isImporting
                ? "Importando..."
                : `Importar ${parsedRows.length} ativo${parsedRows.length !== 1 ? "s" : ""}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
