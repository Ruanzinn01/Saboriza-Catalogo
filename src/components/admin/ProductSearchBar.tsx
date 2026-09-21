import { useId, useMemo, useState } from "react";
import { QrCode, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { situationLabel, situationTone } from "@/lib/stock-insights";
import type { Product } from "@/types/product";

interface ProductSearchBarProps {
  products: Product[];
  onPick: (productId: string) => void;
  onOpenScanner: () => void;
}

export function ProductSearchBar({ products, onPick, onOpenScanner }: ProductSearchBarProps) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return products
      .filter((product) => product.active && (product.name.toLowerCase().includes(text) || product.code.toLowerCase().includes(text)))
      .slice(0, 8);
  }, [products, query]);

  const showEmpty = query.trim().length > 0 && results.length === 0;

  function pick(productId: string) {
    onPick(productId);
    setQuery("");
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <label htmlFor={inputId} className="sr-only">
          Buscar produto por nome ou código
        </label>
        <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              pick(results[0].id);
            }
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Buscar outro produto por nome ou código..."
          className="h-14 w-full rounded-2xl border border-ink-900/15 bg-white pl-12 pr-4 text-base text-ink-900 outline-none focus:border-forest-700"
        />
        <div id={listId} role="listbox" aria-label="Produtos encontrados" hidden={results.length === 0 && !showEmpty}>
          {results.length > 0 && (
            <div className="absolute top-full z-10 mt-1 flex w-full flex-col divide-y divide-forest-950/5 overflow-hidden rounded-2xl border border-forest-950/10 bg-white shadow-lg">
              {results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(product.id)}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-left hover:bg-forest-950/5"
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-forest-950/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">{product.name}</p>
                    <p className="font-mono text-xs text-ink-muted">
                      {product.code} · Pack de {product.packQuantity} un · Estoque {product.currentStock} un
                    </p>
                  </div>
                  <StatusBadge tone={situationTone(product)} className="shrink-0">
                    {situationLabel(product)}
                  </StatusBadge>
                </button>
              ))}
            </div>
          )}
          {showEmpty && (
            <p className="absolute top-full z-10 mt-1 w-full rounded-2xl border border-forest-950/10 bg-white px-4 py-3 text-sm text-ink-muted shadow-lg">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenScanner}
        aria-label="Ler código de barras ou QR"
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-forest-950/15 bg-white text-forest-900 hover:bg-forest-950/5"
      >
        <QrCode size={22} />
      </button>
    </div>
  );
}
