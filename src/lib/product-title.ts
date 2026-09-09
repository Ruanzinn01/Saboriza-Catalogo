import type { Product } from "@/types/product";

export function formatProductTitle(product: Pick<Product, "name" | "presentation" | "weight">) {
  return `${product.name} · ${product.presentation} · ${product.weight}`;
}
