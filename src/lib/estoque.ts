import type { StatusTone } from "@/components/ui/StatusBadge";
import type { LedgerMovementType, StockHealth, StockItemType, StockPositionItem } from "@/types/estoque";

export const HEALTH_LABEL: Record<StockHealth, string> = {
  DIVERGENCE: "Divergência",
  ZERO: "Zerado",
  NO_HISTORY: "Sem histórico",
  NO_RECENT_DEMAND: "Sem consumo recente",
  CRITICAL: "Crítico",
  LOW: "Baixo",
  HEALTHY: "Saudável",
  ABOVE_IDEAL: "Acima do ideal",
  EXCESS: "Excesso",
};

export const HEALTH_TONE: Record<StockHealth, StatusTone> = {
  DIVERGENCE: "critical",
  ZERO: "out",
  NO_HISTORY: "neutral",
  NO_RECENT_DEMAND: "neutral",
  CRITICAL: "critical",
  LOW: "warning",
  HEALTHY: "ok",
  ABOVE_IDEAL: "neutral",
  EXCESS: "neutral",
};

// Mesmas cores do protótipo de Estoque (faixas de saúde).
export const HEALTH_COLOR: Record<StockHealth, string> = {
  DIVERGENCE: "#bf5a50",
  ZERO: "#bf5a50",
  NO_HISTORY: "#98a49a",
  NO_RECENT_DEMAND: "#788078",
  CRITICAL: "#c78132",
  LOW: "#d2a640",
  HEALTHY: "#208252",
  ABOVE_IDEAL: "#438b83",
  EXCESS: "#7966a6",
};

export const HEALTH_FILTER_ORDER: StockHealth[] = ["ZERO", "CRITICAL", "LOW", "HEALTHY", "ABOVE_IDEAL", "EXCESS", "NO_HISTORY", "NO_RECENT_DEMAND"];

export const ITEM_TYPE_LABEL: Record<StockItemType, string> = {
  PRODUCT: "Produto",
  RAW_MATERIAL: "Matéria-prima",
};

export const ITEM_TYPE_PLURAL: Record<StockItemType, string> = {
  PRODUCT: "Produtos",
  RAW_MATERIAL: "Matérias-primas",
};

export const ITEM_TYPE_COLOR: Record<StockItemType, string> = {
  PRODUCT: "#357db5",
  RAW_MATERIAL: "#208252",
};

export const MOVEMENT_LABEL: Record<LedgerMovementType, string> = {
  ENTRY: "Entrada manual",
  PURCHASE_ENTRY: "Entrada de compra",
  PURCHASE_RETURN: "Devolução ao fornecedor",
  SALE_OUT: "Saída de pedido",
  PRODUCTION_IN: "Entrada de produção",
  PRODUCTION_CONSUMPTION: "Consumo de produção",
  REVERSAL: "Estorno",
  INVENTORY_ADJUSTMENT: "Ajuste de inventário",
  MANUAL_ADJUSTMENT: "Ajuste manual",
};

export interface PositionSummary {
  total: number;
  valueAtCost: number;
  itemsWithoutCost: number;
  reservedUnits: number;
  byHealth: Record<StockHealth, number>;
  excessValue: number;
  excessItems: number;
  idleValue: number;
  idleItems: number;
  netNeedValue: number;
  withoutDemand: number;
}

const EMPTY_HEALTH: Record<StockHealth, number> = {
  DIVERGENCE: 0,
  ZERO: 0,
  NO_HISTORY: 0,
  NO_RECENT_DEMAND: 0,
  CRITICAL: 0,
  LOW: 0,
  HEALTHY: 0,
  ABOVE_IDEAL: 0,
  EXCESS: 0,
};

export const IDLE_THRESHOLD_DAYS = 90;

export function summarizePosition(items: StockPositionItem[]): PositionSummary {
  const summary: PositionSummary = {
    total: 0,
    valueAtCost: 0,
    itemsWithoutCost: 0,
    reservedUnits: 0,
    byHealth: { ...EMPTY_HEALTH },
    excessValue: 0,
    excessItems: 0,
    idleValue: 0,
    idleItems: 0,
    netNeedValue: 0,
    withoutDemand: 0,
  };
  for (const item of items) {
    summary.total += 1;
    summary.valueAtCost += item.stockValue ?? 0;
    if (item.stockValue === null && item.physical > 0) summary.itemsWithoutCost += 1;
    summary.reservedUnits += item.reserved;
    summary.byHealth[item.health] += 1;
    if (item.excessQty > 0) {
      summary.excessItems += 1;
      summary.excessValue += item.excessValue;
    }
    if (item.physical > 0 && item.idleDays !== null && item.idleDays >= IDLE_THRESHOLD_DAYS) {
      summary.idleItems += 1;
      summary.idleValue += item.stockValue ?? 0;
    }
    summary.netNeedValue += (item.netNeed ?? 0) * (item.unitCost ?? 0);
    if (item.dailyRate === null) summary.withoutDemand += 1;
  }
  return summary;
}

// Primeira contagem sem divergência / itens contados. Sem contagens a acuracidade é indisponível (null).
export function accuracy(counted: number, divergences: number): number | null {
  if (counted <= 0) return null;
  return Math.round(((counted - divergences) / counted) * 1000) / 10;
}

// Texto de cada faixa conforme a política vigente (dias), igual aos cartões de saúde do protótipo.
export function healthRangeNote(health: StockHealth, policy: { min: number; ideal: number; max: number }): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  switch (health) {
    case "ZERO":
      return "Físico igual a zero";
    case "CRITICAL":
      return `Abaixo de ${fmt(policy.min / 2)} dias`;
    case "LOW":
      return `${fmt(policy.min / 2)} até abaixo de ${fmt(policy.min)} dias`;
    case "HEALTHY":
      return `${fmt(policy.min)} a ${fmt(policy.ideal)} dias`;
    case "ABOVE_IDEAL":
      return `Acima de ${fmt(policy.ideal)} até ${fmt(policy.max)} dias`;
    case "EXCESS":
      return `Acima de ${fmt(policy.max)} dias`;
    case "NO_HISTORY":
      return "Sem base de demanda";
    case "NO_RECENT_DEMAND":
      return "Sem consumo na janela";
    case "DIVERGENCE":
      return "Saldo inválido";
  }
}
