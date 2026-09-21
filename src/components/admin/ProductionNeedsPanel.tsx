import { useMemo, useState } from "react";
import { Check, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockHealthDonut } from "@/components/admin/StockHealthDonut";
import { countProductHealth, type ProductionSuggestion } from "@/lib/production-suggestions";
import type { HealthLevel } from "@/lib/stock-insights";
import type { Product } from "@/types/product";

interface ProductionNeedsPanelProps {
  products: Product[];
  suggestions: ProductionSuggestion[];
  queuedProductIds: Set<string>;
  onSend: (productId: string, packs: number) => void;
  onSendAllCritical: () => void;
}

export function ProductionNeedsPanel({ products, suggestions, queuedProductIds, onSend, onSendAllCritical }: ProductionNeedsPanelProps) {
  const [levelFilter, setLevelFilter] = useState<HealthLevel | null>(null);
  const counts = useMemo(() => countProductHealth(products), [products]);

  const visible = useMemo(
    () => (levelFilter ? suggestions.filter((item) => item.level === levelFilter) : suggestions),
    [suggestions, levelFilter]
  );

  const pendingCritical = suggestions.filter((item) => (item.tone === "out" || item.tone === "critical") && !queuedProductIds.has(item.product.id));

  return (
    <section aria-labelledby="precisa-produzir" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="precisa-produzir" className="text-lg font-extrabold text-forest-950">
            O que precisa produzir
          </h2>
          <p className="text-xs text-ink-muted">Toque em uma fatia para filtrar. Sugestão baseada no estoque mínimo e nos pedidos confirmados.</p>
        </div>
        {pendingCritical.length > 0 && (
          <Button variant="secondary" size="md" onClick={onSendAllCritical}>
            <Send size={16} /> Enviar todos os críticos ({pendingCritical.length})
          </Button>
        )}
      </div>

      <StockHealthDonut
        green={counts.green}
        yellow={counts.yellow}
        red={counts.red}
        outOfStock={counts.outOfStock}
        selected={levelFilter}
        onSelect={(level) => setLevelFilter((current) => (current === level ? null : level))}
      />

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-forest-950/10 bg-white p-6 text-center text-sm text-ink-muted">
          {suggestions.length === 0
            ? "Nada urgente. Todos os produtos estão acima do estoque mínimo e sem pedido pendente."
            : "Nenhum produto nesta faixa. Toque de novo na fatia para limpar o filtro."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => {
            const queued = queuedProductIds.has(item.product.id);
            const demandDriven = item.level === "green";
            return (
              <li key={item.product.id} className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-forest-950/10" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink-900">{item.product.name}</p>
                      <StatusBadge tone={demandDriven ? "warning" : item.tone}>{demandDriven ? "Pedido pendente" : item.label}</StatusBadge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Estoque <span className="font-semibold text-ink-900">{item.product.currentStock} un</span> · Mínimo {item.product.minStock} un
                      {item.demandUnits > 0 && <> · Pedidos confirmados {item.demandUnits} un</>}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Faltam <span className="font-semibold text-ink-900">{Math.ceil(item.missingUnits)} un</span> · Pack de {item.product.packQuantity} un
                    </p>
                  </div>
                </div>
                {queued ? (
                  <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-700/10 px-4 text-sm font-semibold text-forest-800">
                    <Check size={16} /> Na lista de produção
                  </span>
                ) : (
                  <Button variant="primary" size="md" onClick={() => onSend(item.product.id, item.suggestedPacks)}>
                    <Send size={16} /> Enviar {item.suggestedPacks} pack{item.suggestedPacks > 1 ? "s" : ""}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
