import { type ReactNode } from "react";
import { FileCheck2, Package, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import type { EntryCartLine, LineErrors } from "@/lib/raw-material-entry";
import type { RawMaterial } from "@/types/raw-material";

interface EntryCartProps {
  cart: EntryCartLine[];
  materialById: Map<string, RawMaterial>;
  lineErrors: Record<string, LineErrors>;
  totals: { items: number; value: number };
  formError: string;
  saving: boolean;
  onUpdate: <K extends keyof EntryCartLine>(lineId: string, key: K, value: EntryCartLine[K]) => void;
  onRemove: (lineId: string) => void;
  onClear: () => void;
  onSaveDraft: () => void;
  onConfirm: () => void;
}

const fieldClasses =
  "h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-ink-muted lg:sr-only">{label}</span>
      {children}
      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </label>
  );
}

const border = (error?: string) => (error ? "border-red-500" : "border-ink-900/15");

export function EntryCart({ cart, materialById, lineErrors, totals, formError, saving, onUpdate, onRemove, onClear, onSaveDraft, onConfirm }: EntryCartProps) {
  return (
    <section aria-labelledby="carrinho-entrada" className="flex flex-col rounded-3xl border border-forest-950/10 bg-white">
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-3">
          <ShoppingCart size={24} className="text-forest-900" aria-hidden />
          <h2 id="carrinho-entrada" className="text-xl font-extrabold text-forest-950">
            Carrinho da Entrada
          </h2>
          <span
            aria-label={`${totals.items} itens`}
            className="flex h-6 min-w-6 items-center justify-center rounded-full bg-forest-700 px-2 text-xs font-bold text-cream-50"
          >
            {totals.items}
          </span>
        </div>
        {cart.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={onClear} className="border-red-500/40 text-red-600 hover:bg-red-500/5">
            <Trash2 size={14} /> Limpar carrinho
          </Button>
        )}
      </div>

      <div className="hidden grid-cols-[minmax(0,1fr)_88px_96px_104px_88px_32px] gap-2 bg-cream-50 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-700 lg:grid">
        <span>Insumo</span>
        <span>Qtd</span>
        <span>Un</span>
        <span>Valor (R$)</span>
        <span className="text-right">Total (R$)</span>
        <span />
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-14 text-center">
          <ShoppingCart size={32} className="text-forest-700/40" aria-hidden />
          <p className="text-sm font-semibold text-ink-900">Nenhum insumo no carrinho</p>
          <p className="text-xs text-ink-muted">Use "Adicionar" na lista ao lado para montar a entrada.</p>
        </div>
      ) : (
        <ul className="flex min-h-64 flex-1 flex-col divide-y divide-forest-950/5 overflow-y-auto">
          {cart.map((line) => {
            const material = materialById.get(line.rawMaterialId);
            if (!material) return null;
            const errors = lineErrors[line.lineId] ?? {};
            const controlQuantity = line.packagesQuantity * material.purchaseUnitFactor;
            const unitLabel = material.purchaseUnitLabel || material.controlUnit;
            return (
              <li key={line.lineId} className="px-5 py-3">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_88px_96px_104px_88px_32px] lg:items-center">
                  <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                    {material.imageUrl ? (
                      <img src={material.imageUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-950/5 text-forest-950/30">
                        <Package size={18} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{material.name}</p>
                      <p className="font-mono text-xs text-ink-muted">{material.code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.lineId)}
                      aria-label={`Remover ${material.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-red-500/10 hover:text-red-600 lg:hidden"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <Field label="Quantidade" error={errors.packagesQuantity}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0.0001}
                      step="any"
                      value={line.packagesQuantity}
                      onChange={(e) => onUpdate(line.lineId, "packagesQuantity", Number(e.target.value))}
                      aria-label={`Quantidade de ${material.name}`}
                      className={cn(fieldClasses, border(errors.packagesQuantity))}
                    />
                  </Field>

                  <div className="flex min-w-0 flex-col justify-end gap-1">
                    <span className="text-[11px] font-medium text-ink-muted lg:sr-only">Unidade</span>
                    <span title={unitLabel} className="truncate text-sm text-ink-700 lg:py-0 py-2.5">
                      {unitLabel}
                    </span>
                  </div>

                  <Field label="Valor por unidade (R$)" error={errors.unitPrice}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) => onUpdate(line.lineId, "unitPrice", Number(e.target.value))}
                      aria-label={`Valor unitário de ${material.name}`}
                      className={cn(fieldClasses, border(errors.unitPrice))}
                    />
                  </Field>

                  <p className="text-right text-sm font-extrabold text-ink-900 lg:col-auto col-span-2">
                    <span className="mr-2 text-[11px] font-medium text-ink-muted lg:hidden">Total</span>
                    {formatCurrency(line.packagesQuantity * line.unitPrice)}
                  </p>

                  <button
                    type="button"
                    onClick={() => onRemove(line.lineId)}
                    aria-label={`Remover ${material.name}`}
                    className="hidden h-8 w-8 items-center justify-center rounded-full text-ink-700 hover:bg-red-500/10 hover:text-red-600 lg:flex"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-cream-50 p-2 lg:ml-14">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-medium text-ink-muted">Lote</span>
                    <input
                      value={line.batch}
                      onChange={(e) => onUpdate(line.lineId, "batch", e.target.value)}
                      placeholder="Ex.: L2409"
                      aria-label={`Lote de ${material.name}`}
                      className={cn(fieldClasses, "h-10", border(errors.batch))}
                    />
                    {errors.batch && <span className="text-[11px] font-semibold text-red-600">{errors.batch}</span>}
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-medium text-ink-muted">Validade</span>
                    <input
                      type="date"
                      value={line.expiryDate}
                      onChange={(e) => onUpdate(line.lineId, "expiryDate", e.target.value)}
                      aria-label={`Validade de ${material.name}`}
                      className={cn(fieldClasses, "h-10", border(errors.expiryDate))}
                    />
                    {errors.expiryDate && <span className="text-[11px] font-semibold text-red-600">{errors.expiryDate}</span>}
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted lg:ml-14">
                  Entra no estoque: {controlQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {material.controlUnit}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-2 rounded-2xl bg-forest-700/10 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-ink-700">
            <span>Total de itens</span>
            <span className="font-semibold text-ink-900">{totals.items}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-ink-900">Valor total da entrada</span>
            <span className="text-2xl font-extrabold text-forest-700">{formatCurrency(totals.value)}</span>
          </div>
        </div>

        {formError && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {formError}
          </p>
        )}

        <Button type="button" size="lg" variant="secondary" disabled={saving} onClick={onConfirm} className="w-full">
          <FileCheck2 size={20} /> {saving ? "Confirmando..." : "Confirmar Entrada"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onSaveDraft} className="w-full text-ink-700">
          {saving ? "Salvando..." : "Salvar como rascunho (não altera o estoque)"}
        </Button>
      </div>
    </section>
  );
}
