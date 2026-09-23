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
}
