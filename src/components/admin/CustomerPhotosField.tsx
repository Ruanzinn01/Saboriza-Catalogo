import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { MediaCategory } from "@/lib/customers-api";

export interface FormPhoto {
  key: string;
  existingId?: string;
  storagePath?: string;
  file?: File;
  previewUrl: string;
  category: MediaCategory;
  caption: string;
  primary: boolean;
}

const CATEGORY_LABEL: Record<MediaCategory, string> = { FACHADA: "Fachada", INTERIOR: "Interior", OUTRA: "Outra" };

interface Props {
  photos: FormPhoto[];
  onAddFiles: (files: File[]) => void;
  onChange: (key: string, patch: Partial<Pick<FormPhoto, "category" | "caption">>) => void;
  onPrimary: (key: string) => void;
  onRemove: (key: string) => void;
  messages: string[];
}

export function CustomerPhotosField({ photos, onAddFiles, onChange, onPrimary, onRemove, messages }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<FormPhoto | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          onAddFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-dashed border-forest-700/40 bg-cream-50 p-4 text-left hover:bg-forest-950/5"
      >
        <span className="flex items-center gap-3">
          <Camera size={24} className="text-forest-700" aria-hidden />
          <span>
            <strong className="block text-forest-950">Uma visão mais completa do cliente</strong>
            <span className="text-sm text-ink-muted">Fachada, interior, caixas e estrutura do comércio.</span>
          </span>
        </span>
        <span className="rounded-xl bg-forest-700/10 px-4 py-2 text-sm font-semibold text-forest-800">Adicionar fotos</span>
      </button>
      <p className="text-xs text-ink-muted">JPG, PNG ou WebP · até 8 MB por foto. O servidor confere o tipo e o tamanho de novo.</p>
      {messages.length > 0 && (
        <ul role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {messages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.key} className="flex flex-col gap-2 rounded-2xl border border-forest-950/10 p-3">
              <button type="button" onClick={() => setZoom(photo)} className="aspect-[4/3] overflow-hidden rounded-xl bg-forest-950/5" aria-label={`Ampliar foto: ${photo.caption || CATEGORY_LABEL[photo.category]}`}>
                {photo.previewUrl ? <img src={photo.previewUrl} alt={photo.caption || CATEGORY_LABEL[photo.category]} className="h-full w-full object-cover" /> : <span className="text-xs text-ink-muted">Carregando...</span>}
              </button>
              <select
                aria-label="Categoria da foto"
                value={photo.category}
                onChange={(event) => onChange(photo.key, { category: event.target.value as MediaCategory })}
                className="h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm"
              >
                {(Object.keys(CATEGORY_LABEL) as MediaCategory[]).map((category) => <option key={category} value={category}>{CATEGORY_LABEL[category]}</option>)}
              </select>
              <input
                aria-label="Legenda da foto"
                value={photo.caption}
                maxLength={120}
                onChange={(event) => onChange(photo.key, { caption: event.target.value })}
                placeholder="Legenda (opcional)"
                className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm outline-none focus:border-forest-700"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={photo.category !== "FACHADA"}
                  onClick={() => onPrimary(photo.key)}
                  className={cn("min-h-11 rounded-xl px-3 text-sm font-semibold disabled:opacity-40", photo.primary ? "bg-forest-800 text-cream-50" : "border border-forest-900/20 text-forest-900")}
                >
                  {photo.primary ? "✓ Principal" : "Usar como principal"}
                </button>
                <button type="button" onClick={() => onRemove(photo.key)} aria-label="Remover foto" className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50">
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
              {photo.file && <span className="text-xs text-gold-600">Será enviada ao salvar</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-muted">A principal precisa ser uma foto de fachada. Fotos internas ficam identificadas à parte e seguem a permissão de cada área.</p>
      <Dialog open={zoom !== null} onClose={() => setZoom(null)} title={zoom?.caption || (zoom ? CATEGORY_LABEL[zoom.category] : "Foto")} wide>
        {zoom && <img src={zoom.previewUrl} alt={zoom.caption || CATEGORY_LABEL[zoom.category]} className="max-h-[70vh] w-full object-contain" />}
      </Dialog>
    </div>
  );
}
