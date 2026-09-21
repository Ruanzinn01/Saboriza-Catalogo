export const CONTROL_UNITS = ["kg", "g", "L", "mL", "un"] as const;
export type ControlUnit = (typeof CONTROL_UNITS)[number];

export const COST_BASES = ["avg_cost", "last_cost", "manual"] as const;
export type CostBasis = (typeof COST_BASES)[number];

export const COST_BASIS_LABELS: Record<CostBasis, string> = {
  avg_cost: "Custo médio",
  last_cost: "Último custo",
  manual: "Custo manual",
};

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  controlUnit: ControlUnit;
  imageUrl: string;
  purchaseUnitLabel: string;
  purchaseUnitFactor: number;
  minStock: number;
  maxStock: number;
  currentStock: number;
  avgCost: number;
  minPurchaseQty: number;
  defaultReorderQty: number;
  purchaseMultiple: number;
  leadTimeDays: number;
  costBasis: CostBasis;
  manualCost: number;
  primarySupplierId: string | null;
  isActive: boolean;
  unitLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RawMaterialInput = Omit<
  RawMaterial,
  "id" | "code" | "currentStock" | "avgCost" | "unitLocked" | "createdAt" | "updatedAt"
>;

export type StockStatus = "ok" | "low" | "out";

export function rawMaterialStockStatus(material: Pick<RawMaterial, "currentStock" | "minStock">): StockStatus {
  if (material.currentStock <= 0) return "out";
  if (material.currentStock <= material.minStock) return "low";
  return "ok";
}

export type EntryStatus = "draft" | "confirmed" | "reversed";

export interface RawMaterialEntry {
  id: string;
  rawMaterialId: string;
  supplierId: string;
  status: EntryStatus;
  packagesQuantity: number;
  unitPrice: number;
  conversionFactor: number | null;
  controlQuantity: number | null;
  totalValue: number | null;
  batch: string;
  expiryDate: string;
  entryDate: string;
  invoiceNumber: string;
  invoiceSeries: string;
  invoiceIssueDate: string | null;
  invoiceAccessKey: string;
  responsibleId: string | null;
  previousBalance: number | null;
  newBalance: number | null;
  reversalReason: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RawMaterialEntryInput = Omit<
  RawMaterialEntry,
  | "id"
  | "status"
  | "conversionFactor"
  | "controlQuantity"
  | "totalValue"
  | "responsibleId"
  | "previousBalance"
  | "newBalance"
  | "reversalReason"
  | "reversedAt"
  | "reversedBy"
  | "createdAt"
  | "updatedAt"
>;
