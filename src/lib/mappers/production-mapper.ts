import type { ProductRecipeLine, ProductionConsumption, ProductionRecord } from "@/types/production";
import type { Database } from "@/types/supabase";

type RecipeRow = Database["public"]["Tables"]["product_recipe"]["Row"];
type ProductionRow = Database["public"]["Tables"]["production_records"]["Row"];
type ConsumptionRow = Database["public"]["Tables"]["production_consumptions"]["Row"];

export function productRecipeLineFromRow(row: RecipeRow): ProductRecipeLine {
  return {
    id: row.id,
    productId: row.product_id,
    rawMaterialId: row.raw_material_id,
    quantityPerUnit: row.quantity_per_unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function productionRecordFromRow(row: ProductionRow): ProductionRecord {
  return {
    id: row.id,
    productId: row.product_id,
    packsQuantity: row.packs_quantity,
    unitsQuantity: row.units_quantity,
    status: row.status,
    responsibleId: row.responsible_id,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
  };
}

export function productionConsumptionFromRow(row: ConsumptionRow): ProductionConsumption {
  return {
    id: row.id,
    productionRecordId: row.production_record_id,
    rawMaterialId: row.raw_material_id,
    neededQuantity: row.needed_quantity,
    consumedQuantity: row.consumed_quantity,
    previousBalance: row.previous_balance,
    newBalance: row.new_balance,
    createdAt: row.created_at,
  };
}
