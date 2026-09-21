import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Plus, Search } from "lucide-react";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useCatalogStore } from "@/store/catalog-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { getSupplierDisplayName } from "@/lib/supplier-display";

export function SuppliersPage() {
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const status = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const products = useCatalogStore((state) => state.products);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSuppliers();
    if (products.length === 0) fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSuppliers]);

  const productCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((product) => {
      if (!product.supplierId) return;
      map.set(product.supplierId, (map.get(product.supplierId) ?? 0) + 1);
    });
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.companyName, supplier.tradeName, supplier.cnpj, supplier.phone].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [suppliers, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Fornecedores</h1>
          <p className="text-sm text-ink-muted">Fornecedores cadastrados, reutilizáveis no vínculo com produtos.</p>
        </div>
        <Link to="/admin/fornecedores/novo">
          <Button className="w-full sm:w-auto">
            <Plus size={18} /> Novo fornecedor
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, CNPJ ou telefone..."
          className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
        />
      </div>

      {status === "loading" && suppliers.length === 0 ? (
        <AdminState variant="loading" message="Carregando fornecedores..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os fornecedores. Tente recarregar a página." />
      ) : filtered.length === 0 ? (
        <AdminState
          variant="empty"
          message={suppliers.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum fornecedor encontrado com esse filtro."}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-3xl border border-forest-950/10 bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Produtos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                    <td className="px-4 py-3">
                      <Link to={`/admin/fornecedores/${supplier.id}`} className="font-semibold text-ink-900 hover:underline">
                        {getSupplierDisplayName(supplier)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700/70">{supplier.name}</td>
                    <td className="px-4 py-3 text-ink-700/70">{supplier.cnpj || "-----"}</td>
                    <td className="px-4 py-3 text-ink-700/70">{supplier.phone}</td>
                    <td className="px-4 py-3 text-ink-700/70">{productCountBySupplier.get(supplier.id) ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Link
                          to={`/admin/fornecedores/${supplier.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
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

          <div className="flex flex-col gap-3 lg:hidden">
            {filtered.map((supplier) => (
              <div key={supplier.id} className="rounded-2xl border border-forest-950/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/admin/fornecedores/${supplier.id}`} className="min-w-0">
                    <p className="truncate font-extrabold text-forest-950">{getSupplierDisplayName(supplier)}</p>
                    <p className="text-sm text-ink-700/70">{supplier.name}</p>
                  </Link>
                  <Link
                    to={`/admin/fornecedores/${supplier.id}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                  >
                    <Eye size={16} />
                  </Link>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">
                  <span>{supplier.phone}</span>
                  <span>{productCountBySupplier.get(supplier.id) ?? 0} produto(s)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
