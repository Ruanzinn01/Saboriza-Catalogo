import type { Product } from "@/types/product";
import type { Order } from "@/types/order";
import { healthLevel, situationLabel, situationTone, type HealthLevel, type SituationTone } from "@/lib/stock-insights";

export interface ProductionSuggestion {
  product: Product;
  level: HealthLevel;
  tone: SituationTone;
  label: string;
  demandUnits: number;
  missingUnits: number;
  suggestedPacks: number;
}

const TONE_ORDER: Record<SituationTone, number> = { out: 0, critical: 1, warning: 2, ok: 3 };

export function buildDemandByProduct(orders: Order[]): Map<string, number> {
  const demand = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "CONFIRMED") continue;
    for (const item of order.items) {
      demand.set(item.productId, (demand.get(item.productId) ?? 0) + item.packs * item.packQuantity);
    }
  }
  return demand;
}

export function buildProductionSuggestions(products: Product[], orders: Order[]): ProductionSuggestion[] {
  const demand = buildDemandByProduct(orders);

  return products
    .filter((product) => product.active)
    .map((product): ProductionSuggestion => {
      const demandUnits = demand.get(product.id) ?? 0;
      const targetUnits = Math.max(product.minStock * 1.5, demandUnits);
      const missingUnits = Math.max(0, targetUnits - product.currentStock);
      const packSize = Math.max(1, product.packQuantity);
      return {
        product,
        level: healthLevel(product),
        tone: situationTone(product),
        label: situationLabel(product),
        demandUnits,
        missingUnits,
        suggestedPacks: Math.max(1, Math.ceil(missingUnits / packSize)),
      };
    })
    .filter((suggestion) => suggestion.level !== "green" || suggestion.missingUnits > 0)
    .sort(
      (a, b) =>
        TONE_ORDER[a.tone] - TONE_ORDER[b.tone] ||
        b.missingUnits - a.missingUnits ||
        a.product.name.localeCompare(b.product.name)
    );
}

export interface HealthCounts {
  green: number;
  yellow: number;
  red: number;
  outOfStock: number;
}

export function countProductHealth(products: Product[]): HealthCounts {
  const counts: HealthCounts = { green: 0, yellow: 0, red: 0, outOfStock: 0 };
  for (const product of products) {
    if (!product.active) continue;
    counts[healthLevel(product)] += 1;
    if (product.currentStock <= 0) counts.outOfStock += 1;
  }
  return counts;
}
