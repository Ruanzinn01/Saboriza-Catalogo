import type { Supplier } from "@/types/supplier";

// Linha de public.suppliers após a migration 20261016141000 (ainda não está em src/types/supabase.ts).
export interface SupplierRow {
  id: string;
  name: string;
  company_name: string;
  phone: string;
  trade_name: string;
  cnpj: string;
  ie: string;
  email: string;
  address: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
  created_at: string;
  updated_at: string;
  person_type?: "PJ" | "PF";
  active?: boolean;
  tax_profile?: string;
  state_exempt?: boolean;
  contact_role?: string;
  contact_whatsapp?: boolean;
  street_number?: string;
  complement?: string;
  reference_note?: string;
  ibge_code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_source?: "MANUAL" | "GPS" | null;
  location_accuracy_m?: number | string | null;
  location_confirmed_at?: string | null;
  buyer_name?: string;
  cost_center?: string;
  supply_type?: string;
  origin?: string;
  service_notes?: string;
  sales_email?: string;
  invoice_email?: string;
  website?: string;
  external_customer_code?: string;
  lead_time_days?: number | null;
  minimum_order_cents?: number | string;
  freight_terms?: string;
  receiving_notes?: string;
  credit_limit_cents?: number | string;
  payment_terms?: string;
  payment_method?: string;
  negotiation_notes?: string;
  revision?: number;
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function supplierFromRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    phone: row.phone,
    tradeName: row.trade_name,
    cnpj: row.cnpj,
    ie: row.ie,
    email: row.email,
    address: row.address,
    neighborhood: row.neighborhood,
    cep: row.cep,
    city: row.city,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    personType: row.person_type ?? "PJ",
    active: row.active ?? true,
    taxProfile: row.tax_profile ?? "",
    stateExempt: row.state_exempt ?? false,
    contactRole: row.contact_role ?? "",
    contactWhatsapp: row.contact_whatsapp ?? true,
    streetNumber: row.street_number ?? "",
    complement: row.complement ?? "",
    referenceNote: row.reference_note ?? "",
    ibgeCode: row.ibge_code ?? "",
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    locationSource: row.location_source ?? null,
    locationAccuracyM: numberOrNull(row.location_accuracy_m),
    locationConfirmedAt: row.location_confirmed_at ?? null,
    buyerName: row.buyer_name ?? "",
    costCenter: row.cost_center ?? "",
    supplyType: row.supply_type ?? "",
    origin: row.origin ?? "",
    serviceNotes: row.service_notes ?? "",
    salesEmail: row.sales_email ?? "",
    invoiceEmail: row.invoice_email ?? "",
    website: row.website ?? "",
    externalCustomerCode: row.external_customer_code ?? "",
    leadTimeDays: numberOrNull(row.lead_time_days),
    minimumOrderCents: numberOrNull(row.minimum_order_cents) ?? 0,
    freightTerms: row.freight_terms ?? "",
    receivingNotes: row.receiving_notes ?? "",
    creditLimitCents: numberOrNull(row.credit_limit_cents) ?? 0,
    paymentTerms: row.payment_terms ?? "",
    paymentMethod: row.payment_method ?? "",
    negotiationNotes: row.negotiation_notes ?? "",
    revision: row.revision ?? 1,
  };
}
