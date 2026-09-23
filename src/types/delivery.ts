export type DeliveryResult = "COMPLETE" | "PARTIAL";
export type ReceiverDocType = "CPF" | "RG";
export type DivergenceReason = "missing" | "damaged" | "refused" | "quantity_mismatch" | "delivered_by_mistake" | "other";

export const DIVERGENCE_REASON_LABELS: Record<DivergenceReason, string> = {
  missing: "Faltante",
  damaged: "Avariado",
  refused: "Recusado",
  quantity_mismatch: "Quantidade divergente",
  delivered_by_mistake: "Entregue por engano",
  other: "Outro",
};

export const RECEIVER_ROLES = ["Proprietário(a)", "Gerente", "Caixa", "Financeiro", "Compras", "Estoquista", "Funcionário(a)", "Outro"] as const;

export interface DivergenceInput {
  orderItemId: string;
  productName: string;
  presentation: string;
  packQuantity: number;
  packsOrdered: number;
  packsNotDelivered: number;
  packPrice: number;
  reason: DivergenceReason;
  reasonDetail: string;
}

export interface DeliveryFormData {
  result: DeliveryResult;
  receiverName: string;
  docType: ReceiverDocType;
  doc: string;
  role: string;
  notes: string;
  divergences: DivergenceInput[];
}
