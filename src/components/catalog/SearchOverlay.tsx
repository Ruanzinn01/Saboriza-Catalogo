import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { ProductImage } from "./ProductImage";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatProductTitle } from "@/lib/product-title";
import { formatCurrency } from "@/lib/currency";
import { useCatalogStore } from "@/store/catalog-store";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: string) => void;
}

export function SearchOverlay({ open, onClose, onSelectCategory }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const products = useCatalogStore((state) => state.products.filter((product) => product.active));
  const categories = useCatalogStore((state) => state.categories.filter((category) => category.active));

  const normalizedQuery = query.trim().toLowerCase();

  const matchedCategories = useMemo(() => {
    if (!normalizedQuery) return [];
    return categories.filter((category) => category.name.toLowerCase().includes(normalizedQuery));
  }, [categories, normalizedQuery]);

  const matchedProducts = useMemo(() => {
    if (!normalizedQuery) return [];
    return products.filter((product) => formatProductTitle(product).toLowerCase().includes(normalizedQuery)).slice(0, 8);
  }, [products, normalizedQuery]);

  function handleClose() {
    setQuery("");
    onClose();
  }

  function handleSelectCategory(categoryId: string) {
    onSelectCategory(categoryId);
    handleClose();
  }

  function handleSelectProduct(productId: string) {
    handleClose();
    requestAnimationFrame(() => {
      document.getElementById(`product-${productId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Buscar no catálogo">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome do produto ou categoria..."
            className="h-12 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>

        {!normalizedQuery && (
          <p className="py-8 text-center text-sm text-ink-700/50">Digite para buscar produtos ou categorias.</p>
        )}

        {normalizedQuery && matchedCategories.length === 0 && matchedProducts.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-700/50">Nenhum resultado para "{query}".</p>
        )}

        {matchedCategories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-700/40">Categorias</p>
            {matchedCategories.map((category) => {
              const Icon = getCategoryIcon(category.slug);
              return (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category.id)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-forest-950/5"
                >
                  <Icon size={16} className="shrink-0 text-forest-700" />
                  <span className="text-sm font-semibold text-ink-900">{category.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {matchedProducts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-700/40">Produtos</p>
            {matchedProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelectProduct(product.id)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-forest-950/5"
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-forest-950/5">
                  <ProductImage imageUrl={product.imageUrl} name={product.name} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink-900">{formatProductTitle(product)}</span>
                  <span className="text-xs text-ink-700/60">{formatCurrency(product.unitPrice)} / unid</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
