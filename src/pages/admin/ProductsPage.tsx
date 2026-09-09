import { Link } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatProductTitle } from "@/lib/product-title";
import { formatCurrency } from "@/lib/currency";
import { useCatalogStore } from "@/store/catalog-store";
import { Button } from "@/components/ui/Button";

export function ProductsPage() {
  const products = useCatalogStore((state) => state.products);
  const categories = useCatalogStore((state) => state.categories);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const removeProduct = useCatalogStore((state) => state.removeProduct);

  function categoryName(categoryId: string) {
    return categories.find((category) => category.id === categoryId)?.name ?? "Sem categoria";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-forest-950">Produtos</h1>
        <Link to="/admin/produtos/novo">
          <Button>
            <Plus size={18} /> Novo produto
          </Button>
        </Link>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-700/50">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Pack</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-forest-950/5 last:border-none">
                <td className="px-4 py-3 font-semibold text-ink-900">{formatProductTitle(product)}</td>
                <td className="px-4 py-3 text-ink-700/70">{categoryName(product.categoryId)}</td>
                <td className="px-4 py-3 text-ink-700/70">{formatCurrency(product.unitPrice)}</td>
                <td className="px-4 py-3 text-ink-700/70">{product.packQuantity} un</td>
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
                    <button
                      onClick={() => removeProduct(product.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
