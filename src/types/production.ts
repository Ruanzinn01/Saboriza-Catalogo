export interface ProductRecipeLine {
  id: string;
  productId: string;
  rawMaterialId: string;
  quantityPerUnit: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductRecipeLineInput = Omit<ProductRecipeLine, "id" | "createdAt" | "updatedAt">;

export interface ProductionRecord {
  id: string;
  productId: string;
  packsQuantity: number;
  unitsQuantity: number;
  status: string;
  responsibleId: string | null;
  createdAt: string;
  confirmedAt: string;
  updatedAt: string;
}

export interface ProductionConsumption {
  id: string;
  productionRecordId: string;
  rawMaterialId: string;
  neededQuantity: number;
  consumedQuantity: number;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
}
