import { AlertCircle, ClipboardList, Minus, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProductionAlertList } from "@/components/admin/ProductionAlertList";
import type { LineAlerts, ProductionLine } from "@/lib/production-alerts";
import type { Product } from "@/types/product";

interface ProductionListProps {
  lines: ProductionLine[];
  productById: Map<string, Product>;
  alertsByProduct: Record<string, LineAlerts>;
  failedById: Record<string, string>;
  totalUnits: number;
  saving: boolean;
  onSetPacks: (productId: string, packs: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}

const stepperButton =
  "flex h-11 w-11 items-center justify-center rounded-full border border-forest-950/15 text-forest-900 hover:bg-forest-950/5 disabled:opacity-40";

export function ProductionList({
  lines,
  productById,
  alertsByProduct,
  failedById,
  totalUnits,
  saving,
  onSetPacks,
  onRemove,
  onClear,
  onSubmit,
}: ProductionListProps) {
  return (
    <section aria-labelledby="lista-producao" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="lista-producao" className="text-lg font-extrabold text-forest-950">
          Lista de produção
        </h2>
        {lines.length > 0 && (
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-xs font-semibold text-red-600 hover:underline">
            Limpar lista
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-forest-950/20 bg-white/60 p-6 text-center">
          <ClipboardList size={28} className="text-forest-700/50" aria-hidden />
          <p className="text-sm font-semibold text-ink-900">Nenhum item na lista</p>
          <p className="text-xs text-ink-muted">Use "Enviar" em um produto que precisa ser produzido, ou busque outro produto acima.</p>
        </div>
      ) : (
        <>
          <div className="hidden flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 lg:flex">
            <p className="text-sm font-semibold text-ink-700/70">
              Total: <span className="text-lg font-extrabold text-forest-950">{totalUnits} un</span> em {lines.length} produto{lines.length > 1 ? "s" : ""}
            </p>
            <Button size="lg" disabled={saving} onClick={onSubmit}>
              <Send size={18} /> {saving ? "Registrando..." : "Enviar para produção"}
            </Button>
          </div>

          <ul className="flex flex-col gap-3 lg:max-h-[calc(100dvh-17rem)] lg:overflow-y-auto lg:pr-1">
            {lines.map((line) => {
              const product = productById.get(line.productId);
              if (!product) return null;
              const failure = failedById[line.productId];
              return (
                <li
                  key={line.productId}
                  className={`rounded-2xl border bg-white p-4 ${failure ? "border-red-500/40" : "border-forest-950/10"}`}
                >
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-forest-950/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink-900">{product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {line.packs} pack{line.packs > 1 ? "s" : ""} × {product.packQuantity} un ={" "}
                        <span className="font-semibold text-ink-900">{line.packs * product.packQuantity} unidades</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.productId)}
                      aria-label={`Remover ${product.name}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSetPacks(line.productId, line.packs - 1)}
                      disabled={line.packs <= 1}
                      aria-label={`Diminuir packs de ${product.name}`}
                      className={stepperButton}
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={line.packs}
                      onChange={(e) => onSetPacks(line.productId, Number(e.target.value))}
                      aria-label={`Quantidade de packs de ${product.name}`}
                      className="h-11 w-20 rounded-xl border border-ink-900/15 bg-white text-center text-lg font-extrabold text-forest-950 outline-none focus:border-forest-700"
                    />
                    <button
                      type="button"
                      onClick={() => onSetPacks(line.productId, line.packs + 1)}
                      aria-label={`Aumentar packs de ${product.name}`}
                      className={stepperButton}
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <ProductionAlertList lineAlerts={alertsByProduct[line.productId]} />

                  {failure && (
                    <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      Não registrado: {failure}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

        </>
      )}
    </section>
  );
}
