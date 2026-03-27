import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// NOTE: The "assets" storage bucket must be created in the Supabase dashboard
// with public access enabled. Go to Storage > New Bucket > name: "assets", public: true.

interface AssetImageUploadProps {
  assetId: string | null;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
}

export function AssetImageUpload({
  assetId,
  imageUrl,
  onImageChange,
}: AssetImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: "Formato invalido",
        description: "Use imagens PNG, JPEG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho maximo e 5MB.",
        variant: "destructive",
      });
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // Use assetId if available, otherwise use a temporary id
      const folder = assetId || `temp_${Date.now()}`;
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `assets/${folder}/${fileName}`;

      // Simulate progress since supabase-js doesn't expose upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 15, 85));
      }, 150);

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setProgress(95);

      const { data: publicUrlData } = supabase.storage
        .from("assets")
        .getPublicUrl(filePath);

      setProgress(100);

      onImageChange(publicUrlData.publicUrl);

      toast({
        title: "Imagem enviada",
        description: "A imagem foi enviada com sucesso.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao enviar imagem.";
      toast({
        title: "Erro no upload",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = async () => {
    if (!imageUrl) return;

    try {
      // Extract file path from the public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/assets/<path>
      const urlParts = imageUrl.split("/storage/v1/object/public/assets/");
      if (urlParts.length === 2) {
        const filePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from("assets").remove([filePath]);
      }
    } catch {
      // Best-effort removal from storage; we still clear the URL
    }

    onImageChange(null);

    toast({
      title: "Imagem removida",
      description: "A imagem do ativo foi removida.",
    });
  };

  return (
    <div className="grid gap-2">
      <Label>Imagem do Ativo</Label>

      {imageUrl ? (
        <div className="relative group rounded-lg border border-border overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt="Imagem do ativo"
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <ImageIcon className="h-8 w-8" />
          )}
          <span className="text-sm font-medium">
            {uploading ? "Enviando..." : "Clique para enviar imagem"}
          </span>
          <span className="text-xs">PNG, JPEG ou WebP (max 5MB)</span>
        </button>
      )}

      {uploading && (
        <Progress value={progress} className="h-2" />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {imageUrl && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="gap-2 w-fit"
        >
          <Upload className="h-4 w-4" />
          Substituir imagem
        </Button>
      )}
    </div>
  );
}
