import type { Product } from "@/types/product";
import type { Category } from "@/types/category";
import type { RawMaterial, RawMaterialEntry } from "@/types/raw-material";
import type { StockMovement } from "@/types/stock";
import type { MaterialConsumption } from "@/store/stock-insights-store";

export type StockItemKind = "product" | "material";
export type HealthLevel = "green" | "yellow" | "red";

export interface StockItem {
  id: string;
  kind: StockItemKind;
  code: string;
  name: string;
  groupLabel: string;
  categoryLabel: string;
  controlUnit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  costIsSalePrice: boolean;
}

export function buildStockItems(products: Product[], materials: RawMaterial[], categories: Category[]): StockItem[] {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const productItems: StockItem[] = products
    .filter((product) => product.active)
    .map((product) => ({
      id: product.id,
      kind: "product",
      code: product.code,
      name: product.name,
      groupLabel: "Produto acabado",
      categoryLabel: categoryNameById.get(product.categoryId) ?? "Sem categoria",
      controlUnit: "un",
      currentStock: product.currentStock,
      minStock: product.minStock,
      unitCost: product.unitPrice,
      costIsSalePrice: true,
    }));

  const materialItems: StockItem[] = materials
    .filter((material) => material.isActive)
    .map((material) => ({
      id: material.id,
      kind: "material",
      code: material.code,
      name: material.name,
      groupLabel: material.category || "Sem categoria",
      categoryLabel: material.category || "Sem categoria",
      controlUnit: material.controlUnit,
      currentStock: material.currentStock,
      minStock: material.minStock,
      unitCost: material.avgCost,
      costIsSalePrice: false,
    }));

  return [...productItems, ...materialItems];
}

export function healthLevel(item: Pick<StockItem, "currentStock" | "minStock">): HealthLevel {
  if (item.currentStock <= 0) return "red";
  if (item.minStock <= 0) return "green";
  if (item.currentStock <= item.minStock) return "red";
  if (item.currentStock <= item.minStock * 1.5) return "yellow";
  return "green";
}

export function situationLabel(item: Pick<StockItem, "currentStock" | "minStock">): string {
  if (item.currentStock <= 0) return "Sem estoque";
  const level = healthLevel(item);
  if (level === "red") return "Crítico";
  if (level === "yellow") return "Atenção";
  return "Em estoque";
}

export type SituationTone = "ok" | "warning" | "critical" | "out";

export function situationTone(item: Pick<StockItem, "currentStock" | "minStock">): SituationTone {
  if (item.currentStock <= 0) return "out";
  const level = healthLevel(item);
  if (level === "red") return "critical";
  return level === "yellow" ? "warning" : "ok";
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function stockValue(item: Pick<StockItem, "currentStock" | "unitCost">): number {
  return roundCents(item.currentStock * item.unitCost);
}

export interface ValueCompositionRow {
  groupLabel: string;
  value: number;
}

export function buildValueComposition(items: StockItem[]): { rows: ValueCompositionRow[]; total: number } {
  const byGroup = new Map<string, number>();
  for (const item of items) {
    byGroup.set(item.groupLabel, (byGroup.get(item.groupLabel) ?? 0) + stockValue(item));
  }
  const rows = [...byGroup.entries()]
    .map(([groupLabel, value]) => ({ groupLabel, value }))
    .sort((a, b) => b.value - a.value);
  return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
}

export interface ExpiryRiskRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  batch: string;
  expiryDate: string;
  daysRemaining: number;
  quantity: number;
  value: number;
  riskLevel: "ok" | "warning" | "expired";
}

export function buildExpiryRisk(
  entries: RawMaterialEntry[],
  materials: RawMaterial[],
  warningDays = 30,
  reference = new Date()
): ExpiryRiskRow[] {
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const rows: ExpiryRiskRow[] = [];

  for (const entry of entries) {
    const material = materialById.get(entry.rawMaterialId);
    if (!material || entry.controlQuantity === null) continue;

    const expiry = new Date(`${entry.expiryDate}T00:00:00`);
    const daysRemaining = Math.round((expiry.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24));
    const riskLevel: ExpiryRiskRow["riskLevel"] = daysRemaining < 0 ? "expired" : daysRemaining <= warningDays ? "warning" : "ok";

    rows.push({
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      batch: entry.batch,
      expiryDate: entry.expiryDate,
      daysRemaining,
      quantity: entry.controlQuantity,
      value: entry.controlQuantity * material.avgCost,
      riskLevel,
    });
  }

  return rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export interface NextExpiry {
  expiryDate: string;
  batch: string;
}

export function buildNextExpiryByMaterial(expiryRisk: ExpiryRiskRow[]): Map<string, NextExpiry> {
  const map = new Map<string, NextExpiry>();
  for (const row of expiryRisk) {
    if (!map.has(row.materialId)) map.set(row.materialId, { expiryDate: row.expiryDate, batch: row.batch });
  }
  return map;
}

export interface TurnoverRow {
  item: StockItem;
  entriesInPeriod: number;
  exitsInPeriod: number;
  lastMovementAt: string | null;
  daysSinceLastMovement: number | null;
}

export function buildTurnoverReport(
  items: StockItem[],
  movements: StockMovement[],
  entries: RawMaterialEntry[],
  consumptions: MaterialConsumption[],
  periodStart: Date,
  periodEnd: Date,
  reference = new Date()
): TurnoverRow[] {
  const movementsByProduct = new Map<string, StockMovement[]>();
  for (const movement of movements) {
    const list = movementsByProduct.get(movement.productId) ?? [];
    list.push(movement);
    movementsByProduct.set(movement.productId, list);
  }

  const entriesByMaterial = new Map<string, RawMaterialEntry[]>();
  for (const entry of entries) {
    const list = entriesByMaterial.get(entry.rawMaterialId) ?? [];
    list.push(entry);
    entriesByMaterial.set(entry.rawMaterialId, list);
  }

  const consumptionsByMaterial = new Map<string, MaterialConsumption[]>();
  for (const consumption of consumptions) {
    const list = consumptionsByMaterial.get(consumption.rawMaterialId) ?? [];
    list.push(consumption);
    consumptionsByMaterial.set(consumption.rawMaterialId, list);
  }

  function withinPeriod(date: Date) {
    return date >= periodStart && date <= periodEnd;
  }

  return items.map((item) => {
    if (item.kind === "product") {
      const itemMovements = movementsByProduct.get(item.id) ?? [];
      const entriesInPeriod = itemMovements
        .filter((m) => m.variation > 0 && withinPeriod(new Date(m.createdAt)))
        .reduce((sum, m) => sum + m.variation, 0);
      const exitsInPeriod = itemMovements
        .filter((m) => m.variation < 0 && withinPeriod(new Date(m.createdAt)))
        .reduce((sum, m) => sum + Math.abs(m.variation), 0);
      const lastMovementAt = itemMovements.reduce<string | null>(
        (latest, m) => (!latest || new Date(m.createdAt) > new Date(latest) ? m.createdAt : latest),
        null
      );
      return {
        item,
        entriesInPeriod,
        exitsInPeriod,
        lastMovementAt,
        daysSinceLastMovement: lastMovementAt
          ? Math.floor((reference.getTime() - new Date(lastMovementAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      };
    }

    const itemEntries = entriesByMaterial.get(item.id) ?? [];
    const itemConsumptions = consumptionsByMaterial.get(item.id) ?? [];
    const entriesInPeriod = itemEntries
      .filter((e) => withinPeriod(new Date(e.entryDate)))
      .reduce((sum, e) => sum + (e.controlQuantity ?? 0), 0);
    const exitsInPeriod = itemConsumptions
      .filter((c) => withinPeriod(new Date(c.confirmedAt)))
      .reduce((sum, c) => sum + c.consumedQuantity, 0);

    const dates = [
      ...itemEntries.map((e) => e.updatedAt),
      ...itemConsumptions.map((c) => c.confirmedAt),
    ];
    const lastMovementAt = dates.reduce<string | null>(
      (latest, date) => (!latest || new Date(date) > new Date(latest) ? date : latest),
      null
    );

    return {
      item,
      entriesInPeriod,
      exitsInPeriod,
      lastMovementAt,
      daysSinceLastMovement: lastMovementAt
        ? Math.floor((reference.getTime() - new Date(lastMovementAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };
  });
}

export interface MonthlyValuePoint {
  label: string;
  date: Date;
  byGroup: Record<string, number>;
  totalValue: number;
  totalQuantity: number;
  quantityUnit: string | null;
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

export function buildMonthlyValueEvolution(
  items: StockItem[],
  movements: StockMovement[],
  entries: RawMaterialEntry[],
  consumptions: MaterialConsumption[],
  monthsBack = 6,
  reference = new Date()
): MonthlyValuePoint[] {
  const currentProductStock = new Map<string, number>();
  const currentMaterialStock = new Map<string, number>();
  const unitCost = new Map<string, number>();
  const groupLabel = new Map<string, string>();
  const controlUnits = new Set(items.map((item) => item.controlUnit));
  const quantityUnit = controlUnits.size === 1 ? [...controlUnits][0] : null;

  for (const item of items) {
    unitCost.set(item.id, item.unitCost);
    groupLabel.set(item.id, item.groupLabel);
    if (item.kind === "product") currentProductStock.set(item.id, item.currentStock);
    else currentMaterialStock.set(item.id, item.currentStock);
  }

  const points: MonthlyValuePoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const cutoff = new Date(reference.getFullYear(), reference.getMonth() - i + 1, 0, 23, 59, 59);

    const productStockAtCutoff = new Map(currentProductStock);
    for (const movement of movements) {
      if (new Date(movement.createdAt) > cutoff) {
        const stock = productStockAtCutoff.get(movement.productId) ?? 0;
        productStockAtCutoff.set(movement.productId, stock - movement.variation);
      }
    }

    const materialStockAtCutoff = new Map(currentMaterialStock);
    for (const entry of entries) {
      if (new Date(entry.updatedAt) > cutoff) {
        const stock = materialStockAtCutoff.get(entry.rawMaterialId) ?? 0;
        materialStockAtCutoff.set(entry.rawMaterialId, stock - (entry.controlQuantity ?? 0));
      }
    }
    for (const consumption of consumptions) {
      if (new Date(consumption.confirmedAt) > cutoff) {
        const stock = materialStockAtCutoff.get(consumption.rawMaterialId) ?? 0;
        materialStockAtCutoff.set(consumption.rawMaterialId, stock + consumption.consumedQuantity);
      }
    }

    const byGroup: Record<string, number> = {};
    let totalValue = 0;
    let totalQuantity = 0;
    for (const [id, stock] of productStockAtCutoff) {
      totalQuantity += Math.max(stock, 0);
      const value = roundCents(Math.max(stock, 0) * (unitCost.get(id) ?? 0));
      const label = groupLabel.get(id) ?? "Produto acabado";
      byGroup[label] = (byGroup[label] ?? 0) + value;
      totalValue += value;
    }
    for (const [id, stock] of materialStockAtCutoff) {
      totalQuantity += Math.max(stock, 0);
      const value = roundCents(Math.max(stock, 0) * (unitCost.get(id) ?? 0));
      const label = groupLabel.get(id) ?? "Sem categoria";
      byGroup[label] = (byGroup[label] ?? 0) + value;
      totalValue += value;
    }

    points.push({
      label: monthLabelFormatter.format(cutoff),
      date: cutoff,
      byGroup,
      totalValue,
      totalQuantity,
      quantityUnit,
    });
  }

  return points;
}

export interface DivergenceRow {
  productId: string;
  createdAt: string;
  previousBalance: number;
  newBalance: number;
  difference: number;
  observation: string;
  responsibleId: string | null;
}

export function buildDivergenceReport(movements: StockMovement[]): DivergenceRow[] {
  const latestByProduct = new Map<string, StockMovement>();
  for (const movement of movements) {
    if (movement.origin !== "adjustment") continue;
    const current = latestByProduct.get(movement.productId);
    if (!current || new Date(movement.createdAt) > new Date(current.createdAt)) {
      latestByProduct.set(movement.productId, movement);
    }
  }

  return [...latestByProduct.values()]
    .filter((movement) => movement.variation !== 0)
    .map((movement) => ({
      productId: movement.productId,
      createdAt: movement.createdAt,
      previousBalance: movement.previousBalance,
      newBalance: movement.newBalance,
      difference: movement.variation,
      observation: movement.observation,
      responsibleId: movement.responsibleId,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
