import type { Product } from "@/types/product";
import type { Database } from "@/types/supabase";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    categoryId: row.category_id,
    supplierId: row.supplier_id,
    presentation: row.presentation,
    weight: row.weight_volume,
    unitWeightGrams: row.unit_weight_grams,
    unitPrice: row.unit_price,
    packQuantity: row.pack_quantity,
    packagingType: row.packaging_type as Product["packagingType"],
    active: row.is_active,
    badge: (row.badge ?? undefined) as Product["badge"],
    currentStock: row.current_stock,
    minStock: row.min_stock,
    maxStock: row.max_stock,
    targetMarginPct: row.target_margin_pct,
    gtin: row.gtin,
    brand: row.brand,
    ncm: row.ncm,
  };
}

export function productToRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    image_url: product.imageUrl,
    category_id: product.categoryId,
    supplier_id: product.supplierId,
    presentation: product.presentation,
    weight_volume: product.weight,
    unit_weight_grams: product.unitWeightGrams,
    unit_price: product.unitPrice,
    pack_quantity: product.packQuantity,
    packaging_type: product.packagingType,
    is_active: product.active,
    badge: product.badge ?? null,
    min_stock: product.minStock,
    max_stock: product.maxStock,
    target_margin_pct: product.targetMarginPct,
    gtin: product.gtin,
    brand: product.brand,
    ncm: product.ncm,
  };
}
