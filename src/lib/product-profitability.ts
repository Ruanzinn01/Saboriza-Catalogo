import type { ProductRecipeLine } from "@/types/production";
import type { RawMaterial } from "@/types/raw-material";

export interface UnitCost {
  cost: number;
  hasRecipe: boolean;
  materialsWithoutCost: number;
}

export type ProfitabilityStatus = "no-recipe" | "no-price" | "on-target" | "below-target";

export interface Profitability {
  status: ProfitabilityStatus;
  cost: number;
  price: number;
  profit: number | null;
  marginPct: number | null;
  targetPct: number;
  gapPp: number | null;
  missingToTargetPct: number;
}

export function computeUnitCost(lines: ProductRecipeLine[], materials: RawMaterial[]): UnitCost {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  let cost = 0;
  let materialsWithoutCost = 0;

  for (const line of lines) {
    const material = materialById.get(line.rawMaterialId);
    if (!material || material.avgCost <= 0) {
      materialsWithoutCost += 1;
      continue;
    }
    cost += line.quantityPerUnit * material.avgCost;
  }

  return { cost, hasRecipe: lines.length > 0, materialsWithoutCost };
}

export function computeProfitability(price: number, unitCost: UnitCost, targetPct: number): Profitability {
  const base = { cost: unitCost.cost, price, targetPct };

  if (!unitCost.hasRecipe) {
    return { ...base, status: "no-recipe", profit: null, marginPct: null, gapPp: null, missingToTargetPct: 0 };
  }
  if (price <= 0) {
    return { ...base, status: "no-price", profit: null, marginPct: null, gapPp: null, missingToTargetPct: 0 };
  }

  const profit = price - unitCost.cost;
  const marginPct = (profit / price) * 100;
  const gapPp = marginPct - targetPct;

  return {
    ...base,
    status: gapPp >= -1e-9 ? "on-target" : "below-target",
    profit,
    marginPct,
    gapPp,
    missingToTargetPct: Math.max(0, targetPct - marginPct),
  };
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function formatPoints(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign} ${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
}
