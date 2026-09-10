import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { useCatalogStore } from "@/store/catalog-store";
import { Button } from "@/components/ui/Button";
import { RowActionsMenu } from "@/components/admin/RowActionsMenu";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AdminState } from "@/components/admin/AdminState";
import type { Product } from "@/types/product";

type StatusFilter = "all" | "active" | "inactive";

export function ProductsPage() {
  const allProducts = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const status = useCatalogStore((state) => state.status);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const removeProduct = useCatalogStore((state) => state.removeProduct);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productDeleteBlocked, setProductDeleteBlocked] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function handleDeleteClick(product: Product) {
    const { count, error } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id);

    if (error) {
      toast.error("Não foi possível verificar o histórico do produto");
      return;
    }

    setProductDeleteBlocked((count ?? 0) > 0);
    setProductToDelete(product);
  }

  const categoryFilter = searchParams.get("categoria");
  const filteredCategory = categoryFilter ? categories.find((category) => category.id === categoryFilter) : undefined;

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allProducts.filter((product) => {
      const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? product.active : !product.active);
      const matchesQuery = !query || product.name.toLowerCase().includes(query);
      return matchesCategory && matchesStatus && matchesQuery;
    });
  }, [allProducts, categoryFilter, statusFilter, search]);

  function categoryName(categoryId: string) {
    return categories.find((category) => category.id === categoryId)?.name ?? "Sem categoria";
  }

  function handleCategorySelect(value: string) {
    if (!value) {
      setSearchParams({});
    } else {
      setSearchParams({ categoria: value });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Produtos</h1>
          <p className="text-sm text-ink-700/60">Gerencie os produtos disponíveis no catálogo.</p>
        </div>
        <Link to="/admin/produtos/novo">
          <Button className="w-full sm:w-auto">
            <Plus size={18} /> Novo produto
          </Button>
        </Link>
      </div>

      {filteredCategory && (
        <div className="flex items-center gap-2 rounded-full bg-forest-950/5 px-4 py-2 text-sm text-forest-900 w-fit">
          <span>
            Filtrando por: <strong>{filteredCategory.name}</strong>
          </span>
          <button
            onClick={() => setSearchParams({})}
            aria-label="Limpar filtro"
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-forest-950/10"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <select
          value={categoryFilter ?? ""}
          onChange={(e) => handleCategorySelect(e.target.value)}
          className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {status === "loading" && allProducts.length === 0 ? (
        <AdminState variant="loading" message="Carregando produtos..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os produtos. Tente recarregar a página." />
      ) : products.length === 0 ? (
        <AdminState variant="empty" message="Nenhum produto encontrado." />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{product.name}</p>
                      <p className="text-xs text-ink-700/50">
                        {product.presentation} · {product.weight}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{categoryName(product.categoryId)}</td>
                    <td className="px-4 py-3 text-ink-700/70">
                      <p>{formatCurrency(product.unitPrice)}/unidade</p>
                      <p className="text-xs text-ink-700/50">
                        Pack {product.packQuantity} un · {formatCurrency(product.unitPrice * product.packQuantity)}/pack
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateProduct(product.id, { active: !product.active })}
                        className={
                          product.active
                            ? "rounded-full bg-forest-700/10 px-3 py-1 text-xs font-bold text-forest-800"
                            : "rounded-full bg-ink-900/10 px-3 py-1 text-xs font-bold text-ink-700/60"
                        }
                      >
                        {product.active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/produtos/${product.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                        >
                          <Pencil size={16} />
                        </Link>
                        <RowActionsMenu
                          items={[
                            {
                              label: "Excluir permanentemente",
                              icon: <Trash2 size={16} />,
                              destructive: true,
                              onClick: () => handleDeleteClick(product),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {products.map((product) => (
              <div key={product.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{product.name}</p>
                    <p className="text-xs text-ink-700/50">
                      {product.presentation} · {product.weight}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-700/60">{categoryName(product.categoryId)}</p>
                  </div>
                  <RowActionsMenu
                    items={[
                      {
                        label: "Excluir permanentemente",
                        icon: <Trash2 size={16} />,
                        destructive: true,
                        onClick: () => handleDeleteClick(product),
                      },
                    ]}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink-900">{formatCurrency(product.unitPrice)}/unidade</p>
                    <p className="text-xs text-ink-700/50">
                      Pack {product.packQuantity} un · {formatCurrency(product.unitPrice * product.packQuantity)}/pack
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateProduct(product.id, { active: !product.active })}
                      className={
                        product.active
                          ? "rounded-full bg-forest-700/10 px-3 py-1 text-xs font-bold text-forest-800"
                          : "rounded-full bg-ink-900/10 px-3 py-1 text-xs font-bold text-ink-700/60"
                      }
                    >
                      {product.active ? "Ativo" : "Inativo"}
                    </button>
                    <Link
                      to={`/admin/produtos/${product.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                    >
                      <Pencil size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {productToDelete && productDeleteBlocked ? (
        <ConfirmDialog
          open
          onClose={() => setProductToDelete(null)}
          title="Não é possível excluir este produto"
          description="Este produto possui histórico de pedidos e não pode ser excluído permanentemente. Você pode desativá-lo."
          cancelLabel="Fechar"
        />
      ) : (
        <ConfirmDialog
          open={productToDelete !== null}
          onClose={() => setProductToDelete(null)}
          title="Excluir produto permanentemente?"
          description={
            <>
              <strong className="text-ink-900">{productToDelete?.name ?? ""}</strong> será removido do catálogo e não poderá
              ser recuperado. Se for só uma pausa nas vendas, prefira marcar como Inativo em vez de excluir.
            </>
          }
          confirmLabel="Excluir"
          destructive
          onConfirm={() => {
            if (!productToDelete) return;
            removeProduct(productToDelete.id);
            setProductToDelete(null);
          }}
        />
      )}
    </div>
  );
}
