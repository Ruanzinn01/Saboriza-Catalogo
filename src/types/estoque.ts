export type StockItemType = "PRODUCT" | "RAW_MATERIAL";

export type StockHealth =
  | "DIVERGENCE"
  | "ZERO"
  | "NO_HISTORY"
  | "NO_RECENT_DEMAND"
  | "CRITICAL"
  | "LOW"
  | "HEALTHY"
  | "ABOVE_IDEAL"
  | "EXCESS";

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
  incoming: number;
  inProduction: number;
  minStock: number;
  maxStock: number;
  dailyRate: number | null;
  historyDays: number;
  coverageDays: number | null;
  netNeed: number | null;
  unitCost: number | null;
  stockValue: number | null;
  excessQty: number;
  excessValue: number;
  idleDays: number | null;
  health: StockHealth;
  policyMin: number;
  policyIdeal: number;
  policyMax: number;
}

export interface StockPolicyRow {
  id: string;
  unitId: string;
  scope: "ALL" | "PRODUCT" | "RAW_MATERIAL";
  minDays: number;
  idealDays: number;
  maxDays: number;
  justification: string;
  createdAt: string;
}

export type LedgerMovementType =
  | "ENTRY"
  | "PURCHASE_ENTRY"
  | "PURCHASE_RETURN"
  | "CUSTOMER_RETURN"
  | "LOSS"
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

export type LossKind = "EXPIRY" | "BREAKAGE" | "CONTAMINATION" | "DAMAGE" | "OTHER";

export interface StockReturnRow {
  id: string;
  source: "CANCELLATION" | "PARTIAL_DELIVERY";
  sourceRef: string;
  productId: string;
  productName: string;
  expectedUnits: number;
  status: "AWAITING" | "CONFIRMED";
  goodUnits: number | null;
  badUnits: number | null;
  notes: string;
  createdAt: string;
}

export interface LossRow {
  id: string;
  itemType: StockItemType;
  itemId: string;
  itemName: string;
  quantity: number;
  kind: LossKind;
  occurredOn: string;
  reason: string;
  unitCost: number | null;
  totalCost: number | null;
  source: "MANUAL" | "RETURN";
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
