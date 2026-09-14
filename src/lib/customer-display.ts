import type { Customer } from "@/types/customer";

export function getCustomerDisplayName(customer: Customer) {
  return customer.tradeName || customer.companyName;
}

export function getCustomerSecondaryLine(customer: Customer) {
  return [customer.name, customer.city, customer.cnpj, customer.phone].filter(Boolean).join(" · ");
}
