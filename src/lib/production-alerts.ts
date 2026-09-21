import type { Product } from "@/types/product";
import type { ProductRecipeLine } from "@/types/production";
import type { RawMaterial } from "@/types/raw-material";

export interface StockAlert {
  rawMaterialId: string;
  name: string;
  controlUnit: string;
  needed: number;
  available: number;
  shortfall: number;
}

export interface LineAlerts {
  alerts: StockAlert[];
  recipeMissing: boolean;
}

export interface ProductionLine {
  productId: string;
  packs: number;
}

export function buildProductionAlerts(
  lines: ProductionLine[],
  productById: Map<string, Product>,
  recipesByProduct: Record<string, ProductRecipeLine[] | undefined>,
  materials: RawMaterial[]
): Record<string, LineAlerts> {
  const remaining = new Map(materials.map((material) => [material.id, material.currentStock]));
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const result: Record<string, LineAlerts> = {};

  for (const line of lines) {
    const product = productById.get(line.productId);
    const recipe = recipesByProduct[line.productId];
    if (!product || recipe === undefined) continue;

    if (recipe.length === 0) {
      result[line.productId] = { alerts: [], recipeMissing: true };
      continue;
    }

    const units = line.packs * product.packQuantity;
    const alerts: StockAlert[] = [];

    for (const recipeLine of recipe) {
      const material = materialById.get(recipeLine.rawMaterialId);
      if (!material) continue;
      const needed = recipeLine.quantityPerUnit * units;
      const available = remaining.get(material.id) ?? 0;
      if (needed > available) {
        alerts.push({
          rawMaterialId: material.id,
          name: material.name,
          controlUnit: material.controlUnit,
          needed,
          available,
          shortfall: needed - available,
        });
      }
      remaining.set(material.id, Math.max(0, available - needed));
    }

    result[line.productId] = { alerts, recipeMissing: false };
  }

  return result;
}
