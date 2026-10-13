import type { StatusTone } from "@/components/ui/StatusBadge";
import type { LedgerMovementType, StockItemType, StockPositionItem, StockSituation } from "@/types/estoque";

export const SITUATION_LABEL: Record<StockSituation, string> = {
  OUT: "Zerado",
  LOW: "Abaixo do mínimo",
  OK: "Saudável",
  OVER: "Acima do máximo",
};

export const SITUATION_TONE: Record<StockSituation, StatusTone> = {
  OUT: "out",
  LOW: "warning",
  OK: "ok",
  OVER: "neutral",
};

export const ITEM_TYPE_LABEL: Record<StockItemType, string> = {
  PRODUCT: "Produto",
  RAW_MATERIAL: "Matéria-prima",
};

export const MOVEMENT_LABEL: Record<LedgerMovementType, string> = {
  ENTRY: "Entrada manual",
  PURCHASE_ENTRY: "Entrada de compra",
  SALE_OUT: "Saída de pedido",
  PRODUCTION_IN: "Entrada de produção",
  PRODUCTION_CONSUMPTION: "Consumo de produção",
  REVERSAL: "Estorno",
  INVENTORY_ADJUSTMENT: "Ajuste de inventário",
  MANUAL_ADJUSTMENT: "Ajuste manual",
};

export interface PositionSummary {
  total: number;
  zeroed: number;
  low: number;
  over: number;
  reservedUnits: number;
  valueAtCost: number;
  itemsWithoutCost: number;
}

export function summarizePosition(items: StockPositionItem[]): PositionSummary {
  return items.reduce<PositionSummary>(
    (summary, item) => ({
      total: summary.total + 1,
      zeroed: summary.zeroed + (item.situation === "OUT" ? 1 : 0),
      low: summary.low + (item.situation === "LOW" ? 1 : 0),
      over: summary.over + (item.situation === "OVER" ? 1 : 0),
      reservedUnits: summary.reservedUnits + item.reserved,
      valueAtCost: summary.valueAtCost + (item.stockValue ?? 0),
      itemsWithoutCost: summary.itemsWithoutCost + (item.stockValue === null && item.physical > 0 ? 1 : 0),
    }),
    { total: 0, zeroed: 0, low: 0, over: 0, reservedUnits: 0, valueAtCost: 0, itemsWithoutCost: 0 }
  );
}

// Primeira contagem sem divergência / itens contados. Sem contagens a acuracidade é indisponível (null).
export function accuracy(counted: number, divergences: number): number | null {
  if (counted <= 0) return null;
  return Math.round(((counted - divergences) / counted) * 1000) / 10;
}
