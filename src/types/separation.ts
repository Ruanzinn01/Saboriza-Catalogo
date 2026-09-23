export interface SeparationOrder {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  companyName: string;
  totalUnits: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  responsible: string | null;
  startedBy: string | null;
  completedBy: string | null;
  items: SeparationItem[];
  pendingAdjustments: AdjustmentRequest[];
}

export interface SeparationItem {
  id: string;
  productId: string | null;
  productName: string;
  presentation: string;
  weightVolume: string;
  imageUrl: string;
  code: string | null;
  gtin: string | null;
  totalUnits: number;
  packsQuantity: number;
  packQuantity: number;
  separatedAt: string | null;
}

export interface AdjustmentRequest {
  id: string;
  orderId: string;
  orderItemId: string | null;
  message: string;
  status: "pending" | "resolved";
  createdBy: string | null;
  createdAt: string;
}

export type AgingLevel = "normal" | "atencao" | "laranja-claro" | "laranja-forte" | "vermelho" | "critico";
