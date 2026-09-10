import type { Customer } from "@/types/customer";
import type { Database } from "@/types/supabase";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export function customerFromRow(row: CustomerRow): Customer {
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
  };
}
