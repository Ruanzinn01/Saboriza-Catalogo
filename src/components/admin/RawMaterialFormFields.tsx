import { ActiveStatusSelect } from "@/components/admin/ActiveStatusSelect";
import { FormCard } from "@/components/admin/FormCard";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RawMaterialCategoryField } from "@/components/admin/RawMaterialCategoryField";
import { ReadOnlyCodeField } from "@/components/admin/ReadOnlyCodeField";
import { StockRangeGauge } from "@/components/admin/StockRangeGauge";
import { Input } from "@/components/ui/Input";
import { CONTROL_UNITS, COST_BASES, COST_BASIS_LABELS } from "@/types/raw-material";
import type { RawMaterialInput } from "@/types/raw-material";
import type { Supplier } from "@/types/supplier";

export type RawMaterialFormField =
  | "name"
  | "controlUnit"
  | "defaultReorderQty"
  | "minPurchaseQty"
  | "purchaseMultiple"
  | "maxStock"
  | "manualCost";

interface RawMaterialFormFieldsProps {
  form: RawMaterialInput;
  errors: Partial<Record<RawMaterialFormField, string>>;
  unitLocked: boolean;
  currentStock?: number;
  code?: string;
  isEditing?: boolean;
  suppliers: Supplier[];
  onChange: <K extends keyof RawMaterialInput>(key: K, value: RawMaterialInput[K]) => void;
}

const selectClasses =
  "h-11 rounded-xl border border-ink-900/15 bg-white px-4 text-sm text-ink-900 outline-none focus:border-forest-700";

export function RawMaterialFormFields({
  form,
  errors,
  unitLocked,
  currentStock = 0,
  code = "",
  isEditing = false,
  suppliers,
  onChange,
}: RawMaterialFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormCard
        title="Informações básicas"
        action={<ActiveStatusSelect value={form.isActive} onChange={(active) => onChange("isActive", active)} ariaLabel="Situação do insumo" />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.7fr_1fr]">
          <Input label="Nome do insumo *" value={form.name} onChange={(e) => onChange("name", e.target.value)} error={errors.name} />
          <ReadOnlyCodeField label="Código Referência / SKU" value={code} placeholder={isEditing ? "" : "Gerado ao salvar"} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Descrição</span>
          <textarea
            value={form.description}
            onChange={(e) => onChange("description", e.target.value)}
            rows={3}
            className="rounded-xl border border-ink-900/15 bg-white px-4 py-3 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </label>

        <RawMaterialCategoryField value={form.category} onChange={(name) => onChange("category", name)} />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-900">Imagem do insumo</span>
          <ImageUploader onUploaded={(url) => onChange("imageUrl", url)} />
          <Input
            aria-label="Imagem (URL)"
            value={form.imageUrl}
            onChange={(e) => onChange("imageUrl", e.target.value)}
            placeholder="ou cole a URL da imagem: https://..."
          />
        </div>
      </FormCard>

      <FormCard title="Unidade e embalagem">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Unidade de controle</span>
            <select
              value={form.controlUnit}
              disabled={unitLocked}
              onChange={(e) => onChange("controlUnit", e.target.value as RawMaterialInput["controlUnit"])}
              className={`${selectClasses} disabled:cursor-not-allowed disabled:bg-ink-900/5 disabled:text-ink-muted`}
            >
              {CONTROL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {unitLocked && <span className="text-xs text-ink-muted">Travada após a primeira movimentação.</span>}
            {errors.controlUnit && <span className="text-xs text-red-600">{errors.controlUnit}</span>}
          </label>
          <Input
            label="Embalagem de compra"
            value={form.purchaseUnitLabel}
            onChange={(e) => onChange("purchaseUnitLabel", e.target.value)}
            placeholder="Ex: Saco 25kg"
          />
          <div className="sm:col-span-2">
            <Input
              label={`Unidades de controle por embalagem (${form.controlUnit || "un"})`}
              type="number"
              min={0.0001}
              step="any"
              value={form.purchaseUnitFactor}
              onChange={(e) => onChange("purchaseUnitFactor", Number(e.target.value))}
            />
          </div>
        </div>
      </FormCard>

      <FormCard title="Reposição / Compras" id="reposicao">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={`Estoque mínimo (${form.controlUnit})`}
            type="number"
            min={0}
            step="any"
            value={form.minStock}
            onChange={(e) => onChange("minStock", Number(e.target.value))}
          />
          <Input
            label={`Estoque máximo (${form.controlUnit})`}
            type="number"
            min={0}
            step="any"
            value={form.maxStock}
            onChange={(e) => onChange("maxStock", Number(e.target.value))}
            error={errors.maxStock}
          />
        </div>
        <p className="-mt-2 text-xs text-ink-muted">Use 0 no máximo quando não houver limite.</p>
        <StockRangeGauge currentStock={currentStock} minStock={form.minStock} maxStock={form.maxStock} unit={form.controlUnit} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Prazo médio de reposição (dias)"
            type="number"
            min={0}
            step={1}
            value={form.leadTimeDays}
            onChange={(e) => onChange("leadTimeDays", Math.max(0, Math.trunc(Number(e.target.value))))}
          />
          <Input
            label={`Quantidade mínima de compra (${form.controlUnit})`}
            type="number"
            min={0}
            step="any"
            value={form.minPurchaseQty}
            onChange={(e) => onChange("minPurchaseQty", Number(e.target.value))}
            error={errors.minPurchaseQty}
          />
          <Input
            label={`Quantidade padrão de reposição (${form.controlUnit})`}
            type="number"
            min={0}
            step="any"
            value={form.defaultReorderQty}
            onChange={(e) => onChange("defaultReorderQty", Number(e.target.value))}
            error={errors.defaultReorderQty}
          />
          <Input
            label={`Múltiplo de compra (${form.controlUnit})`}
            type="number"
            min={0}
            step="any"
            value={form.purchaseMultiple}
            onChange={(e) => onChange("purchaseMultiple", Number(e.target.value))}
            error={errors.purchaseMultiple}
          />
        </div>
        <p className="-mt-2 text-xs text-ink-muted">Use 0 nos campos de quantidade, múltiplo e prazo quando não houver regra definida.</p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900">Fornecedor principal</span>
          <select
            value={form.primarySupplierId ?? ""}
            onChange={(e) => onChange("primarySupplierId", e.target.value || null)}
            className={selectClasses}
          >
            <option value="">Nenhum</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.tradeName || supplier.companyName}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">Referência. Não impede compra de outro fornecedor.</span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900">Base de custo para previsão</span>
            <select
              value={form.costBasis}
              onChange={(e) => onChange("costBasis", e.target.value as RawMaterialInput["costBasis"])}
              className={selectClasses}
            >
              {COST_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {COST_BASIS_LABELS[basis]}
                </option>
              ))}
            </select>
          </label>
          {form.costBasis === "manual" && (
            <Input
              label={`Custo manual (R$ por ${form.controlUnit})`}
              type="number"
              min={0}
              step="any"
              value={form.manualCost}
              onChange={(e) => onChange("manualCost", Number(e.target.value))}
              error={errors.manualCost}
            />
          )}
        </div>
      </FormCard>
    </div>
  );
}
