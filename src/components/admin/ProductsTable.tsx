import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Copy, ImagePlus, Pencil } from "lucide-react";
import { MarginChip, StockMeter, StockStatusPill } from "@/components/admin/ProductListParts";
import { ProductRowMenu, type ProductRowActions } from "@/components/admin/ProductRowMenu";
import { SortableHeader } from "@/components/admin/SortableHeader";
import { ProductImage } from "@/components/catalog/ProductImage";
import { formatCurrency } from "@/lib/currency";
import type { ProductRow, SortKey, SortState } from "@/lib/product-list";

interface ProductsTableProps {
  rows: ProductRow[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  selectedIds: Set<string>;
  onToggleRow: (productId: string) => void;
  onTogglePage: () => void;
  actions: ProductRowActions;
}

const plainTh = "px-3 py-3 text-xs font-bold uppercase tracking-wide text-ink-700";

export function ProductsTable({ rows, sort, onSort, selectedIds, onToggleRow, onTogglePage, actions }: ProductsTableProps) {
  const headerRef = useRef<HTMLInputElement>(null);
  const selectedOnPage = rows.filter((row) => selectedIds.has(row.product.id)).length;
  const allSelected = rows.length > 0 && selectedOnPage === rows.length;

  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = selectedOnPage > 0 && !allSelected;
  }, [selectedOnPage, allSelected]);

  const sortable = (key: SortKey, label: string) => (
    <SortableHeader label={label} active={sort.key === key} dir={sort.dir} onSort={() => onSort(key)} />
  );

  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Lista de produtos</caption>
        <thead className="bg-cream-50">
          <tr>
            <th scope="col" className="w-10 px-3 py-3">
              <input
                ref={headerRef}
                type="checkbox"
                checked={allSelected}
                onChange={onTogglePage}
                aria-label="Selecionar todos os produtos da página"
                className="h-4 w-4 accent-forest-700"
              />
            </th>
            <th scope="col" className={plainTh}>
              Imagem
            </th>
            {sortable("code", "Código")}
            {sortable("name", "Produto")}
            {sortable("category", "Categoria")}
            {sortable("stock", "Estoque")}
            {sortable("price", "Preço")}
            <th scope="col" className={plainTh}>
              Margem
            </th>
            {sortable("status", "Status")}
            <th scope="col" className={plainTh}>
              Ações
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { product } = row;
            return (
              <tr key={product.id} className="border-t border-forest-950/5 align-middle hover:bg-forest-950/[0.02]">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => onToggleRow(product.id)}
                    aria-label={`Selecionar ${product.name}`}
                    className="h-4 w-4 accent-forest-700"
                  />
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => actions.onEditImage(product.id)}
                    aria-label={`Alterar imagem de ${product.name}`}
                    className="group relative flex h-14 w-14 overflow-hidden rounded-xl border border-forest-950/10"
                  >
                    <ProductImage imageUrl={product.imageUrl} name={product.name} />
                    <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 text-cream-50 opacity-0 transition-opacity group-hover:bg-ink-900/50 group-hover:opacity-100 group-focus-visible:bg-ink-900/50 group-focus-visible:opacity-100">
                      <ImagePlus size={18} />
                    </span>
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink-700/70">{product.code || "—"}</td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink-900">{product.name}</p>
                  <p className="text-xs text-ink-muted">{[product.presentation, product.weight].filter(Boolean).join(" - ")}</p>
                  {!product.active && (
                    <span className="mt-1 inline-block rounded-full bg-ink-900/10 px-2 py-0.5 text-[11px] font-bold text-ink-700">Inativo</span>
                  )}
                </td>
                <td className="px-3 py-3 text-ink-700/80">
                  <p>{row.categoryName}</p>
                  {row.supplierName && <p className="text-xs text-ink-muted">{row.supplierName}</p>}
                </td>
                <td className="px-3 py-3">
                  <Link to={`/admin/estoque/${product.id}`} title="Ver histórico de movimentação" className="block rounded-lg hover:bg-forest-950/5">
                    <StockMeter name={product.name} currentStock={product.currentStock} minStock={product.minStock} bucket={row.bucket} />
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <p className="font-bold text-ink-900">{formatCurrency(product.unitPrice)}/un</p>
                  <p className="text-xs text-ink-muted">
                    Pack {product.packQuantity} un - {formatCurrency(product.unitPrice * product.packQuantity)}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <MarginChip marginPct={row.marginPct} marginState={row.marginState} />
                </td>
                <td className="px-3 py-3">
                  <StockStatusPill bucket={row.bucket} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/produtos/${product.id}`}
                      aria-label={`Editar ${product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => actions.onDuplicate(product)}
                      aria-label={`Duplicar ${product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                    >
                      <Copy size={16} />
                    </button>
                    <ProductRowMenu product={product} actions={actions} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
