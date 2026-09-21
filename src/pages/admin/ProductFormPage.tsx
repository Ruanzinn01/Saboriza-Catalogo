import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Copy, ExternalLink, Save } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ProductProfitabilityCard } from "@/components/admin/ProductProfitabilityCard";
import { ProductRecipeEditor } from "@/components/admin/ProductRecipeEditor";
import { ProductStockStatusBar } from "@/components/admin/ProductStockStatusBar";
import { StockRangeGauge } from "@/components/admin/StockRangeGauge";
import { cn } from "@/lib/cn";
import { buildDuplicateDraft, type ProductDraft } from "@/lib/product-duplicate";
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

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
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

  async function handleCopyCode() {
    if (!form.code) return;
    try {
      await navigator.clipboard.writeText(form.code);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar o código");
    }
  }

  const pageTitle = isEditing ? "Editar produto" : "Novo produto";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950 sm:text-3xl">{pageTitle}</h1>
          <nav aria-label="Trilha de navegação" className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
            <Link to="/admin" className="hover:text-forest-800 hover:underline">
              Início
            </Link>
            <ChevronRight size={12} aria-hidden />
            <Link to="/admin/produtos" className="hover:text-forest-800 hover:underline">
              Produtos
            </Link>
            <ChevronRight size={12} aria-hidden />
            <span aria-current="page">{pageTitle}</span>
          </nav>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card
            title="Informações básicas"
            action={
              <select
                aria-label="Situação do produto no catálogo"
                value={form.active ? "active" : "inactive"}
                onChange={(e) => handleChange("active", e.target.value === "active")}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-semibold outline-none",
                  form.active ? "border-forest-700/30 bg-forest-700/10 text-forest-800" : "border-ink-900/20 bg-ink-900/5 text-ink-700"
                )}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.7fr_1fr]">
              <Input label="Nome do produto *" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-sku" className="text-sm font-semibold text-ink-900">
                  Código Referência / SKU
                </label>
                <div className="relative">
                  <input
                    id="product-sku"
                    value={form.code}
                    disabled
                    placeholder={isEditing ? "" : "Gerado ao salvar"}
                    className={cn(selectClasses, "w-full bg-ink-900/5 pr-12 text-ink-700 disabled:cursor-not-allowed")}
                  />
                  {isEditing && form.code && (
                    <button
                      type="button"
                      onClick={() => void handleCopyCode()}
                      aria-label="Copiar código"
                      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-700 hover:bg-ink-900/10"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              </div>
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
          </Card>

          <Card title="Apresentação">
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
          </Card>

          <Card title="Venda">
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
          </Card>

          <Card title="Informações fiscais">
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
          </Card>

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
          {isEditing && <Input label="Estoque atual" value={`${form.currentStock} un`} disabled />}
        </div>
      </Sheet>
    </div>
  );
}
