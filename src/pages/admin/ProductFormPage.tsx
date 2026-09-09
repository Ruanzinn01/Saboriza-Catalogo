import { type FormEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/catalog/ProductCard";
import { useCatalogStore } from "@/store/catalog-store";
import type { PackagingType, Product, ProductBadge } from "@/types/product";

const packagingOptions: PackagingType[] = ["Fardo", "Caixa", "Pacote", "Kit", "Outro"];
const badgeOptions: { value: ProductBadge | ""; label: string }[] = [
  { value: "", label: "Nenhum" },
  { value: "mais-pedido", label: "Mais pedido" },
  { value: "novidade", label: "Novidade" },
  { value: "destaque", label: "Destaque" },
];

function createEmptyForm(categoryId: string) {
  return {
    name: "",
    description: "",
    imageUrl: "",
    categoryId,
    presentation: "",
    weight: "",
    unitPrice: 0,
    packQuantity: 1,
    packagingType: "Fardo" as PackagingType,
    active: true,
    badge: undefined as ProductBadge | undefined,
  };
}

export function ProductFormPage() {
  const { productId } = useParams();
  const isEditing = productId !== "novo";
  const navigate = useNavigate();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const addProduct = useCatalogStore((state) => state.addProduct);
  const updateProduct = useCatalogStore((state) => state.updateProduct);

  const existingProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId]);

  const [form, setForm] = useState(() => existingProduct ?? createEmptyForm(categories[0]?.id ?? ""));

  const previewProduct: Product = {
    id: existingProduct?.id ?? "preview",
    ...form,
  };

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isEditing && existingProduct) {
      updateProduct(existingProduct.id, form);
    } else {
      addProduct({ id: crypto.randomUUID(), ...form });
    }
    navigate("/admin/produtos");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold text-forest-950">{isEditing ? "Editar produto" : "Novo produto"}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Informações básicas</p>
          <Input label="Nome" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
          <Input label="Descrição" value={form.description} onChange={(e) => handleChange("description", e.target.value)} />
          <Input
            label="Imagem (URL)"
            value={form.imageUrl}
            onChange={(e) => handleChange("imageUrl", e.target.value)}
            placeholder="https://..."
          />

          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Organização</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Categoria</span>
            <select
              value={form.categoryId}
              onChange={(e) => handleChange("categoryId", e.target.value)}
              className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Apresentação"
            value={form.presentation}
            onChange={(e) => handleChange("presentation", e.target.value)}
            placeholder="Frasco, Pote, Sachê..."
          />
          <Input label="Peso/volume" value={form.weight} onChange={(e) => handleChange("weight", e.target.value)} placeholder="80g" />

          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Informações comerciais</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preço unitário (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.unitPrice}
              onChange={(e) => handleChange("unitPrice", Number(e.target.value))}
            />
            <Input
              label="Quantidade por pack"
              type="number"
              min="1"
              value={form.packQuantity}
              onChange={(e) => handleChange("packQuantity", Number(e.target.value))}
            />
          </div>

          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-700/50">Operacional</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-900">Tipo de embalagem interno</span>
              <select
                value={form.packagingType}
                onChange={(e) => handleChange("packagingType", e.target.value as PackagingType)}
                className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
              >
                {packagingOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-900">Selo</span>
              <select
                value={form.badge ?? ""}
                onChange={(e) => handleChange("badge", (e.target.value || undefined) as ProductBadge | undefined)}
                className="h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700"
              >
                {badgeOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => handleChange("active", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-ink-900">Produto ativo no catálogo</span>
          </label>

          <div className="mt-2 flex gap-3">
            <Button type="submit" size="lg">
              Salvar produto
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate("/admin/produtos")}>
              Cancelar
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-700/50">Preview no catálogo</p>
          <ProductCard product={previewProduct} onAdd={() => {}} />
        </div>
      </div>
    </div>
  );
}
