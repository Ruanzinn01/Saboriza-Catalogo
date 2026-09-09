export type PackagingType = "Fardo" | "Caixa" | "Pacote" | "Kit" | "Outro";

export type ProductBadge = "mais-pedido" | "novidade" | "destaque";

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  presentation: string;
  weight: string;
  unitPrice: number;
  packQuantity: number;
  packagingType: PackagingType;
  active: boolean;
  badge?: ProductBadge;
}
