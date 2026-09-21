import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightLeft, BarChart3, Eye, PackagePlus, Search } from "lucide-react";
import { useCatalogStore } from "@/store/catalog-store";
import { AdminState } from "@/components/admin/AdminState";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StockActionSheet } from "@/components/admin/StockActionSheet";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency } from "@/lib/currency";
import { healthLevel, situationLabel, situationTone } from "@/lib/stock-insights";
import type { Product } from "@/types/product";

const iconButtonClasses = "flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5";

export function StockPage() {
  const products = useCatalogStore((state) => state.products);
  const status = useCatalogStore((state) => state.status);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);

  const [search, setSearch] = useState("");
  const [sheetMode, setSheetMode] = useState<"entry" | "adjustment" | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const summary = useMemo(() => {
    const totalValue = activeProducts.reduce((sum, product) => sum + product.currentStock * product.unitPrice, 0);
    const critical = activeProducts.filter((product) => healthLevel(product) === "red").length;
    const outOfStock = activeProducts.filter((product) => product.currentStock <= 0).length;
    return { total: activeProducts.length, critical, outOfStock, totalValue };
  }, [activeProducts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeProducts;
    return activeProducts.filter((product) => product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query));
  }, [activeProducts, search]);

  function openSheet(mode: "entry" | "adjustment", product: Product) {
    setSheetProduct(product);
    setSheetMode(mode);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Estoque"
        description="Saldo de produtos acabados ativos, alimentado por produção, entrada, pedido e ajuste."
        actions={
          <Link to="/admin/estoque/indicadores">
            <Button variant="outline" className="w-full sm:w-auto">
              <BarChart3 size={18} /> Indicadores de estoque
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Produtos ativos" value={summary.total} />
        <StatCard
          label="Itens críticos"
          value={summary.critical}
          tone={summary.critical > 0 ? "danger" : "default"}
          hint={`${summary.outOfStock} sem estoque`}
        />
        <StatCard label="Valor dos produtos acabados" value={formatCurrency(summary.totalValue)} hint="Calculado a preço de venda" />
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código..."
          aria-label="Buscar produto por nome ou código"
          className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        />
      </div>

      {status === "loading" && products.length === 0 ? (
        <AdminState variant="loading" message="Carregando estoque..." />
      ) : filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhum produto encontrado." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Estoque</th>
                  <th className="px-4 py-3">Mínimo</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{product.code}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/estoque/${product.id}`} className="font-semibold text-ink-900 hover:underline">
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{product.currentStock} un</td>
                    <td className="px-4 py-3 text-ink-700/70">{product.minStock}</td>
                    <td className="px-4 py-3 text-ink-700/70">{formatCurrency(product.unitPrice)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={situationTone(product)}>{situationLabel(product)}</StatusBadge>
                    </td>
                    <td className="px-4 py-1">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openSheet("entry", product)}
                          aria-label={`Entrada de estoque de ${product.name}`}
                          className={iconButtonClasses}
                        >
                          <PackagePlus size={16} />
                        </button>
                        <button
                          onClick={() => openSheet("adjustment", product)}
                          aria-label={`Ajuste de estoque de ${product.name}`}
                          className={iconButtonClasses}
                        >
                          <ArrowRightLeft size={16} />
                        </button>
                        <Link to={`/admin/estoque/${product.id}`} aria-label={`Ver movimentação de ${product.name}`} className={iconButtonClasses}>
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/admin/estoque/${product.id}`} className="min-w-0">
                    <p className="truncate font-extrabold text-forest-950">{product.name}</p>
                    <p className="font-mono text-xs text-ink-muted">{product.code}</p>
                  </Link>
                  <StatusBadge tone={situationTone(product)} className="shrink-0">
                    {situationLabel(product)}
                  </StatusBadge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {product.currentStock} un · mínimo {product.minStock}
                  </span>
                  <span>{formatCurrency(product.unitPrice)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="h-11 flex-1" onClick={() => openSheet("entry", product)}>
                    <PackagePlus size={14} /> Entrada
                  </Button>
                  <Button size="sm" variant="outline" className="h-11 flex-1" onClick={() => openSheet("adjustment", product)}>
                    <ArrowRightLeft size={14} /> Ajuste
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <StockActionSheet
        mode={sheetMode}
        product={sheetProduct}
        onClose={() => {
          setSheetMode(null);
          setSheetProduct(null);
        }}
      />
    </div>
  );
}
