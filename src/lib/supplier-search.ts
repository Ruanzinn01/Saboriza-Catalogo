import type { Supplier, SupplierCategory } from "@/types/supplier";

export const SUPPLIER_PAGE_SIZES = [10, 20, 30, 50];

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Documento normalizado preserva letras e zeros (CNPJ alfanumérico); só remove pontuação.
export function normalizeDocument(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

// Confere apenas o formato (11 dígitos de CPF ou 14 caracteres de CNPJ com os 2 últimos numéricos); não prova situação fiscal.
export function hasValidDocumentFormat(value: string): boolean {
  const doc = normalizeDocument(value);
  if (doc === "") return true;
  if (/^\d{11}$/.test(doc)) return true;
  return /^[0-9A-Z]{12}\d{2}$/.test(doc);
}

export type SupplierStatusFilter = "all" | "active" | "inactive";

export interface SupplierFilters {
  query: string;
  categoryIds: string[];
  city: string;
  buyer?: string;
  status?: SupplierStatusFilter;
}

export function supplierMatches(
  supplier: Supplier,
  categoryIdsOfSupplier: string[],
  categoriesById: Map<string, SupplierCategory>,
  filters: SupplierFilters
): boolean {
  if (filters.categoryIds.length > 0 && !filters.categoryIds.some((id) => categoryIdsOfSupplier.includes(id))) return false;
  if (filters.city && normalizeSearchText(supplier.city) !== normalizeSearchText(filters.city)) return false;
  if (filters.buyer && normalizeSearchText(supplier.buyerName) !== normalizeSearchText(filters.buyer)) return false;
  if (filters.status === "active" && !supplier.active) return false;
  if (filters.status === "inactive" && supplier.active) return false;

  const query = normalizeSearchText(filters.query);
  if (!query) return true;
  const queryDoc = normalizeDocument(filters.query);
  const categoryNames = categoryIdsOfSupplier.map((id) => categoriesById.get(id)?.name ?? "");
  const haystack = [supplier.name, supplier.companyName, supplier.tradeName, supplier.phone, supplier.email, supplier.city, supplier.buyerName, ...categoryNames]
    .map(normalizeSearchText)
    .join(" ");
  if (haystack.includes(query)) return true;
  return queryDoc.length >= 3 && normalizeDocument(supplier.cnpj).includes(queryDoc);
}

export function filterSuppliers(
  suppliers: Supplier[],
  linksBySupplier: Map<string, string[]>,
  categoriesById: Map<string, SupplierCategory>,
  filters: SupplierFilters
): Supplier[] {
  return suppliers.filter((supplier) => supplierMatches(supplier, linksBySupplier.get(supplier.id) ?? [], categoriesById, filters));
}

export type SupplierSort = "name" | "value" | "debt";

// Ordenação por compras/saldo usa a posição financeira do servidor; sem ela cai para o nome (nunca inventa valor).
export function sortSuppliers<T extends { id: string; tradeName: string; companyName: string }>(
  items: T[],
  sort: SupplierSort,
  metric: (id: string) => { value: number; debt: number } | undefined
): T[] {
  const label = (item: T) => item.tradeName || item.companyName;
  const byName = (a: T, b: T) => label(a).localeCompare(label(b), "pt-BR");
  return [...items].sort((a, b) => {
    if (sort === "name") return byName(a, b);
    const ma = metric(a.id);
    const mb = metric(b.id);
    const key = sort === "value" ? "value" : "debt";
    return (mb?.[key] ?? 0) - (ma?.[key] ?? 0) || byName(a, b);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { rows: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { rows: items.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, totalPages };
}

export function daysSince(isoDate: string, now: Date = new Date()): number {
  const start = new Date(isoDate).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now.getTime() - start) / 86_400_000));
}

// Delta enviado ao servidor: adicionar/remover só o que mudou, para não apagar seleção concorrente de outra pessoa.
export function diffIds(initial: string[], next: string[]): { add: string[]; remove: string[] } {
  const before = new Set(initial);
  const after = new Set(next);
  return {
    add: next.filter((id) => !before.has(id)),
    remove: initial.filter((id) => !after.has(id)),
  };
}

export function parseProductLabels(raw: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const label = part.replace(/\s+/g, " ").trim().slice(0, 80);
    const key = normalizeSearchText(label);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}
