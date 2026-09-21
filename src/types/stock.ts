export type StockMovementOrigin = "production" | "entry" | "order" | "adjustment";

export interface StockMovement {
  id: string;
  productId: string;
  variation: number;
  origin: StockMovementOrigin;
  referenceId: string | null;
  responsibleId: string | null;
  observation: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
}
