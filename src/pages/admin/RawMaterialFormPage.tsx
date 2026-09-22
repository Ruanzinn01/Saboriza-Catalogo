import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, PackagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormPageHeader } from "@/components/admin/FormPageHeader";
import { ProductStockStatusBar } from "@/components/admin/ProductStockStatusBar";
import { RawMaterialCostCard } from "@/components/admin/RawMaterialCostCard";
import { RawMaterialFormFields, type RawMaterialFormField } from "@/components/admin/RawMaterialFormFields";
import { RawMaterialSummaryCard } from "@/components/admin/RawMaterialSummaryCard";
import { materialBucket } from "@/lib/raw-material-list";
import { useRawMaterialsStore } from "@/store/raw-materials-store";
import { useSuppliersStore } from "@/store/suppliers-store";
import type { RawMaterial, RawMaterialInput } from "@/types/raw-material";

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

function toInput(material: RawMaterial): RawMaterialInput {
  return {
    name: material.name,
    description: material.description,
    category: material.category,
    controlUnit: material.controlUnit,
    imageUrl: material.imageUrl,
    purchaseUnitLabel: material.purchaseUnitLabel,
    purchaseUnitFactor: material.purchaseUnitFactor,
    minStock: material.minStock,
    maxStock: material.maxStock,
    minPurchaseQty: material.minPurchaseQty,
    defaultReorderQty: material.defaultReorderQty,
    purchaseMultiple: material.purchaseMultiple,
    leadTimeDays: material.leadTimeDays,
    costBasis: material.costBasis,
    manualCost: material.manualCost,
    primarySupplierId: material.primarySupplierId,
    isActive: material.isActive,
  };
}

function isMultipleOf(value: number, base: number) {
  const ratio = value / base;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

export function RawMaterialFormPage() {
  const { rawMaterialId } = useParams();
  const isEditing = rawMaterialId !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
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

  const [form, setForm] = useState<RawMaterialInput>(() => {
    if (isEditing && existingMaterial) return toInput(existingMaterial);
    return (location.state as { duplicateOf?: RawMaterialInput } | null)?.duplicateOf ?? emptyForm;
  });
  const [errors, setErrors] = useState<Partial<Record<RawMaterialFormField, string>>>({});
  const [saving, setSaving] = useState(false);
  const hydratedIdRef = useRef<string | undefined>(isEditing ? existingMaterial?.id : undefined);

  useEffect(() => {
    if (isEditing) return;
    const seed = (location.state as { duplicateOf?: RawMaterialInput } | null)?.duplicateOf;
    setForm(seed ?? emptyForm);
    setErrors({});
    hydratedIdRef.current = undefined;
  }, [isEditing, location.key, location.state]);

  useEffect(() => {
    if (!isEditing || !existingMaterial || hydratedIdRef.current === existingMaterial.id) return;
    hydratedIdRef.current = existingMaterial.id;
    setForm(toInput(existingMaterial));
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
    if (!validate()) {
      toast.error("Confira os campos destacados");
      return;
    }

    setSaving(true);
    const result = isEditing && existingMaterial ? await updateMaterial(existingMaterial.id, form) : await createMaterial(form);
    setSaving(false);
    if (result) navigate("/admin/materias-primas");
  }

  function handleDuplicate() {
    const seed: RawMaterialInput = { ...form, name: `${form.name} (cópia)`, isActive: false };
    toast.info("Cópia aberta. Ajuste os dados e salve. O saldo e o custo médio começam zerados.");
    navigate("/admin/materias-primas/novo", { state: { duplicateOf: seed } });
  }

  function scrollToReplenishment() {
    document.getElementById("reposicao")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pageTitle = isEditing ? "Editar insumo" : "Novo insumo";
  const currentStock = existingMaterial?.currentStock ?? 0;
  const bucket = materialBucket({ currentStock, minStock: form.minStock, maxStock: form.maxStock });

  return (
    <div className="flex flex-col gap-6">
      <FormPageHeader title={pageTitle} crumbs={[{ label: "Matérias-primas", to: "/admin/materias-primas" }, { label: pageTitle }]}>
        <Button type="button" variant="outline" onClick={() => navigate("/admin/materias-primas")}>
          <ArrowLeft size={16} /> Voltar
        </Button>
        {isEditing && existingMaterial && (
          <Link to={`/admin/materias-primas/entrada?insumo=${existingMaterial.id}`}>
            <Button type="button" variant="outline">
              <PackagePlus size={16} /> Nova entrada
            </Button>
          </Link>
        )}
        {isEditing && (
          <Button type="button" variant="outline" onClick={handleDuplicate}>
            <Copy size={16} /> Duplicar
          </Button>
        )}
        <Button type="submit" form="material-form" variant="secondary" disabled={saving}>
          <Save size={16} /> {saving ? "Salvando..." : "Salvar insumo"}
        </Button>
      </FormPageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <form id="material-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <RawMaterialFormFields
            form={form}
            errors={errors}
            unitLocked={isEditing && (existingMaterial?.unitLocked ?? false)}
            currentStock={currentStock}
            code={existingMaterial?.code ?? ""}
            isEditing={isEditing}
            suppliers={suppliers}
            onChange={handleChange}
          />

          <ProductStockStatusBar
            currentStock={currentStock}
            minStock={form.minStock}
            maxStock={form.maxStock}
            level={bucket}
            unit={form.controlUnit}
            subject="Insumo"
            onConfigure={scrollToReplenishment}
          />

          <div className="flex gap-3 lg:hidden">
            <Button type="submit" size="lg" variant="secondary" className="flex-1" disabled={saving}>
              <Save size={18} /> {saving ? "Salvando..." : "Salvar insumo"}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <RawMaterialSummaryCard form={form} material={existingMaterial} bucket={isEditing ? bucket : undefined} />
          <RawMaterialCostCard form={form} material={existingMaterial} />
        </div>
      </div>
    </div>
  );
}
