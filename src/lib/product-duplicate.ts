import type { Product } from "@/types/product";

export type ProductDraft = Omit<Product, "id">;

export function buildDuplicateDraft(source: ProductDraft | Product): ProductDraft {
  const { id: _id, ...rest } = source as Product;
  return { ...rest, code: "", name: `${rest.name} (cópia)`, active: false, currentStock: 0 };
}
