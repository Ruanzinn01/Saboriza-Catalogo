export interface SnapshotOrderRow {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  company_name: string;
  total_units: number;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NEW" | "IN_REVIEW";
  separation_queued_at: string | null;
  separation_started_at: string | null;
  separation_finished_at: string | null;
  separation_responsible: string | null;
  separation_started_by: string | null;
  separation_completed_by: string | null;
}

export interface SnapshotItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  presentation: string;
  weight_volume: string;
  total_units: number;
  packs_quantity: number;
  pack_quantity: number;
  separated_at: string | null;
}

export interface SnapshotProductRow {
  id: string;
  image_url: string;
  code: string | null;
  gtin: string;
}

export interface SnapshotAdjustmentRow {
  id: string;
  order_id: string;
  order_item_id: string | null;
  message: string;
  status: "pending" | "resolved";
  created_by: string | null;
  created_at: string;
}

export interface SeparationSnapshot {
  orders: SnapshotOrderRow[];
  items: SnapshotItemRow[];
  products: SnapshotProductRow[];
  adjustments: SnapshotAdjustmentRow[];
}

export interface SeparationSignal {
  order_id: string;
  status: string;
  responsible: string | null;
  separation_finished: boolean;
  version: number;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseSnapshot(data: unknown): SeparationSnapshot | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = data as Record<string, unknown>;
  if (!Array.isArray(raw.orders)) return null;
  return {
    orders: asArray<SnapshotOrderRow>(raw.orders),
    items: asArray<SnapshotItemRow>(raw.items),
    products: asArray<SnapshotProductRow>(raw.products).map((product) => ({ ...product, image_url: product.image_url ?? "", gtin: product.gtin ?? "" })),
    adjustments: asArray<SnapshotAdjustmentRow>(raw.adjustments),
  };
}

/** Banco ainda sem as funções de leitura mínima: o frontend segue no modo direto. */
export function isMissingFunctionError(message: string): boolean {
  return /PGRST202|schema cache|Could not find the function|does not exist/i.test(message);
}

/** Pedido que acabou de entrar na fila: confirmado, sem separação concluída e ainda desconhecido pelo cliente. */
export function isNewInQueue(signal: Pick<SeparationSignal, "order_id" | "status" | "separation_finished">, knownQueueIds: ReadonlySet<string>): boolean {
  return signal.status === "CONFIRMED" && !signal.separation_finished && !knownQueueIds.has(signal.order_id);
}

export const REFRESH_DEBOUNCE_MS = 250;
