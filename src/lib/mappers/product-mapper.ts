import type { Product } from "@/types/product";
import type { Database } from "@/types/supabase";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    categoryId: row.category_id,
    presentation: row.presentation,
    weight: row.weight_volume,
    unitPrice: row.unit_price,
    packQuantity: row.pack_quantity,
    packagingType: row.packaging_type as Product["packagingType"],
    active: row.is_active,
    badge: (row.badge ?? undefined) as Product["badge"],
  };
}

export function productToRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image_url: product.imageUrl,
    category_id: product.categoryId,
    presentation: product.presentation,
    weight_volume: product.weight,
    unit_price: product.unitPrice,
    pack_quantity: product.packQuantity,
    packaging_type: product.packagingType,
    is_active: product.active,
    badge: product.badge ?? null,
  };
}
