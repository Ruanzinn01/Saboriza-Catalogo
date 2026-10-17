import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { packsLabel } from "@/lib/separation";
import type { SeparationItem } from "@/types/separation";

interface SeparationItemSheetProps {
  item: SeparationItem | null;
  readOnly: boolean;
  onClose: () => void;
  onConfirm: (itemId: string) => Promise<void>;
  onRequestAdjustment: (itemId: string, message: string) => Promise<void>;
  onReportShortage: (itemId: string, separatedUnits: number, reason: string, commandId: string) => Promise<boolean>;
}

export function SeparationItemSheet({ item, readOnly, onClose, onConfirm, onRequestAdjustment, onReportShortage }: SeparationItemSheetProps) {
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [shortageOpen, setShortageOpen] = useState(false);
  const [separatedInput, setSeparatedInput] = useState("");
  const [saving, setSaving] = useState(false);
  const shortageCommandId = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    shortageCommandId.current = crypto.randomUUID();
    setAdjustmentOpen(false);
    setShortageOpen(false);
    setSeparatedInput("");
    setMessage("");
  }, [item?.id]);

  if (!item) return null;

  async function handleConfirm() {
    if (!item) return;
    setSaving(true);
    await onConfirm(item.id);
    setSaving(false);
    onClose();
  }

  async function handleAdjustment() {
    if (!item || message.trim() === "") return;
    setSaving(true);
    await onRequestAdjustment(item.id, message.trim());
    setSaving(false);
    onClose();
  }

  const requested = item.totalUnits;
  const separatedUnits = separatedInput.trim() === "" ? null : Number(separatedInput);
  const shortageValid = separatedUnits !== null && Number.isInteger(separatedUnits) && separatedUnits >= 0 && separatedUnits < requested;

  async function handleShortage() {
    if (!item || !shortageValid || separatedUnits === null) return;
    setSaving(true);
    const ok = await onReportShortage(item.id, separatedUnits, message.trim(), shortageCommandId.current);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title={item.productName}
      footer={
        !readOnly &&
        !item.separatedAt && (
          <div className="flex flex-col gap-2">
            {shortageOpen ? (
              <>
                <label className="flex flex-col gap-1 text-sm font-semibold text-ink-900">
                  Quantas unidades você separou? (pedido: {requested})
                  <input
                    value={separatedInput}
                    onChange={(e) => setSeparatedInput(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className="min-h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-base font-bold text-forest-950 outline-none focus:border-forest-700"
                  />
                </label>
                {separatedInput.trim() !== "" && !shortageValid && (
                  <p role="alert" className="text-xs font-semibold text-red-600">Informe um número inteiro menor que {requested}.</p>
                )}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Motivo ou observação (opcional)"
                  rows={2}
                  className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
                />
                <Button disabled={saving || !shortageValid} className="w-full" onClick={() => void handleShortage()}>
                  {saving ? "Registrando..." : "Registrar falta"}
                </Button>
              </>
            ) : adjustmentOpen ? (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva a divergência encontrada..."
                  rows={3}
                  className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
                />
                <Button disabled={saving || message.trim() === ""} className="w-full" onClick={() => void handleAdjustment()}>
                  {saving ? "Enviando..." : "Enviar solicitação de ajuste"}
                </Button>
              </>
            ) : (
              <>
                <Button disabled={saving} className="w-full" onClick={() => void handleConfirm()}>
                  {saving ? "Confirmando..." : "FINALIZAR"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setAdjustmentOpen(true)}>
                  Solicitar ajuste
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShortageOpen(true)}>
                  Não localizei a quantidade pedida
                </Button>
              </>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName} className="h-48 w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-ink-900/5 text-ink-muted">
            <ImageOff size={28} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-ink-muted">
            {item.presentation} · {item.weightVolume}
          </p>
          <p className="text-2xl font-extrabold text-forest-950">{packsLabel(item.packsQuantity, item.packQuantity)}</p>
          <p className="text-xs text-ink-muted">quantidade pedida</p>
        </div>
        {!item.separatedAt && !readOnly && (
          <p className="text-sm font-semibold text-ink-900">
            {item.packsQuantity > 1 ? `Você encontrou os ${item.packsQuantity} packs?` : "Você encontrou a quantidade solicitada?"}
          </p>
        )}
        {item.separatedAt && (
          <p className="rounded-xl bg-forest-950/10 px-3 py-2 text-sm font-semibold text-forest-950">
            Separação confirmada em {new Date(item.separatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
