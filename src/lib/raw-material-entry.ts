import type { RawMaterial } from "@/types/raw-material";

export interface EntryCartLine {
  lineId: string;
  rawMaterialId: string;
  packagesQuantity: number;
  unitPrice: number;
  batch: string;
  expiryDate: string;
}

export type MaterialSortKey = "code" | "name" | "category";
export interface MaterialSort {
  key: MaterialSortKey;
  dir: "asc" | "desc";
}

export function materialCategories(materials: RawMaterial[]): string[] {
  return Array.from(new Set(materials.map((material) => material.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function filterMaterials(materials: RawMaterial[], search: string, category: string): RawMaterial[] {
  const query = search.trim().toLowerCase();
  return materials.filter((material) => {
    if (category && material.category !== category) return false;
    if (!query) return true;
    return (
      material.name.toLowerCase().includes(query) ||
      material.code.toLowerCase().includes(query) ||
      material.category.toLowerCase().includes(query)
    );
  });
}

export function sortMaterials(materials: RawMaterial[], sort: MaterialSort): RawMaterial[] {
  const direction = sort.dir === "asc" ? 1 : -1;
  const read = (material: RawMaterial) => (sort.key === "code" ? material.code : sort.key === "name" ? material.name : material.category);
  return [...materials].sort(
    (a, b) =>
      direction * read(a).localeCompare(read(b), "pt-BR", { numeric: true }) || a.name.localeCompare(b.name, "pt-BR")
  );
}

export interface LineErrors {
  packagesQuantity?: string;
  unitPrice?: string;
  batch?: string;
  expiryDate?: string;
}

export interface EntryValidation {
  formError: string;
  lineErrors: Record<string, LineErrors>;
}

export function validateEntry(supplierId: string, entryDate: string, cart: EntryCartLine[]): EntryValidation {
  const lineErrors: Record<string, LineErrors> = {};
  let formError = "";

  if (!supplierId) formError = "Selecione o fornecedor";
  else if (!entryDate) formError = "Informe a data da entrada";
  else if (cart.length === 0) formError = "Adicione ao menos um insumo";

  for (const line of cart) {
    const errors: LineErrors = {};
    if (!(line.packagesQuantity > 0)) errors.packagesQuantity = "Maior que zero";
    if (!(line.unitPrice >= 0)) errors.unitPrice = "Inválido";
    if (!line.batch.trim()) errors.batch = "Obrigatório";
    if (!line.expiryDate) errors.expiryDate = "Obrigatória";
    if (Object.keys(errors).length > 0) lineErrors[line.lineId] = errors;
  }

  if (!formError && Object.keys(lineErrors).length > 0) {
    formError = "Confira os itens marcados: quantidade, valor, lote e validade são obrigatórios";
  }

  return { formError, lineErrors };
}

export function cartTotals(cart: EntryCartLine[]) {
  return {
    items: cart.length,
    value: cart.reduce((sum, line) => sum + line.packagesQuantity * line.unitPrice, 0),
  };
}
