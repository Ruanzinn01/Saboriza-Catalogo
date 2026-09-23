import type { AdjustmentRequest } from "@/types/separation";

export interface FulfillmentOrder {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  companyName: string;
  totalAmount: number;
  status: "COMPLETED" | "FINALIZADO";
  loadingQueuedAt: string | null;
  loadingStartedAt: string | null;
  loadingFinishedAt: string | null;
  loadingResponsible: string | null;
  loadingStartedBy: string | null;
  loadingCompletedBy: string | null;
  deliveryConfirmedAt: string | null;
  deliveryConfirmedBy: string | null;
  deliverySignatureUrl: string | null;
  items: FulfillmentItem[];
  pendingAdjustments: AdjustmentRequest[];
}

export interface FulfillmentItem {
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
  loadedAt: string | null;
}
