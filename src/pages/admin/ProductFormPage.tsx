import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink, Save } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ActiveStatusSelect } from "@/components/admin/ActiveStatusSelect";
import { FormCard } from "@/components/admin/FormCard";
import { FormPageHeader } from "@/components/admin/FormPageHeader";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ReadOnlyCodeField } from "@/components/admin/ReadOnlyCodeField";
import { ProductProfitabilityCard } from "@/components/admin/ProductProfitabilityCard";
import { ProductRecipeEditor } from "@/components/admin/ProductRecipeEditor";
import { ProductStockStatusBar } from "@/components/admin/ProductStockStatusBar";
import { StockRangeGauge } from "@/components/admin/StockRangeGauge";
import { cn } from "@/lib/cn";
import { buildDuplicateDraft, type ProductDraft } from "@/lib/product-duplicate";
import { formatNumber } from "@/lib/number";
import { useCatalogStore } from "@/store/catalog-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import type { PackagingType, Product, ProductBadge } from "@/types/product";

const packagingOptions: PackagingType[] = ["Fardo", "Caixa", "Pacote", "Kit", "Outro"];
const badgeOptions: { value: ProductBadge | ""; label: string }[] = [
  { value: "", label: "Nenhum" },
  { value: "mais-pedido", label: "Mais pedido" },
  { value: "novidade", label: "Novidade" },
  { value: "destaque", label: "Destaque" },
];

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700";

type ProductForm = ProductDraft;

function createEmptyForm(categoryId: string): ProductForm {
  return {
    code: "",
    name: "",
    description: "",
    imageUrl: "",
    categoryId,
    supplierId: null,
    presentation: "",
    weight: "",
    unitWeightGrams: null,
    unitPrice: 0,
    packQuantity: 1,
    packagingType: "Fardo",
    active: true,
    badge: undefined,
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    targetMarginPct: 40,
    gtin: "",
    brand: "",
    ncm: "",
  };
}

function toForm(product: Product): ProductForm {
  const { id: _id, ...rest } = product;
  return rest;
}

export function ProductFormPage() {
  const { productId } = useParams();
  const isEditing = productId !== "novo";
  const navigate = useNavigate();
  const location = useLocation();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const addProduct = useCatalogStore((state) => state.addProduct);
  const updateProduct = useCatalogStore((state) => state.updateProduct);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);

  useEffect(() => {
    if (suppliers.length === 0) fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingProduct = useMemo(() => products.find((product) => product.id === productId), [products, productId]);

  const [form, setForm] = useState<ProductForm>(() => (existingProduct ? toForm(existingProduct) : createEmptyForm(categories[0]?.id ?? "")));
  const [minStockOpen, setMinStockOpen] = useState(false);
  const hydratedIdRef = useRef<string | undefined>(existingProduct ? productId : undefined);

  useEffect(() => {
    if (hydratedIdRef.current === productId) return;
    if (isEditing) {
      if (!existingProduct) return;
      setForm(toForm(existingProduct));
    } else {
      const seed = (location.state as { duplicateOf?: ProductForm } | null)?.duplicateOf;
      setForm(seed ?? createEmptyForm(categories[0]?.id ?? ""));
    }
    hydratedIdRef.current = productId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, existingProduct, productId, categories]);

  const previewProduct: Product = { id: existingProduct?.id ?? "preview", ...form };

  function handleChange<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const stockRangeError =
    form.maxStock > 0 && form.maxStock < form.minStock ? "O estoque máximo não pode ser menor que o estoque mínimo." : "";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (stockRangeError) {
      toast.error(stockRangeError);
      setMinStockOpen(true);
      return;
    }
    if (isEditing && existingProduct) {
      updateProduct(existingProduct.id, form);
    } else {
      addProduct({ id: crypto.randomUUID(), ...form });
    }
    navigate("/admin/produtos");
  }

  function handleDuplicate() {
    const seed = buildDuplicateDraft(form);
    toast.info("Cópia aberta. Ajuste os dados e salve. A ficha técnica não é copiada.");
    navigate("/admin/produtos/novo", { state: { duplicateOf: seed } });
  }

  const pageTitle = isEditing ? "Editar produto" : "Novo produto";

  return (
    <div className="flex flex-col gap-6">
      <FormPageHeader title={pageTitle} crumbs={[{ label: "Produtos", to: "/admin/produtos" }, { label: pageTitle }]}>
        <Button type="button" variant="outline" onClick={() => navigate("/admin/produtos")}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        {isEditing && (
          <Button type="button" variant="outline" onClick={handleDuplicate}>
            <Copy size={16} /> Duplicar
          </Button>
        )}
        <Button type="submit" form="product-form" variant="secondary">
          <Save size={16} /> Salvar produto
        </Button>
      </FormPageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormCard
            title="Informações básicas"
            action={<ActiveStatusSelect value={form.active} onChange={(active) => handleChange("active", active)} ariaLabel="Situação do produto no catálogo" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.7fr_1fr]">
              <Input label="Nome do produto *" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
              <ReadOnlyCodeField label="Código Referência / SKU" value={form.code} placeholder={isEditing ? "" : "Gerado ao salvar"} />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink-900">Descrição</span>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">Categoria *</span>
                <select value={form.categoryId} onChange={(e) => handleChange("categoryId", e.target.value)} className={selectClasses} required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">Fornecedor</span>
                <select
                  value={form.supplierId ?? ""}
                  onChange={(e) => handleChange("supplierId", e.target.value || null)}
                  className={selectClasses}
                >
                  <option value="">Nenhum</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.tradeName || supplier.companyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-900">Imagem do produto</span>
              <ImageUploader onUploaded={(url) => handleChange("imageUrl", url)} />
              <Input
                aria-label="Imagem (URL)"
                value={form.imageUrl}
                onChange={(e) => handleChange("imageUrl", e.target.value)}
                placeholder="ou cole a URL da imagem: https://..."
              />
            </div>
          </FormCard>

          <FormCard title="Apresentação">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Apresentação"
                value={form.presentation}
                onChange={(e) => handleChange("presentation", e.target.value)}
                placeholder="Frasco, Pote, Sachê..."
              />
              <Input label="Peso/volume" value={form.weight} onChange={(e) => handleChange("weight", e.target.value)} placeholder="150ml" />
              <Input
                label="Peso por unidade (gramas)"
                type="number"
                min="0"
                step="0.01"
                value={form.unitWeightGrams ?? ""}
                onChange={(e) => handleChange("unitWeightGrams", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="Usado pra somar o peso produzido"
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">Selo no catálogo</span>
                <select
                  value={form.badge ?? ""}
                  onChange={(e) => handleChange("badge", (e.target.value || undefined) as ProductBadge | undefined)}
                  className={selectClasses}
                >
                  {badgeOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </FormCard>

          <FormCard title="Venda">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Preço unitário (R$) *"
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
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-ink-900">Tipo de embalagem interno</span>
                <select
                  value={form.packagingType}
                  onChange={(e) => handleChange("packagingType", e.target.value as PackagingType)}
                  className={selectClasses}
                >
                  {packagingOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </FormCard>

          <FormCard title="Informações fiscais">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="GTIN/EAN Código de Barras"
                inputMode="numeric"
                value={form.gtin}
                onChange={(e) => handleChange("gtin", e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="7898965123456"
              />
              <Input label="Marca" value={form.brand} onChange={(e) => handleChange("brand", e.target.value)} />
              <Input
                label="NCM Produto"
                inputMode="numeric"
                value={form.ncm}
                onChange={(e) => handleChange("ncm", e.target.value.replace(/[^\d.]/g, "").slice(0, 10))}
                placeholder="2103.90.21"
              />
            </div>
          </FormCard>

          <ProductStockStatusBar
            currentStock={form.currentStock}
            minStock={form.minStock}
            maxStock={form.maxStock}
            onConfigure={() => setMinStockOpen(true)}
          />

          <div className="flex gap-3 lg:hidden">
            <Button type="submit" size="lg" variant="secondary" className="flex-1">
              <Save size={18} /> Salvar produto
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900">Preview no catálogo</h2>
              {isEditing && existingProduct && (
                <a
                  href={`/#product-${existingProduct.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-forest-900/20 px-3 text-xs font-semibold text-forest-900 hover:bg-forest-900/5"
                >
                  <ExternalLink size={14} /> Ver no catálogo
                </a>
              )}
            </div>
            <ProductCard product={previewProduct} onAdd={() => {}} embedded />
          </section>

          <ProductProfitabilityCard
            productId={existingProduct?.id ?? null}
            price={form.unitPrice}
            targetPct={form.targetMarginPct}
            onTargetChange={(value) => handleChange("targetMarginPct", value)}
          />

          {isEditing && existingProduct && <ProductRecipeEditor productId={existingProduct.id} />}
        </div>
      </div>

      <Sheet
        open={minStockOpen}
        onClose={() => setMinStockOpen(false)}
        title="Configuração de estoque"
        footer={
          <Button type="button" size="lg" className="w-full" disabled={Boolean(stockRangeError)} onClick={() => setMinStockOpen(false)}>
            Concluído
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-700/80">
            Abaixo do mínimo o produto aparece como "Estoque baixo" e entra na lista "O que precisa produzir". Acima do máximo ele aparece como
            "Estoque máximo". Salve o produto para gravar a mudança.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estoque mínimo (un)"
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => handleChange("minStock", Number(e.target.value))}
            />
            <Input
              label="Estoque máximo (un)"
              type="number"
              min="0"
              value={form.maxStock}
              onChange={(e) => handleChange("maxStock", Number(e.target.value))}
              error={stockRangeError || undefined}
            />
          </div>
          <p className="-mt-2 text-xs text-ink-muted">Use 0 no máximo quando não houver limite.</p>
          <StockRangeGauge currentStock={form.currentStock} minStock={form.minStock} maxStock={form.maxStock} />
          {isEditing && <Input label="Estoque atual" value={`${formatNumber(form.currentStock)} un`} disabled />}
        </div>
      </Sheet>
    </div>
  );
}
