import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import type { SeparationItem } from "@/types/separation";

interface SeparationItemSheetProps {
  item: SeparationItem | null;
  readOnly: boolean;
  onClose: () => void;
  onConfirm: (itemId: string) => Promise<void>;
  onRequestAdjustment: (itemId: string, message: string) => Promise<void>;
}

export function SeparationItemSheet({ item, readOnly, onClose, onConfirm, onRequestAdjustment }: SeparationItemSheetProps) {
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAdjustmentOpen(false);
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

  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title={item.productName}
      footer={
        !readOnly &&
        !item.separatedAt && (
          <div className="flex flex-col gap-2">
            {adjustmentOpen ? (
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
                  {saving ? "Confirmando..." : "CONFIRMAR SEPARAÇÃO"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setAdjustmentOpen(true)}>
                  Solicitar ajuste
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
          <p className="text-2xl font-extrabold text-forest-950">
            {item.totalUnits} de {item.totalUnits}
          </p>
          <p className="text-xs text-ink-muted">unidades pedidas</p>
        </div>
        {item.separatedAt && (
          <p className="rounded-xl bg-forest-950/10 px-3 py-2 text-sm font-semibold text-forest-950">
            Separação confirmada em {new Date(item.separatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
