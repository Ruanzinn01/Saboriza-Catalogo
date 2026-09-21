import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import type { ProductRecipeLine } from "@/types/production";
import type { RawMaterial } from "@/types/raw-material";
import type { Supplier } from "@/types/supplier";
import { computeProfitability, computeUnitCost } from "@/lib/product-profitability";
import { situationTone } from "@/lib/stock-insights";

export type StockBucket = "ok" | "low" | "out";
export type MarginState = "on-target" | "below-target" | "none";

export interface ProductRow {
  product: Product;
  categoryName: string;
  supplierName: string | null;
  bucket: StockBucket;
  marginPct: number | null;
  marginState: MarginState;
}

export interface ProductFilters {
  search: string;
  categoryId: string;
  active: "all" | "active" | "inactive";
  stock: "all" | StockBucket;
  margin: "all" | MarginState;
  supplierId: string;
}

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  categoryId: "",
  active: "all",
  stock: "all",
  margin: "all",
  supplierId: "",
};

export type SortKey = "code" | "name" | "category" | "stock" | "price" | "status";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const BUCKET_ORDER: Record<StockBucket, number> = { out: 0, low: 1, ok: 2 };

export function stockBucket(product: Pick<Product, "currentStock" | "minStock">): StockBucket {
  const tone = situationTone(product);
  if (tone === "out") return "out";
  return tone === "ok" ? "ok" : "low";
}

export function stockFillPct(product: Pick<Product, "currentStock" | "minStock">): number {
  if (product.currentStock <= 0) return 0;
  if (product.minStock <= 0) return 100;
  return Math.min(100, (product.currentStock / (product.minStock * 4)) * 100);
}

export function buildProductRows(
  products: Product[],
  categories: Category[],
  suppliers: Supplier[],
  recipesByProduct: Record<string, ProductRecipeLine[] | undefined>,
  materials: RawMaterial[]
): ProductRow[] {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.tradeName || supplier.companyName]));

  return products.map((product): ProductRow => {
    const lines = recipesByProduct[product.id];
    const profitability = lines
      ? computeProfitability(product.unitPrice, computeUnitCost(lines, materials), product.targetMarginPct)
      : null;
    const marginState: MarginState =
      profitability?.status === "on-target" ? "on-target" : profitability?.status === "below-target" ? "below-target" : "none";

    return {
      product,
      categoryName: categoryNameById.get(product.categoryId) ?? "Sem categoria",
      supplierName: product.supplierId ? (supplierNameById.get(product.supplierId) ?? null) : null,
      bucket: stockBucket(product),
      marginPct: profitability?.marginPct ?? null,
      marginState,
    };
  });
}

export function countActiveFilters(filters: ProductFilters): number {
  return (
    Number(filters.search.trim() !== "") +
    Number(filters.categoryId !== "") +
    Number(filters.active !== "all") +
    Number(filters.stock !== "all") +
    Number(filters.margin !== "all") +
    Number(filters.supplierId !== "")
  );
}

export function filterRows(rows: ProductRow[], filters: ProductFilters): ProductRow[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(({ product, bucket, marginState }) => {
    if (query && !product.name.toLowerCase().includes(query) && !product.code.toLowerCase().includes(query)) return false;
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (filters.active === "active" && !product.active) return false;
    if (filters.active === "inactive" && product.active) return false;
    if (filters.stock !== "all" && bucket !== filters.stock) return false;
    if (filters.margin !== "all" && marginState !== filters.margin) return false;
    if (filters.supplierId && product.supplierId !== filters.supplierId) return false;
    return true;
  });
}

function compare(a: ProductRow, b: ProductRow, key: SortKey): number {
  switch (key) {
    case "code":
      return a.product.code.localeCompare(b.product.code, "pt-BR", { numeric: true });
    case "name":
      return a.product.name.localeCompare(b.product.name, "pt-BR");
    case "category":
      return a.categoryName.localeCompare(b.categoryName, "pt-BR");
    case "stock":
      return a.product.currentStock - b.product.currentStock;
    case "price":
      return a.product.unitPrice - b.product.unitPrice;
    case "status":
      return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket];
  }
}

export function sortRows(rows: ProductRow[], sort: SortState): ProductRow[] {
  const direction = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort(
    (a, b) => direction * compare(a, b, sort.key) || a.product.name.localeCompare(b.product.name, "pt-BR")
  );
}

export interface ProductKpis {
  total: number;
  ok: number;
  low: number;
  out: number;
}

export function buildKpis(products: Pick<Product, "currentStock" | "minStock">[]): ProductKpis {
  const kpis: ProductKpis = { total: products.length, ok: 0, low: 0, out: 0 };
  for (const product of products) kpis[stockBucket(product)] += 1;
  return kpis;
}

export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
