import { type ChangeEvent, type DragEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

interface ImageUploaderProps {
  onUploaded: (url: string) => void;
}

export function ImageUploader({ onUploaded }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function uploadFile(file: File) {
    if (uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }

    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name || "imagem.png"}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    setUploading(false);

    if (error) {
      toast.error("Não foi possível enviar a imagem");
      return;
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    onUploaded(data.publicUrl);
    toast.success("Imagem enviada");
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadFile(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) uploadFile(file);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 text-center transition-colors",
        dragging
          ? "border-forest-700 bg-forest-700/5 text-forest-800"
          : "border-ink-900/20 bg-cream-50 text-ink-700/70 hover:border-forest-700 hover:text-forest-800"
      )}
    >
      <UploadCloud size={18} />
      <span className="text-sm font-semibold">{uploading ? "Enviando..." : "Arraste, cole (Ctrl+V) ou clique pra enviar"}</span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={uploading} />
    </label>
  );
}
