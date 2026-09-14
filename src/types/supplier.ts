export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  email: string;
  address: string;
  neighborhood: string;
  cep: string;
  city: string;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export type SupplierInput = Omit<Supplier, "id" | "createdAt" | "updatedAt">;
