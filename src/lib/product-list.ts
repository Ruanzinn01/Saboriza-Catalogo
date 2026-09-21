import type { Category } from "@/types/category";
import type { Product } from "@/types/product";
import type { ProductRecipeLine } from "@/types/production";
import type { RawMaterial } from "@/types/raw-material";
import type { Supplier } from "@/types/supplier";
import { computeProfitability, computeUnitCost } from "@/lib/product-profitability";
import { situationTone } from "@/lib/stock-insights";

export type StockBucket = "ok" | "low" | "out";
export type ProductBucket = StockBucket | "over";
export type MarginState = "on-target" | "below-target" | "none";

export type SetupGap = "price" | "sheet" | "tax" | "materials";

export const SETUP_GAP_LABELS: Record<SetupGap, string> = {
  price: "preço de venda",
  sheet: "ficha técnica",
  tax: "imposto (NCM)",
  materials: "matéria-prima com custo",
};

export function productSetupGaps(
  product: Pick<Product, "unitPrice" | "ncm">,
  lines: ProductRecipeLine[] | undefined,
  materials: RawMaterial[]
): SetupGap[] {
  const gaps: SetupGap[] = [];
  if (!(product.unitPrice > 0)) gaps.push("price");
  if (lines !== undefined && lines.length === 0) gaps.push("sheet");
  if (!product.ncm.trim()) gaps.push("tax");

  if (lines !== undefined && lines.length > 0 && materials.length > 0) {
    const costById = new Map(materials.map((material) => [material.id, material.avgCost]));
    const disconnected = lines.some((line) => !((costById.get(line.rawMaterialId) ?? 0) > 0));
    if (disconnected) gaps.push("materials");
  }
  return gaps;
}

export interface ProductRow {
  product: Product;
  categoryName: string;
  supplierName: string | null;
  bucket: ProductBucket;
  marginPct: number | null;
  marginState: MarginState;
  gaps: SetupGap[];
}

export interface ProductFilters {
  search: string;
  categoryId: string;
  active: "all" | "active" | "inactive";
  stock: "all" | ProductBucket;
  margin: "all" | MarginState;
  supplierId: string;
  setup: "all" | "incomplete";
}

export const EMPTY_FILTERS: ProductFilters = {
  search: "",
  categoryId: "",
  active: "all",
  stock: "all",
  margin: "all",
  supplierId: "",
  setup: "all",
};

export type SortKey = "code" | "name" | "category" | "stock" | "price" | "status";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const BUCKET_ORDER: Record<ProductBucket, number> = { out: 0, low: 1, over: 2, ok: 3 };

export function stockBucket(product: Pick<Product, "currentStock" | "minStock">): StockBucket {
  const tone = situationTone(product);
  if (tone === "out") return "out";
  return tone === "ok" ? "ok" : "low";
}

export function productBucket(product: Pick<Product, "currentStock" | "minStock" | "maxStock">): ProductBucket {
  const bucket = stockBucket(product);
  return bucket === "ok" && product.maxStock > 0 && product.currentStock > product.maxStock ? "over" : bucket;
}

export function stockFillPct(product: Pick<Product, "currentStock" | "minStock"> & { maxStock?: number }): number {
  if (product.currentStock <= 0) return 0;
  const scale = product.maxStock && product.maxStock > 0 ? product.maxStock : product.minStock * 4;
  if (scale <= 0) return 100;
  return Math.min(100, (product.currentStock / scale) * 100);
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
      bucket: productBucket(product),
      marginPct: profitability?.marginPct ?? null,
      marginState,
      gaps: productSetupGaps(product, lines, materials),
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
    Number(filters.supplierId !== "") +
    Number(filters.setup !== "all")
  );
}

export function filterRows(rows: ProductRow[], filters: ProductFilters): ProductRow[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(({ product, bucket, marginState, gaps }) => {
    if (query && !product.name.toLowerCase().includes(query) && !product.code.toLowerCase().includes(query)) return false;
    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
    if (filters.active === "active" && !product.active) return false;
    if (filters.active === "inactive" && product.active) return false;
    if (filters.stock !== "all" && bucket !== filters.stock) return false;
    if (filters.margin !== "all" && marginState !== filters.margin) return false;
    if (filters.supplierId && product.supplierId !== filters.supplierId) return false;
    if (filters.setup === "incomplete" && gaps.length === 0) return false;
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
      return BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] || stockFillPct(a.product) - stockFillPct(b.product);
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

export interface ProductStockKpis extends ProductKpis {
  over: number;
}

export function buildProductKpis(products: Pick<Product, "currentStock" | "minStock" | "maxStock">[]): ProductStockKpis {
  const kpis: ProductStockKpis = { total: products.length, ok: 0, low: 0, out: 0, over: 0 };
  for (const product of products) kpis[productBucket(product)] += 1;
  return kpis;
}

export function countIncompleteSetup(rows: Pick<ProductRow, "gaps">[]): number {
  return rows.filter((row) => row.gaps.length > 0).length;
}

export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
