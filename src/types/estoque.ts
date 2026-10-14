export type StockItemType = "PRODUCT" | "RAW_MATERIAL";

export type StockSituation = "OUT" | "LOW" | "OK" | "OVER";

export interface StockPositionItem {
  itemType: StockItemType;
  itemId: string;
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  isActive: boolean;
  physical: number;
  reserved: number;
  available: number;
  minStock: number;
  maxStock: number;
  avgCost: number | null;
  stockValue: number | null;
  situation: StockSituation;
}

export type LedgerMovementType =
  | "ENTRY"
  | "PURCHASE_ENTRY"
  | "PURCHASE_RETURN"
  | "SALE_OUT"
  | "PRODUCTION_IN"
  | "PRODUCTION_CONSUMPTION"
  | "REVERSAL"
  | "INVENTORY_ADJUSTMENT"
  | "MANUAL_ADJUSTMENT";

export interface LedgerRow {
  ledgerId: string;
  itemType: StockItemType;
  itemId: string;
  movementType: LedgerMovementType;
  quantity: number;
  previousBalance: number | null;
  newBalance: number | null;
  sourceKind: string;
  sourceId: string | null;
  note: string;
  occurredAt: string;
  unitCost: number | null;
}

export type AdjustmentStatus = "NONE" | "APPROVED" | "DISMISSED";

export interface DivergenceRow {
  countId: string;
  sessionItemId: string;
  itemType: StockItemType;
  name: string;
  sku: string;
  round: number;
  isLatest: boolean;
  baseQuantity: number;
  expectedBalance: number;
  difference: number;
  countedByName: string;
  countedAt: string;
  adjustmentStatus: AdjustmentStatus;
  justification: string | null;
}
