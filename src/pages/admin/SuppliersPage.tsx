import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Plus, Search } from "lucide-react";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useCatalogStore } from "@/store/catalog-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { SupplierCandidatesTab } from "@/components/admin/fornecedores/SupplierCandidatesTab";
import { SupplierCategoriesSettings } from "@/components/admin/fornecedores/SupplierCategoriesSettings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { getSupplierDisplayName } from "@/lib/supplier-display";
import { filterSuppliers, paginate, SUPPLIER_PAGE_SIZES } from "@/lib/supplier-search";

type Tab = "fornecedores" | "possiveis" | "configuracoes";

const TABS: { key: Tab; label: string }[] = [
  { key: "fornecedores", label: "Fornecedores" },
  { key: "possiveis", label: "Possíveis fornecedores" },
  { key: "configuracoes", label: "Configurações" },
];

export function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((item) => item.key === params.get("aba")) ? (params.get("aba") as Tab) : "fornecedores";
  const query = params.get("q") ?? "";
  const categoryId = params.get("categoria") ?? "";
  const city = params.get("cidade") ?? "";
  const pageSize = SUPPLIER_PAGE_SIZES.includes(Number(params.get("tam"))) ? Number(params.get("tam")) : 10;
  const page = Math.max(1, Number(params.get("pagina")) || 1);

  const suppliers = useSuppliersStore((state) => state.suppliers);
  const status = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const products = useCatalogStore((state) => state.products);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);

  useEffect(() => {
    fetchSuppliers();
    if (products.length === 0) fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSuppliers]);

  useEffect(() => {
    if (categoriesStatus === "idle") void fetchCategories();
  }, [categoriesStatus, fetchCategories]);

  function setParam(changes: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (resetPage) next.delete("pagina");
    setParams(next, { replace: true });
  }

  const productCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((product) => {
      if (!product.supplierId) return;
      map.set(product.supplierId, (map.get(product.supplierId) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const cities = useMemo(
    () => Array.from(new Set(suppliers.map((supplier) => supplier.city.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [suppliers]
  );

  const filtered = useMemo(
    () => filterSuppliers(suppliers, linksBySupplier, categoriesById, { query, categoryIds: categoryId ? [categoryId] : [], city }),
    [suppliers, linksBySupplier, categoriesById, query, categoryId, city]
  );
  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  function categoryNames(supplierId: string) {
    return (linksBySupplier.get(supplierId) ?? []).map((id) => categoriesById.get(id)?.name).filter(Boolean) as string[];
  }

  const selectClass = "h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Fornecedores</h1>
          <p className="text-sm text-ink-muted">Com quem a empresa compra ou contrata, e quem ainda está em avaliação.</p>
        </div>
        <Link to="/admin/fornecedores/novo">
          <Button className="w-full sm:w-auto">
            <Plus size={18} /> Novo fornecedor
          </Button>
        </Link>
      </div>

      <div role="tablist" aria-label="Seções de fornecedores" className="flex gap-1 overflow-x-auto rounded-2xl bg-forest-950/5 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setParam({ aba: item.key === "fornecedores" ? "" : item.key }, false)}
            className={cn(
              "min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors",
              tab === item.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-700 hover:bg-white/60"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "possiveis" && <SupplierCandidatesTab />}
      {tab === "configuracoes" && <SupplierCategoriesSettings />}

      {tab === "fornecedores" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Fornecedores formais</p>
              <p className="text-xl font-extrabold text-forest-950">{suppliers.length}</p>
              <p className="text-xs text-ink-muted">Possíveis fornecedores não entram nesta contagem.</p>
            </div>
            <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Comprado, pago e em aberto</p>
              <p className="text-sm font-semibold text-ink-700">Indisponível nesta versão</p>
              <p className="text-xs text-ink-muted">A leitura de Compras e Contas a Pagar ainda não está integrada; nenhum valor é exibido para não induzir zero falso.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                value={query}
                onChange={(e) => setParam({ q: e.target.value })}
                aria-label="Buscar fornecedor"
                placeholder="Buscar por nome, empresa, documento, contato ou categoria..."
                className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
              />
            </div>
            <select value={categoryId} aria-label="Filtrar por categoria" onChange={(e) => setParam({ categoria: e.target.value })} className={selectClass}>
              <option value="">Todas as categorias (inclui sem categoria)</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.active ? "" : " (inativa)"}
                </option>
              ))}
            </select>
            <select value={city} aria-label="Filtrar por cidade" onChange={(e) => setParam({ cidade: e.target.value })} className={selectClass}>
              <option value="">Todas as cidades</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {status === "loading" && suppliers.length === 0 ? (
            <AdminState variant="loading" message="Carregando fornecedores..." />
          ) : status === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar os fornecedores." onRetry={() => void fetchSuppliers()} />
          ) : filtered.length === 0 ? (
            <AdminState
              variant="empty"
              message={suppliers.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum fornecedor encontrado com esse filtro."}
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Contato</th>
                      <th className="px-4 py-3">Cidade/UF</th>
                      <th className="px-4 py-3">Categorias</th>
                      <th className="px-4 py-3">Produtos</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.rows.map((supplier) => (
                      <tr key={supplier.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                        <td className="px-4 py-3">
                          <Link to={`/admin/fornecedores/${supplier.id}`} className="font-extrabold text-forest-900 hover:underline">
                            {getSupplierDisplayName(supplier)}
                          </Link>
                          <p className="text-xs text-ink-muted">{supplier.cnpj || "Sem documento"}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-700/70">
                          {supplier.name}
                          <p className="text-xs">{supplier.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-700/70">{[supplier.city, supplier.state].filter(Boolean).join("/") || "-----"}</td>
                        <td className="px-4 py-3 text-ink-700/70">{categoryNames(supplier.id).join(" · ") || "-----"}</td>
                        <td className="px-4 py-3 text-ink-700/70">{productCountBySupplier.get(supplier.id) ?? 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            <Link
                              to={`/admin/fornecedores/${supplier.id}`}
                              aria-label={`Abrir ${getSupplierDisplayName(supplier)}`}
                              className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                            >
                              <Eye size={16} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 p-3 lg:hidden">
                {paged.rows.map((supplier) => (
                  <div key={supplier.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/admin/fornecedores/${supplier.id}`} className="min-w-0">
                        <p className="break-words font-extrabold text-forest-950">{getSupplierDisplayName(supplier)}</p>
                        <p className="text-sm text-ink-700/70">{supplier.name}</p>
                      </Link>
                      <Link
                        to={`/admin/fornecedores/${supplier.id}`}
                        aria-label={`Abrir ${getSupplierDisplayName(supplier)}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                      >
                        <Eye size={16} />
                      </Link>
                    </div>
                    {categoryNames(supplier.id).length > 0 && <p className="mt-1 text-xs text-ink-700/70">{categoryNames(supplier.id).join(" · ")}</p>}
                    <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">
                      <span>{supplier.phone}</span>
                      <span>{productCountBySupplier.get(supplier.id) ?? 0} produto(s)</span>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                page={paged.page}
                totalPages={paged.totalPages}
                pageSize={pageSize}
                pageSizeOptions={SUPPLIER_PAGE_SIZES}
                total={filtered.length}
                itemLabel="fornecedores"
                onPageChange={(next) => setParam({ pagina: next > 1 ? String(next) : "" }, false)}
                onPageSizeChange={(size) => setParam({ tam: size === 10 ? "" : String(size) })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
