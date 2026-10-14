export type InventoryState = "PENDING" | "COUNTED" | "DIVERGENCE" | "RECOUNT";

export type InventorySessionStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "CLOSED_INCOMPLETE";

export type InventoryScope = "ALL" | "PRODUCTS" | "RAW_MATERIALS";

export interface InventorySession {
  id: string;
  unitId: string;
  unitName: string;
  modality: "SCHEDULED" | "EXTRAORDINARY";
  scopeKind: InventoryScope;
  competence: string;
  locationLabel: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: InventorySessionStatus;
  total: number;
  counted: number;
  divergences: number;
  pending: number;
  recount: number;
  group1Total: number;
  group1Counted: number;
  group2Total: number;
  group2Counted: number;
  canManage: boolean;
}

export interface InventoryItem {
  id: string;
  itemType: "PRODUCT" | "RAW_MATERIAL";
  itemId: string;
  groupNo: 1 | 2;
  name: string;
  presentation: string;
  kindLabel: string;
  sku: string;
  barcode: string;
  imageUrl: string;
  baseUnit: string;
  packLabel: string | null;
  state: InventoryState;
}

export interface InventoryCountSession {
  token: string;
  name: string;
  presentation: string;
  kindLabel: string;
  sku: string;
  imageUrl: string;
  baseUnit: string;
  packLabel: string | null;
  packFactor: number | null;
  divisible: boolean;
}

export interface InventoryCountResult {
  countId: string;
  round: number;
  baseQuantity: number;
  expectedBalance: number;
  difference: number;
  replayed: boolean;
}

export interface InventoryResultRow {
  sessionItemId: string;
  name: string;
  sku: string;
  round: number;
  baseQuantity: number;
  expectedBalance: number;
  difference: number;
  countedByName: string;
  countedAt: string;
}

export type InventoryFilter = "todos" | "pendentes" | "contados" | "divergencias" | "recontagem";
