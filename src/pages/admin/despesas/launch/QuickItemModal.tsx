import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";
import { useRawMaterialCategoriesStore } from "@/store/raw-material-categories-store";
import { usePurchaseStore, type PurchaseCatalogItem, type PurchaseUsage } from "@/store/purchase-store";
import { CONTROL_UNITS } from "@/types/raw-material";
import { ModalShell } from "./LaunchModals";

const C = DESPESAS_COLORS;
const fieldCls = "w-full rounded-[10px] border px-3 py-3 text-sm";

interface QuickItemModalProps {
  supplierId: string;
  initialBarcode?: string;
  initialName?: string;
  onClose: () => void;
  onCreated: (item: PurchaseCatalogItem) => void;
}

/** Cadastro rápido dentro da compra: cria no cadastro central (Produtos ou Matérias-primas),
 * gera o SKU Óris estável e devolve a linha ao carrinho sem tocar nas demais. */
export function QuickItemModal({ supplierId, initialBarcode = "", initialName = "", onClose, onCreated }: QuickItemModalProps) {
  const rawCategoryNames = useRawMaterialCategoriesStore((s) => s.names);
  const fetchRawCategories = useRawMaterialCategoriesStore((s) => s.fetchCategories);
  const createRawCategory = useRawMaterialCategoriesStore((s) => s.createCategory);
  const productCategories = usePurchaseStore((s) => s.productCategories);
  const fetchProductCategories = usePurchaseStore((s) => s.fetchProductCategories);
  const createProductCategory = usePurchaseStore((s) => s.createProductCategory);
  const createQuickItem = usePurchaseStore((s) => s.createQuickItem);

  const [usage, setUsage] = useState<PurchaseUsage>("MATERIAL");
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [unit, setUnit] = useState("un");
  const [gtin, setGtin] = useState(initialBarcode);
  const [supplierCode, setSupplierCode] = useState("");
  const [brand, setBrand] = useState("");
  const [presentation, setPresentation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchRawCategories();
    void fetchProductCategories();
  }, [fetchRawCategories, fetchProductCategories]);

  const categoryOptions = usage === "RESALE" ? productCategories.map((c) => c.name) : rawCategoryNames;
  const canSave = !saving && name.trim() !== "" && category !== "";

  function changeUsage(next: PurchaseUsage) {
    setUsage(next);
    setCategory("");
    setUnit(next === "RESALE" ? "un" : unit);
  }

  async function handleCreateCategory() {
    const clean = newCategory.trim();
    if (clean === "") return;
    setCreatingCategory(true);
    if (usage === "RESALE") {
      const result = await createProductCategory(clean);
      if (typeof result === "string") setError(result);
      else setCategory(result.name);
    } else {
      const created = await createRawCategory(clean);
      if (created) setCategory(created);
    }
    setCreatingCategory(false);
    setNewCategory("");
  }

  async function handleSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await createQuickItem({
      usage,
      name,
      categoryName: category,
      unit,
      gtin,
      supplierId: supplierId || null,
      supplierCode,
      brand,
      presentation,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    toast.success(`${result.item.sku} cadastrado e adicionado ao carrinho.`);
    onCreated(result.item);
    onClose();
  }

  return (
    <ModalShell title="Cadastrar item sem sair da compra" onClose={onClose}>
      <p className="mb-3 text-xs" style={{ color: C.muted }}>
        O item é criado uma única vez no cadastro central e volta para a compra. Todas as linhas já lançadas são mantidas.
      </p>

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold">Nome do item *</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Molho de pimenta 150 ml" className={fieldCls} style={{ borderColor: C.line }} />
      </label>

      <fieldset className="mb-3">
        <legend className="mb-1 text-xs font-semibold">Tipo de uso *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              { key: "MATERIAL", label: "Matéria-prima / embalagem / insumo" },
              { key: "RESALE", label: "Produto para revenda" },
            ] as { key: PurchaseUsage; label: string }[]
          ).map((option) => (
            <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-3 text-sm" style={{ borderColor: usage === option.key ? C.accent : C.line, background: usage === option.key ? "#f0f7ef" : "#fff" }}>
              <input type="radio" name="quick-usage" checked={usage === option.key} onChange={() => changeUsage(option.key)} />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-semibold">Categoria obrigatória *</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
            <option value="">Selecione</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs">
          <span className="mb-1 block font-semibold">Nova categoria</span>
          <div className="flex gap-2">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ex.: Molhos" className={fieldCls} style={{ borderColor: C.line }} />
            <button type="button" disabled={creatingCategory || newCategory.trim() === ""} onClick={() => void handleCreateCategory()} className="shrink-0 rounded-[10px] border px-3 text-xs font-bold disabled:opacity-50" style={{ borderColor: "#d8dfd7", color: C.green }}>
              + Criar
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-semibold">Unidade de controle *</span>
          {usage === "RESALE" ? (
            <input value="Unidade (un)" disabled className={fieldCls} style={{ borderColor: C.line }} />
          ) : (
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
              {CONTROL_UNITS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-semibold">Código de barras (opcional)</span>
          <input value={gtin} onChange={(e) => setGtin(e.target.value.replace(/\D/g, "").slice(0, 14))} inputMode="numeric" placeholder="EAN / GTIN" className={fieldCls} style={{ borderColor: C.line }} />
        </label>
      </div>

      {usage === "RESALE" && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-semibold">Marca</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold">Apresentação</span>
            <input value={presentation} onChange={(e) => setPresentation(e.target.value)} placeholder="Ex.: 24 x 200 g" className={fieldCls} style={{ borderColor: C.line }} />
          </label>
        </div>
      )}

      <label className="mb-3 block text-xs">
        <span className="mb-1 block font-semibold">Código do fornecedor (opcional)</span>
        <input value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} disabled={!supplierId} placeholder={supplierId ? "Código deste fornecedor" : "Selecione o fornecedor para vincular o código"} className={fieldCls} style={{ borderColor: C.line }} />
      </label>

      <p className="mb-3 rounded-[10px] p-3 text-xs" style={{ background: "#f4f7f0" }}>
        O SKU Óris é gerado uma vez e não muda. Código de barras e código do fornecedor ficam separados dele. Dados fiscais (NCM etc.) podem ser completados depois no cadastro completo.
      </p>

      {error && (
        <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" disabled={!canSave} onClick={() => void handleSubmit()}>
          {saving ? "Cadastrando..." : "Cadastrar e voltar à compra"}
        </Button>
      </div>
    </ModalShell>
  );
}
