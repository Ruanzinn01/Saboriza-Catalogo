import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useStockStore } from "@/store/stock-store";
import type { Product } from "@/types/product";

interface StockActionSheetProps {
  mode: "entry" | "adjustment" | null;
  product: Product | null;
  onClose: () => void;
}

export function StockActionSheet({ mode, product, onClose }: StockActionSheetProps) {
  const createEntry = useStockStore((state) => state.createEntry);
  const adjustStock = useStockStore((state) => state.adjustStock);

  const [quantity, setQuantity] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode) {
      setQuantity("");
      setObservation("");
    }
  }, [mode, product?.id]);

  if (!product) return null;

  const diff = mode === "adjustment" && quantity !== "" ? Number(quantity) - product.currentStock : null;

  async function handleSubmit() {
    if (!product) return;
    const value = Number(quantity);
    if (Number.isNaN(value) || value < 0) return;
    if (mode === "entry" && value <= 0) return;
    if (mode === "adjustment" && observation.trim() === "") return;

    setSaving(true);
    const ok =
      mode === "entry" ? await createEntry(product.id, value, observation.trim()) : await adjustStock(product.id, value, observation.trim());
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      open={mode !== null}
      onClose={onClose}
      title={mode === "entry" ? "Entrada de estoque" : "Ajuste de estoque"}
      footer={
        <Button className="w-full" disabled={saving} onClick={() => void handleSubmit()}>
          {saving ? "Salvando..." : mode === "entry" ? "Registrar entrada" : "Registrar ajuste"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="text-sm font-semibold text-ink-900">{product.name}</p>
          <p className="text-xs text-ink-muted">{product.code} · Estoque atual: {product.currentStock} un</p>
        </div>

        {mode === "entry" ? (
          <Input
            label="Quantidade a acrescentar (un)"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        ) : (
          <Input
            label="Estoque físico contado (un)"
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}

        {diff !== null && !Number.isNaN(diff) && (
          <p className={`text-sm font-semibold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-forest-700" : "text-ink-muted"}`}>
            {product.currentStock} → {quantity || 0} · diferença de {diff > 0 ? "+" : ""}
            {diff}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">{mode === "adjustment" ? "Motivo (obrigatório)" : "Observação"}</span>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            className="rounded-xl border border-ink-900/15 bg-white p-3 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </label>
      </div>
    </Sheet>
  );
}
