import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { addQuote, type CandidateQuote, listFiles, listQuotes, removeFile, signedFileUrl, type SupplierFile, uploadSupplierFile } from "@/lib/supplier-api";
import { formatBrl, formatDateBr } from "@/lib/supplier-finance";
import { parseBrlToCents } from "@/lib/supplier-form";
import { friendlyRpcError } from "@/lib/supplier-rpc";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import type { SupplierCandidate } from "@/types/supplier";

const emptyQuote = { item: "", unit: "", quantity: "", price: "", freight: "0,00", validUntil: "", source: "" };

// Cotações e arquivos de referência da avaliação. Cotação é estimativa: não é compra, obrigação nem limite.
export function SupplierCandidateReferences({ candidate, onClose }: { candidate: SupplierCandidate; onClose: () => void }) {
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const [files, setFiles] = useState<SupplierFile[] | null>(null);
  const [quotes, setQuotes] = useState<CandidateQuote[]>([]);
  const [quote, setQuote] = useState(emptyQuote);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const readOnly = candidate.stage === "CADASTRADO";

  const reload = useCallback(async () => {
    setFiles(await listFiles({ candidateId: candidate.id }));
    setQuotes(await listQuotes(candidate.id));
  }, [candidate.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleUpload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    for (const file of Array.from(list)) {
      const result = await uploadSupplierFile({ candidateId: candidate.id, kind: "REFERENCIA", file });
      if (!result.ok) toast.error(`${file.name}: ${result.error}`);
    }
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
    await reload();
  }

  async function openFile(file: SupplierFile) {
    const url = await signedFileUrl(file.storagePath);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo (sem permissão ou indisponível).");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRemove(file: SupplierFile) {
    const { error } = await removeFile(file.id);
    if (error) toast.error(friendlyRpcError(error, "Não foi possível retirar o arquivo"));
    await reload();
  }

  async function handleQuote(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(quote.quantity.replace(",", "."));
    const price = parseBrlToCents(quote.price);
    const freight = parseBrlToCents(quote.freight);
    if (!quote.item.trim() || !quote.unit.trim()) return setQuoteError("Informe o item e a unidade/apresentação.");
    if (!(quantity > 0)) return setQuoteError("Informe uma quantidade maior que zero.");
    if (price === null || quote.price.trim() === "") return setQuoteError("Informe o preço, com vírgula para centavos.");
    if (freight === null) return setQuoteError("Confira o frete, com vírgula para centavos.");
    setQuoteError("");
    setBusy(true);
    const { error } = await addQuote(candidate.id, {
      item: quote.item.trim(),
      unit: quote.unit.trim(),
      quantity,
      priceCents: price,
      freightCents: freight,
      validUntil: quote.validUntil,
      source: quote.source.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível registrar a cotação"));
      return;
    }
    toast.success("Cotação registrada. Ela não cria compra, obrigação ou limite.");
    setQuote(emptyQuote);
    await reload();
  }

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-6" aria-label={`Cotações e arquivos de ${candidate.tradeName}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-forest-950">Cotações e arquivos · {candidate.tradeName}</p>
          <p className="text-xs text-ink-muted">Catálogos, propostas e cotações de referência. Nada aqui cria compra, dívida ou limite.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Arquivos de referência</p>
        {files === null ? (
          <p className="text-sm text-ink-muted">Arquivos indisponíveis para o seu perfil.</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum arquivo anexado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-forest-950/5">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 break-words">
                  <Paperclip size={14} className="mr-1 inline" aria-hidden />
                  {file.fileName} <span className="text-xs text-ink-muted">· {formatDateBr(file.uploadedAt)}</span>
                </span>
                <span className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void openFile(file)}>
                    Abrir
                  </Button>
                  {!readOnly && permissions["fornecedores.anexos"] && (
                    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void handleRemove(file)}>
                      Retirar
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {permissions["fornecedores.anexos"] && (
          <>
            <input ref={fileInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => void handleUpload(e.target.files)} />
            <Button type="button" variant="outline" className="min-h-11 w-fit" disabled={busy} onClick={() => fileInput.current?.click()}>
              Adicionar arquivos
            </Button>
            <p className="text-xs text-ink-muted">PDF, JPG, PNG ou WebP, até 10 MB por arquivo.</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Cotações de referência</p>
        {quotes.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma cotação registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {quotes.map((item) => (
              <li key={item.id} className="rounded-2xl bg-forest-950/5 p-3 text-sm">
                <strong className="text-ink-900">{item.item}</strong> · {item.quantity.toLocaleString("pt-BR")} {item.unit} × {formatBrl(item.priceCents)} / {item.unit}
                <br />
                Frete cotado {formatBrl(item.freightCents)} · cotado em {formatDateBr(item.quotedOn)} · validade {formatDateBr(item.validUntil)}
                {item.source && <> · fonte: {item.source}</>}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && permissions["fornecedores.manage"] && (
          <form onSubmit={handleQuote} className="mt-2 flex flex-col gap-3 rounded-2xl border border-forest-950/10 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input label="Item" value={quote.item} onChange={(e) => setQuote({ ...quote, item: e.target.value })} />
              <Input label="Unidade / apresentação" value={quote.unit} placeholder="kg, caixa 10 kg..." onChange={(e) => setQuote({ ...quote, unit: e.target.value })} />
              <Input label="Quantidade" inputMode="decimal" value={quote.quantity} onChange={(e) => setQuote({ ...quote, quantity: e.target.value })} />
              <Input label="Preço por unidade · R$" inputMode="decimal" value={quote.price} onChange={(e) => setQuote({ ...quote, price: e.target.value })} />
              <Input label="Frete cotado · R$" inputMode="decimal" value={quote.freight} onChange={(e) => setQuote({ ...quote, freight: e.target.value })} />
              <Input label="Validade" type="date" value={quote.validUntil} onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })} />
            </div>
            <Input label="Fonte (e-mail, telefone, catálogo...)" value={quote.source} onChange={(e) => setQuote({ ...quote, source: e.target.value })} />
            {quoteError && <p className="text-xs text-red-600">{quoteError}</p>}
            <Button type="submit" variant="secondary" className="min-h-11 w-fit" disabled={busy}>
              Registrar cotação
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
