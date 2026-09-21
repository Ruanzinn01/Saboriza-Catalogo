export type PackagingType = "Fardo" | "Caixa" | "Pacote" | "Kit" | "Outro";

export type ProductBadge = "mais-pedido" | "novidade" | "destaque";

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  supplierId: string | null;
  presentation: string;
  weight: string;
  unitWeightGrams: number | null;
  unitPrice: number;
  packQuantity: number;
  packagingType: PackagingType;
  active: boolean;
  badge?: ProductBadge;
  currentStock: number;
  minStock: number;
  maxStock: number;
  targetMarginPct: number;
  gtin: string;
  brand: string;
  ncm: string;
}
