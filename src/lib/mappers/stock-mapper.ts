import type { StockMovement } from "@/types/stock";
import type { Database } from "@/types/supabase";

type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];

export function stockMovementFromRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    variation: row.variation,
    origin: row.origin as StockMovement["origin"],
    referenceId: row.reference_id,
    responsibleId: row.responsible_id,
    observation: row.observation,
    previousBalance: row.previous_balance,
    newBalance: row.new_balance,
    createdAt: row.created_at,
  };
}
