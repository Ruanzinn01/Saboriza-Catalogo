import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ProductionAlertList } from "@/components/admin/ProductionAlertList";
import type { LineAlerts, ProductionLine } from "@/lib/production-alerts";
import type { Product } from "@/types/product";
import { formatNumber } from "@/lib/number";

interface ProductionReviewSheetProps {
  open: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  productById: Map<string, Product>;
  alertsByProduct: Record<string, LineAlerts>;
  totalUnits: number;
  saving: boolean;
  onConfirm: () => void;
}

export function ProductionReviewSheet({
  open,
  onClose,
  lines,
  productById,
  alertsByProduct,
  totalUnits,
  saving,
  onConfirm,
}: ProductionReviewSheetProps) {
  const warningCount = lines.filter((line) => {
    const info = alertsByProduct[line.productId];
    return info && (info.recipeMissing || info.alerts.length > 0);
  }).length;

  return (
    <Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Revisar produção"
      footer={
        <div className="flex flex-col gap-2">
          <Button size="lg" disabled={saving || lines.length === 0} onClick={onConfirm}>
            {saving ? "Registrando..." : "Confirmar e registrar"}
          </Button>
          <Button size="lg" variant="outline" disabled={saving} onClick={onClose}>
            Voltar e ajustar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-700/80">
          Confira antes de gravar. Ao confirmar, o estoque dos produtos sobe e os insumos da ficha técnica são descontados.
        </p>

        <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Total a registrar</p>
          <p className="mt-1 text-2xl font-extrabold text-forest-950">{formatNumber(totalUnits)} un</p>
          <p className="text-xs text-ink-muted">
            {lines.length} produto{lines.length > 1 ? "s" : ""}
          </p>
        </div>

        {warningCount > 0 && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs font-semibold text-amber-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {warningCount} item(ns) com aviso de insumo. A produção é registrada mesmo assim, mas o consumo fica limitado ao saldo em estoque.
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {lines.map((line) => {
            const product = productById.get(line.productId);
            if (!product) return null;
            return (
              <li key={line.productId} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-ink-900">{product.name}</p>
                  <p className="shrink-0 text-sm font-extrabold text-forest-950">{formatNumber(line.packs * product.packQuantity)} un</p>
                </div>
                <p className="text-xs text-ink-muted">
                  {formatNumber(line.packs)} pack{line.packs > 1 ? "s" : ""} × {formatNumber(product.packQuantity)} un · Estoque {formatNumber(product.currentStock)} un para{" "}
                  {formatNumber(product.currentStock + line.packs * product.packQuantity)} un
                </p>
                <ProductionAlertList lineAlerts={alertsByProduct[line.productId]} />
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
