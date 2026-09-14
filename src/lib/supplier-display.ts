import type { Supplier } from "@/types/supplier";

export function getSupplierDisplayName(supplier: Supplier) {
  return supplier.tradeName || supplier.companyName;
}

export function getSupplierSecondaryLine(supplier: Supplier) {
  return [supplier.name, supplier.city, supplier.cnpj, supplier.phone].filter(Boolean).join(" · ");
}
