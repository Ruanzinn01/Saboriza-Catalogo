import { Link } from "react-router-dom";
import { Copy, Pencil } from "lucide-react";
import { MarginChip, SetupAlertChip, StockMeter, StockStatusPill } from "@/components/admin/ProductListParts";
import { ProductRowMenu, type ProductRowActions } from "@/components/admin/ProductRowMenu";
import { ProductImage } from "@/components/catalog/ProductImage";
import { formatCurrency } from "@/lib/currency";
import type { ProductRow } from "@/lib/product-list";

export function ProductsMobileList({ rows, actions }: { rows: ProductRow[]; actions: ProductRowActions }) {
  return (
    <ul className="flex flex-col gap-3 p-3 lg:hidden">
      {rows.map((row) => {
        const { product } = row;
        return (
          <li key={product.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => actions.onEditImage(product.id)}
                  aria-label={`Alterar imagem de ${product.name}`}
                  className="flex h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-forest-950/10"
                >
                  <ProductImage imageUrl={product.imageUrl} name={product.name} />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-900">{product.name}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {product.code || "—"} · {row.categoryName}
                  </p>
                  <p className="text-xs text-ink-muted">{[product.presentation, product.weight].filter(Boolean).join(" - ")}</p>
                  <SetupAlertChip gaps={row.gaps} />
                  {!product.active && (
                    <span className="mt-1 inline-block rounded-full bg-ink-900/10 px-2 py-0.5 text-[11px] font-bold text-ink-700">Inativo</span>
                  )}
                </div>
              </div>
              <ProductRowMenu product={product} actions={actions} />
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <Link to={`/admin/estoque/${product.id}`} className="rounded-lg">
                <StockMeter name={product.name} currentStock={product.currentStock} minStock={product.minStock} maxStock={product.maxStock} bucket={row.bucket} />
              </Link>
              <div className="text-right">
                <p className="text-sm font-bold text-ink-900">{formatCurrency(product.unitPrice)}/un</p>
                <p className="text-xs text-ink-muted">
                  Pack {product.packQuantity} un - {formatCurrency(product.unitPrice * product.packQuantity)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StockStatusPill bucket={row.bucket} />
                <MarginChip marginPct={row.marginPct} marginState={row.marginState} />
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/admin/produtos/${product.id}`}
                  aria-label={`Editar ${product.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                >
                  <Pencil size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => actions.onDuplicate(product)}
                  aria-label={`Duplicar ${product.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
