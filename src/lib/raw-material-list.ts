import type { RawMaterial } from "@/types/raw-material";
import { rawMaterialStockStatus } from "@/types/raw-material";
import type { Supplier } from "@/types/supplier";
import { stockFillPct, type ProductBucket, type ProductKpis } from "@/lib/product-list";

export interface RawMaterialRow {
  material: RawMaterial;
  supplierName: string | null;
  bucket: ProductBucket;
}

export interface RawMaterialFilters {
  search: string;
  category: string;
  active: "all" | "active" | "inactive";
  stock: "all" | ProductBucket;
}

export const EMPTY_MATERIAL_FILTERS: RawMaterialFilters = { search: "", category: "", active: "all", stock: "all" };

export type MaterialListSortKey = "code" | "name" | "category" | "stock" | "cost" | "status";
export interface MaterialListSort {
  key: MaterialListSortKey;
  dir: "asc" | "desc";
}

const BUCKET_ORDER: Record<ProductBucket, number> = { out: 0, low: 1, over: 2, ok: 3 };

export function materialBucket(material: Pick<RawMaterial, "currentStock" | "minStock" | "maxStock">): ProductBucket {
  const status = rawMaterialStockStatus(material);
  return status === "ok" && material.maxStock > 0 && material.currentStock > material.maxStock ? "over" : status;
}

export interface MaterialKpis extends ProductKpis {
  over: number;
}

export function buildMaterialKpis(materials: Pick<RawMaterial, "currentStock" | "minStock" | "maxStock">[]): MaterialKpis {
  const kpis: MaterialKpis = { total: materials.length, ok: 0, low: 0, out: 0, over: 0 };
  for (const material of materials) kpis[materialBucket(material)] += 1;
  return kpis;
}

export function buildMaterialRows(materials: RawMaterial[], suppliers: Supplier[]): RawMaterialRow[] {
  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.tradeName || supplier.companyName]));
  return materials.map((material) => ({
    material,
    supplierName: material.primarySupplierId ? (supplierNameById.get(material.primarySupplierId) ?? null) : null,
    bucket: materialBucket(material),
  }));
}

export function countMaterialFilters(filters: RawMaterialFilters): number {
  return Number(filters.search.trim() !== "") + Number(filters.category !== "") + Number(filters.active !== "all") + Number(filters.stock !== "all");
}

export function filterMaterialRows(rows: RawMaterialRow[], filters: RawMaterialFilters): RawMaterialRow[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter(({ material, supplierName, bucket }) => {
    if (filters.category && material.category !== filters.category) return false;
    if (filters.active === "active" && !material.isActive) return false;
    if (filters.active === "inactive" && material.isActive) return false;
    if (filters.stock !== "all" && bucket !== filters.stock) return false;
    if (!query) return true;
    return [material.name, material.code, supplierName ?? ""].some((field) => field.toLowerCase().includes(query));
  });
}

function compare(a: RawMaterialRow, b: RawMaterialRow, key: MaterialListSortKey): number {
  switch (key) {
    case "code":
      return a.material.code.localeCompare(b.material.code, "pt-BR", { numeric: true });
    case "name":
      return a.material.name.localeCompare(b.material.name, "pt-BR");
    case "category":
      return a.material.category.localeCompare(b.material.category, "pt-BR");
    case "stock":
      return a.material.currentStock - b.material.currentStock;
    case "cost":
      return a.material.avgCost - b.material.avgCost;
    case "status":
      return (
        BUCKET_ORDER[a.bucket] - BUCKET_ORDER[b.bucket] ||
        stockFillPct({ currentStock: a.material.currentStock, minStock: a.material.minStock, maxStock: a.material.maxStock }) -
          stockFillPct({ currentStock: b.material.currentStock, minStock: b.material.minStock, maxStock: b.material.maxStock })
      );
  }
}

export function sortMaterialRows(rows: RawMaterialRow[], sort: MaterialListSort): RawMaterialRow[] {
  const direction = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort(
    (a, b) => direction * compare(a, b, sort.key) || a.material.name.localeCompare(b.material.name, "pt-BR")
  );
}

export function replenishmentSummary(material: Pick<RawMaterial, "defaultReorderQty" | "leadTimeDays" | "controlUnit">): string {
  const parts: string[] = [];
  if (material.defaultReorderQty > 0) parts.push(`${material.defaultReorderQty.toLocaleString("pt-BR")} ${material.controlUnit}`);
  if (material.leadTimeDays > 0) parts.push(`${material.leadTimeDays} ${material.leadTimeDays === 1 ? "dia" : "dias"}`);
  return parts.join(" · ");
}
