import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { RawMaterialFormFields, type RawMaterialFormField } from "@/components/admin/RawMaterialFormFields";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import { formatCurrency } from "@/lib/currency";
import { rawMaterialStockStatus } from "@/types/raw-material";
import type { RawMaterialInput } from "@/types/raw-material";

const stockStatusLabel: Record<ReturnType<typeof rawMaterialStockStatus>, string> = {
  ok: "Estoque OK",
  low: "Estoque baixo",
  out: "Sem estoque",
};

const stockStatusClasses: Record<ReturnType<typeof rawMaterialStockStatus>, string> = {
  ok: "bg-forest-700/10 text-forest-800",
  low: "bg-amber-500/10 text-amber-700",
  out: "bg-red-500/10 text-red-700",
};

const emptyForm: RawMaterialInput = {
  name: "",
  description: "",
  category: "",
  controlUnit: "un",
  imageUrl: "",
  purchaseUnitLabel: "",
  purchaseUnitFactor: 1,
  minStock: 0,
  maxStock: 0,
  minPurchaseQty: 0,
  defaultReorderQty: 0,
  purchaseMultiple: 0,
  leadTimeDays: 0,
  costBasis: "avg_cost",
  manualCost: 0,
  primarySupplierId: null,
  isActive: true,
};

function isMultipleOf(value: number, base: number) {
  const ratio = value / base;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

export function RawMaterialFormPage() {
  const { rawMaterialId } = useParams();
  const isEditing = rawMaterialId !== undefined;
  const navigate = useNavigate();
  const materials = useRawMaterialsStore((state) => state.materials);
  const fetchMaterials = useRawMaterialsStore((state) => state.fetchMaterials);
  const createMaterial = useRawMaterialsStore((state) => state.createMaterial);
  const updateMaterial = useRawMaterialsStore((state) => state.updateMaterial);
  const suppliers = useSuppliersStore((state) => state.suppliers);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);

  useEffect(() => {
    fetchMaterials();
    if (suppliers.length === 0) fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const existingMaterial = useMemo(() => materials.find((item) => item.id === rawMaterialId), [materials, rawMaterialId]);

  const [form, setForm] = useState<RawMaterialInput>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<RawMaterialFormField, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !existingMaterial) return;
    setForm({
      name: existingMaterial.name,
      description: existingMaterial.description,
      category: existingMaterial.category,
      controlUnit: existingMaterial.controlUnit,
      imageUrl: existingMaterial.imageUrl,
      purchaseUnitLabel: existingMaterial.purchaseUnitLabel,
      purchaseUnitFactor: existingMaterial.purchaseUnitFactor,
      minStock: existingMaterial.minStock,
      maxStock: existingMaterial.maxStock,
      minPurchaseQty: existingMaterial.minPurchaseQty,
      defaultReorderQty: existingMaterial.defaultReorderQty,
      purchaseMultiple: existingMaterial.purchaseMultiple,
      leadTimeDays: existingMaterial.leadTimeDays,
      costBasis: existingMaterial.costBasis,
      manualCost: existingMaterial.manualCost,
      primarySupplierId: existingMaterial.primarySupplierId,
      isActive: existingMaterial.isActive,
    });
  }, [isEditing, existingMaterial]);

  function handleChange<K extends keyof RawMaterialInput>(key: K, value: RawMaterialInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const nextErrors: Partial<Record<RawMaterialFormField, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome";
    if (!form.controlUnit) nextErrors.controlUnit = "Selecione a unidade";

    if (form.maxStock > 0 && form.maxStock < form.minStock) {
      nextErrors.maxStock = "Não pode ser menor que o estoque mínimo";
    }
    if (form.minPurchaseQty > 0 && form.defaultReorderQty > 0 && form.defaultReorderQty < form.minPurchaseQty) {
      nextErrors.defaultReorderQty = "Não pode ser menor que a quantidade mínima de compra";
    }
    if (form.purchaseMultiple > 0) {
      if (form.minPurchaseQty > 0 && !isMultipleOf(form.minPurchaseQty, form.purchaseMultiple)) {
        nextErrors.minPurchaseQty = `Deve ser múltiplo de ${form.purchaseMultiple}`;
      }
      if (form.defaultReorderQty > 0 && !nextErrors.defaultReorderQty && !isMultipleOf(form.defaultReorderQty, form.purchaseMultiple)) {
        nextErrors.defaultReorderQty = `Deve ser múltiplo de ${form.purchaseMultiple}`;
      }
    }
    if (form.costBasis === "manual" && form.manualCost <= 0) {
      nextErrors.manualCost = "Informe o custo manual";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const result = isEditing && existingMaterial ? await updateMaterial(existingMaterial.id, form) : await createMaterial(form);
    setSaving(false);
    if (result) navigate("/admin/materias-primas");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-extrabold text-forest-950">{isEditing ? "Editar insumo" : "Novo insumo"}</h1>
        {isEditing && existingMaterial && (
          <Link to={`/admin/materias-primas/entrada?insumo=${existingMaterial.id}`}>
            <Button variant="secondary">
              <Plus size={16} /> Nova entrada
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-6">
          <RawMaterialFormFields
            form={form}
            errors={errors}
            unitLocked={isEditing && (existingMaterial?.unitLocked ?? false)}
            currentStock={existingMaterial?.currentStock ?? 0}
            suppliers={suppliers}
            onChange={handleChange}
          />

          <div className="mt-2 flex gap-3">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Salvando..." : "Salvar insumo"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate("/admin/materias-primas")}>
              Cancelar
            </Button>
          </div>
        </form>

        {isEditing && existingMaterial && (
          <div className="flex w-full flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-6 lg:w-72 lg:shrink-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Resumo (somente leitura)</p>
            <p className="font-mono text-xs text-ink-muted">{existingMaterial.code}</p>
            <p className="text-sm text-ink-700/70">
              Saldo atual: <span className="font-semibold text-ink-900">{existingMaterial.currentStock} {existingMaterial.controlUnit}</span>
            </p>
            <p className="text-sm text-ink-700/70">
              Custo médio atual: <span className="font-semibold text-ink-900">{formatCurrency(existingMaterial.avgCost)}</span>
            </p>
            <p className="text-sm text-ink-700/70">
              Mínimo: <span className="font-semibold text-ink-900">{existingMaterial.minStock} {existingMaterial.controlUnit}</span>
            </p>
            <p className="text-sm text-ink-700/70">
              Máximo: <span className="font-semibold text-ink-900">{existingMaterial.maxStock > 0 ? `${existingMaterial.maxStock} ${existingMaterial.controlUnit}` : "-----"}</span>
            </p>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${stockStatusClasses[rawMaterialStockStatus(existingMaterial)]}`}>
              {stockStatusLabel[rawMaterialStockStatus(existingMaterial)]}
            </span>
            <p className="text-xs text-ink-muted">
              Saldo e custo médio só mudam por entrada confirmada. Use "Nova entrada" acima.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
