import { Package, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatProductTitle } from "@/lib/product-title";
import { formatCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/number";
import { ProductBadgeTag } from "@/components/ui/Badge";
import { ProductImage } from "./ProductImage";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  embedded?: boolean;
}

export function ProductCard({ product, onAdd, embedded = false }: ProductCardProps) {
  return (
    <article
      id={`product-${product.id}`}
      className={cn(
        "group relative flex scroll-mt-32 flex-col overflow-hidden bg-white",
        embedded ? "rounded-2xl" : "rounded-3xl border border-forest-950/10 shadow-sm transition-shadow hover:shadow-md"
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-forest-950/5">
        <ProductImage imageUrl={product.imageUrl} name={product.name} />
        {product.badge && <ProductBadgeTag badge={product.badge} />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-bold leading-tight text-ink-900">{formatProductTitle(product)}</h3>
        <p className="line-clamp-2 text-sm text-ink-700/70">{product.description}</p>
        <div className="mt-auto flex flex-col pt-2">
          <span className="text-lg font-extrabold text-forest-900">
            {formatCurrency(product.unitPrice)} <span className="text-xs font-medium text-ink-700/60">/ unid</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-xs text-ink-700/60">
            <Package size={12} /> Pack de {formatNumber(product.packQuantity)} un
          </span>
        </div>
        <button
          onClick={() => onAdd(product)}
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-2xl bg-linear-to-b from-forest-600 to-forest-800 text-sm font-bold text-cream-50 shadow-sm shadow-forest-950/20 transition-all hover:from-forest-500 hover:to-forest-700 active:scale-[0.98]"
        >
          <Plus size={18} /> Adicionar ao pedido
        </button>
      </div>
    </article>
  );
}
