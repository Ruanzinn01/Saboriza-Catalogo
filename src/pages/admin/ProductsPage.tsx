import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCatalogStore } from "@/store/catalog-store";
import { useProductRecipeStore } from "@/store/product-recipe-store";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import { Button } from "@/components/ui/Button";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { ProductImageSheet } from "@/components/admin/ProductImageSheet";
import type { ProductRowActions } from "@/components/admin/ProductRowMenu";
import { ProductsFilterSheet } from "@/components/admin/ProductsFilterSheet";
import { ProductsKpiCards } from "@/components/admin/ProductsKpiCards";
import { ProductsMobileList } from "@/components/admin/ProductsMobileList";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { paginate } from "@/lib/pagination";
import { buildDuplicateDraft } from "@/lib/product-duplicate";
import {
  EMPTY_FILTERS,
  buildKpis,
  buildProductRows,
  countActiveFilters,
  filterRows,
  sortRows,
  type ProductFilters,
  type SortKey,
  type SortState,
} from "@/lib/product-list";
import type { Product } from "@/types/product";

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700";

export function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allProducts = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const catalogStatus = useCatalogStore((state) => state.status);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const setActiveMany = useCatalogStore((state) => state.setActiveMany);
  const removeProduct = useCatalogStore((state) => state.removeProduct);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const recipesByProduct = useProductRecipeStore((state) => state.linesByProduct);
  const fetchRecipesFor = useProductRecipeStore((state) => state.fetchRecipesFor);

  const [localFilters, setLocalFilters] = useState<Omit<ProductFilters, "categoryId">>({
    search: "",
    active: "all",
    stock: "all",
    margin: "all",
    supplierId: "",
  });
  const [sort, setSort] = useState<SortState>({ key: "code", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productDeleteBlocked, setProductDeleteBlocked] = useState(false);
  const [imageEditProductId, setImageEditProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
    if (suppliers.length === 0) fetchSuppliers();
    if (materials.length === 0) fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const missingRecipeKey = allProducts
    .filter((product) => recipesByProduct[product.id] === undefined)
    .map((product) => product.id)
    .join(",");

  useEffect(() => {
    if (missingRecipeKey) void fetchRecipesFor(missingRecipeKey.split(","));
  }, [missingRecipeKey, fetchRecipesFor]);

  const filters: ProductFilters = { ...localFilters, categoryId: searchParams.get("categoria") ?? "" };
  const advancedCount = Number(filters.margin !== "all") + Number(filters.supplierId !== "");
  const activeFilterCount = countActiveFilters(filters);

  function patchFilters(patch: Partial<ProductFilters>) {
    const { categoryId, ...rest } = patch;
    if (categoryId !== undefined) setSearchParams(categoryId ? { categoria: categoryId } : {});
    if (Object.keys(rest).length > 0) setLocalFilters((current) => ({ ...current, ...rest }));
    setPage(1);
  }

  function clearFilters() {
    setSearchParams({});
    setLocalFilters({ search: "", active: "all", stock: "all", margin: "all", supplierId: "" });
    setPage(1);
  }

  const rows = useMemo(
    () => buildProductRows(allProducts, categories, suppliers, recipesByProduct, materials),
    [allProducts, categories, suppliers, recipesByProduct, materials]
  );
  const kpis = useMemo(() => buildKpis(allProducts), [allProducts]);
  const visibleRows = useMemo(
    () => sortRows(filterRows(rows, filters), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, localFilters, searchParams, sort]
  );
  const pageData = paginate(visibleRows, page, pageSize);

  function handleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

  function toggleRow(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function togglePage() {
    const ids = pageData.items.map((row) => row.product.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function bulkSetActive(active: boolean) {
    setActiveMany([...selectedIds], active);
    setSelectedIds(new Set());
  }

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

  const actions: ProductRowActions = {
    onEditImage: setImageEditProductId,
    onDuplicate: (product) => {
      toast.info("Cópia aberta. Ajuste os dados e salve. A ficha técnica não é copiada.");
      navigate("/admin/produtos/novo", { state: { duplicateOf: buildDuplicateDraft(product) } });
    },
    onToggleActive: (product) => updateProduct(product.id, { active: !product.active }),
    onDelete: (product) => void handleDeleteClick(product),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
        <div className="2xl:w-72 2xl:shrink-0">
          <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">Produtos</h1>
          <p className="text-sm text-ink-muted">Gerencie os produtos disponíveis no catálogo.</p>
        </div>
        <div className="2xl:flex-1">
          <ProductsKpiCards kpis={kpis} />
        </div>
        <Link to="/admin/produtos/novo" className="2xl:shrink-0">
          <Button size="lg" className="w-full 2xl:w-auto">
            <Plus size={18} /> Novo produto
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <label htmlFor="produtos-busca" className="sr-only">
            Buscar produto por nome, código ou SKU
          </label>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            id="produtos-busca"
            value={filters.search}
            onChange={(e) => patchFilters({ search: e.target.value })}
            placeholder="Buscar produto por nome, código ou SKU..."
            className="h-12 w-full rounded-xl border border-ink-900/15 bg-white pl-12 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex">
          <select
            aria-label="Categoria"
            value={filters.categoryId}
            onChange={(e) => patchFilters({ categoryId: e.target.value })}
            className={`${selectClasses} xl:h-12`}
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Status do produto"
            value={filters.active}
            onChange={(e) => patchFilters({ active: e.target.value as ProductFilters["active"] })}
            className={`${selectClasses} xl:h-12`}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <select
            aria-label="Situação do estoque"
            value={filters.stock}
            onChange={(e) => patchFilters({ stock: e.target.value as ProductFilters["stock"] })}
            className={`${selectClasses} xl:h-12`}
          >
            <option value="all">Todos os estoques</option>
            <option value="ok">Em estoque</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
          </select>
          <Button type="button" variant="outline" className="h-11 border-ink-900/15 bg-white xl:h-12" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} /> Filtros
            {advancedCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest-700 px-1.5 text-[11px] font-bold text-cream-50">
                {advancedCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="-mt-3 flex items-center gap-3 text-sm text-ink-700">
          <span>
            {visibleRows.length} de {allProducts.length} produtos
          </span>
          <button type="button" onClick={clearFilters} className="min-h-9 font-semibold text-forest-800 hover:underline">
            Limpar filtros
          </button>
        </div>
      )}

      {catalogStatus === "loading" && allProducts.length === 0 ? (
        <AdminState variant="loading" message="Carregando produtos..." />
      ) : catalogStatus === "error" && allProducts.length === 0 ? (
        <AdminState variant="error" message="Não foi possível carregar os produtos." onRetry={fetchCatalog} />
      ) : visibleRows.length === 0 ? (
        <AdminState variant="empty" message="Nenhum produto encontrado." />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
          {selectedIds.size > 0 && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/10 bg-forest-700/10 px-4 py-2.5">
              <span className="text-sm font-semibold text-forest-900">
                {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => bulkSetActive(true)}>
                  Ativar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => bulkSetActive(false)}>
                  Desativar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          )}

          <ProductsTable
            rows={pageData.items}
            sort={sort}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            actions={actions}
          />
          <ProductsMobileList rows={pageData.items} actions={actions} />

          <Pagination
            page={pageData.page}
            totalPages={pageData.totalPages}
            pageSize={pageSize}
            total={visibleRows.length}
            itemLabel="produtos"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      <ProductsFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        suppliers={suppliers}
        onChange={patchFilters}
        onClear={clearFilters}
      />

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
            setSelectedIds((current) => {
              const next = new Set(current);
              next.delete(productToDelete.id);
              return next;
            });
            setProductToDelete(null);
          }}
        />
      )}

      <ProductImageSheet productId={imageEditProductId} onClose={() => setImageEditProductId(null)} />
    </div>
  );
}
