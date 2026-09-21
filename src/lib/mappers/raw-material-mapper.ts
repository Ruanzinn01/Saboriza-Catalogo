import type { RawMaterial, ControlUnit, CostBasis } from "@/types/raw-material";
import type { Database } from "@/types/supabase";

type RawMaterialRow = Database["public"]["Tables"]["raw_materials"]["Row"];

export function rawMaterialFromRow(row: RawMaterialRow): RawMaterial {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    controlUnit: row.control_unit as ControlUnit,
    imageUrl: row.image_url,
    purchaseUnitLabel: row.purchase_unit_label,
    purchaseUnitFactor: row.purchase_unit_factor,
    minStock: row.min_stock,
    maxStock: row.max_stock,
    currentStock: row.current_stock,
    avgCost: row.avg_cost,
    minPurchaseQty: row.min_purchase_qty,
    defaultReorderQty: row.default_reorder_qty,
    purchaseMultiple: row.purchase_multiple,
    leadTimeDays: row.lead_time_days,
    costBasis: row.cost_basis as CostBasis,
    manualCost: row.manual_cost,
    primarySupplierId: row.primary_supplier_id,
    isActive: row.is_active,
    unitLocked: row.unit_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
