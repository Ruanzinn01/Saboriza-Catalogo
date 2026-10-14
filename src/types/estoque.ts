export type StockItemType = "PRODUCT" | "RAW_MATERIAL";

export type StockGroup = "PRODUCT" | "MATERIAL" | "PACKAGING" | "SUPPLY";

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
  group: StockGroup;
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
  | "PURCHASE_CORRECTION"
  | "CUSTOMER_RETURN"
  | "INITIAL_BALANCE"
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

export interface ReportItem {
  item_type: StockItemType;
  sku: string;
  name: string;
  category: string;
  base_unit: string;
  physical: number;
  reserved: number;
  available: number;
  incoming: number;
  in_production: number;
  unit_cost: number | null;
  stock_value: number | null;
  coverage_days: number | null;
  net_need: number | null;
  health: StockHealth;
}

export interface ReportPolicy {
  min_days: number;
  ideal_days: number;
  max_days: number;
}

export interface ReportData {
  title: string;
  company: string;
  unit: string;
  periodLabel: string;
  generatedAt: string;
  closed: boolean;
  items: ReportItem[];
  movements: { type: string; count: number; quantity: number }[];
  inventory: { items: number; counted: number; divergences: number }[];
  losses: { count: number; total_cost: number; unknown_cost: number; awaiting_returns: number } | null;
  policy: { product?: ReportPolicy; raw_material?: ReportPolicy } | null;
}

export interface ClosingRow {
  id: string;
  competence: string;
  partial: boolean;
  itemsCount: number;
  totalValue: number;
  entriesValue: number;
  exitsValue: number;
  closedAt: string;
  snapshot: Record<string, unknown>;
}

export interface IntegrationStatusRow {
  originKey: string;
  lastEventAt: string | null;
  events30d: number;
  pending: number;
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
