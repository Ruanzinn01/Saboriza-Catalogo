import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { listFiles, MAX_PHOTOS, removeFile, signedFileUrl, type SupplierFile, validateUpload } from "@/lib/supplier-api";
import { friendlyRpcError } from "@/lib/supplier-rpc";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import { SectionCard, SelectField } from "@/components/admin/fornecedores/form/FormUi";

export interface QueuedFile {
  id: string;
  file: File;
  kind: "FOTO" | "DOCUMENTO";
  photoKind: "Fachada" | "Interior" | "Outra";
  caption: string;
  primary: boolean;
  previewUrl: string | null;
}

interface Props {
  supplierId: string | null;
  queue: QueuedFile[];
  onQueueChange: (queue: QueuedFile[]) => void;
  onDirty: () => void;
  // Incrementa depois de um salvamento para recarregar os arquivos já gravados.
  reloadKey: number;
}

// Fotos e documentos ficam em fila até o fornecedor ser salvo; depois sobem para o armazenamento privado (URL assinada de curta duração).
export function SupplierFilesSection({ supplierId, queue, onQueueChange, onDirty, reloadKey }: Props) {
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const canManage = permissions["fornecedores.anexos"];
  const [saved, setSaved] = useState<SupplierFile[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supplierId) return;
    const files = await listFiles({ supplierId });
    setSaved(files);
    if (files) {
      const entries = await Promise.all(files.filter((f) => f.kind === "FOTO").map(async (f) => [f.id, await signedFileUrl(f.storagePath)] as const));
      setThumbs(Object.fromEntries(entries.filter((e): e is readonly [string, string] => e[1] !== null)));
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (!canManage) {
    return (
      <SectionCard title="Fotos, referências e documentos" hint="Anexos têm permissão própria." step="04">
        <p className="text-sm text-ink-muted">Seu perfil não inclui anexos de fornecedores.</p>
      </SectionCard>
    );
  }

  const photoCount = (saved?.filter((f) => f.kind === "FOTO").length ?? 0) + queue.filter((q) => q.kind === "FOTO").length;

  function enqueue(list: FileList | null, kind: "FOTO" | "DOCUMENTO") {
    if (!list) return;
    const next = [...queue];
    let photos = photoCount;
    for (const file of Array.from(list)) {
      if (kind === "FOTO" && photos >= MAX_PHOTOS) {
        toast.error(`Limite de ${MAX_PHOTOS} fotos alcançado.`);
        break;
      }
      const problem = validateUpload(file, kind);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      if (kind === "FOTO") photos += 1;
      next.push({
        id: crypto.randomUUID(),
        file,
        kind,
        photoKind: "Outra",
        caption: "",
        primary: false,
        previewUrl: kind === "FOTO" ? URL.createObjectURL(file) : null,
      });
    }
    onQueueChange(next);
    onDirty();
  }

  function update(id: string, changes: Partial<QueuedFile>) {
    onQueueChange(
      queue.map((item) => {
        if (item.id === id) return { ...item, ...changes };
        // só uma fachada principal por fornecedor
        return changes.primary ? { ...item, primary: false } : item;
      })
    );
    onDirty();
  }

  function dequeue(id: string) {
    const item = queue.find((q) => q.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    onQueueChange(queue.filter((q) => q.id !== id));
  }

  async function open(file: SupplierFile) {
    const url = await signedFileUrl(file.storagePath);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function removeSaved(file: SupplierFile) {
    const { error } = await removeFile(file.id);
    if (error) toast.error(friendlyRpcError(error, "Não foi possível retirar o arquivo"));
    else toast.success("Arquivo retirado do cadastro (o registro de auditoria permanece)");
    await load();
  }

  const savedPhotos = saved?.filter((f) => f.kind === "FOTO") ?? [];
  const savedDocs = saved?.filter((f) => f.kind === "DOCUMENTO") ?? [];

  return (
    <SectionCard id="anexos" title="Fotos, referências e documentos" hint="Fachada, acesso de retirada, contratos e propostas. Opcionais." step="04">
      <input ref={photoInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { enqueue(e.target.files, "FOTO"); e.target.value = ""; }} />
      <input ref={docInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { enqueue(e.target.files, "DOCUMENTO"); e.target.value = ""; }} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Camera size={16} aria-hidden /> Fotos ({photoCount}/{MAX_PHOTOS})
          </p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => photoInput.current?.click()}>
            <Upload size={14} /> Adicionar fotos
          </Button>
        </div>
        <p className="text-xs text-ink-muted">JPG, PNG ou WebP · até 8 MB por foto. Não são exigidas para locador ou serviço sem estabelecimento visitável.</p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {savedPhotos.map((photo) => (
            <li key={photo.id} className="flex gap-3 rounded-2xl border border-forest-950/10 p-2">
              {thumbs[photo.id] ? <img src={thumbs[photo.id]} alt={photo.caption || photo.fileName} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-xl bg-forest-950/5" />}
              <div className="flex min-w-0 flex-1 flex-col justify-between text-xs">
                <span className="break-words font-semibold text-ink-900">{photo.caption || photo.fileName}</span>
                <span className="text-ink-muted">{photo.photoKind}{photo.isPrimary ? " · fachada principal" : ""}</span>
                <button type="button" onClick={() => void removeSaved(photo)} className="flex min-h-11 w-fit items-center gap-1 font-semibold text-red-700 hover:underline">
                  <Trash2 size={12} /> Retirar
                </button>
              </div>
            </li>
          ))}
          {queue.filter((q) => q.kind === "FOTO").map((item) => (
            <li key={item.id} className="flex gap-3 rounded-2xl border border-dashed border-forest-700/40 p-2">
              {item.previewUrl && <img src={item.previewUrl} alt={item.file.name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
                <span className="break-words font-semibold text-ink-900">{item.file.name} · será enviada ao salvar</span>
                <SelectField
                  label="Tipo"
                  value={item.photoKind}
                  onChange={(e) => update(item.id, { photoKind: e.target.value as QueuedFile["photoKind"], primary: e.target.value === "Fachada" ? item.primary : false })}
                  options={[{ value: "Fachada", label: "Fachada" }, { value: "Interior", label: "Interior" }, { value: "Outra", label: "Outra referência" }]}
                />
                {item.photoKind === "Fachada" && (
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" checked={item.primary} onChange={(e) => update(item.id, { primary: e.target.checked })} className="h-5 w-5 accent-forest-700" /> Fachada principal
                  </label>
                )}
                <button type="button" onClick={() => dequeue(item.id)} className="flex min-h-11 w-fit items-center gap-1 font-semibold text-red-700 hover:underline">
                  <Trash2 size={12} /> Remover da fila
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-forest-950/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <FileText size={16} aria-hidden /> Documentos do fornecedor
          </p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => docInput.current?.click()}>
            <Upload size={14} /> Adicionar documentos
          </Button>
        </div>
        <p className="text-xs text-ink-muted">Contratos, propostas e documentos cadastrais (PDF, JPG, PNG ou WebP, até 10 MB). Notas fiscais pertencem às compras e não são anexadas aqui.</p>
        <ul className="flex flex-col divide-y divide-forest-950/5">
          {savedDocs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 break-words">{doc.fileName}</span>
              <span className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void open(doc)}>Abrir</Button>
                <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void removeSaved(doc)}>Retirar</Button>
              </span>
            </li>
          ))}
          {queue.filter((q) => q.kind === "DOCUMENTO").map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 break-words">{item.file.name} <span className="text-xs text-ink-muted">· será enviado ao salvar</span></span>
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => dequeue(item.id)}>Remover da fila</Button>
            </li>
          ))}
          {savedDocs.length === 0 && queue.every((q) => q.kind !== "DOCUMENTO") && <li className="py-2 text-sm text-ink-muted">Nenhum documento adicionado.</li>}
        </ul>
      </div>
    </SectionCard>
  );
}
