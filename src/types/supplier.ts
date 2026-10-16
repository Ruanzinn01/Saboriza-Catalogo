export type PersonType = "PJ" | "PF";

export interface SupplierContact {
  name: string;
  role: string;
  phone: string;
  whatsapp: boolean;
  email: string;
}

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
  personType: PersonType;
  active: boolean;
  taxProfile: string;
  stateExempt: boolean;
  contactRole: string;
  contactWhatsapp: boolean;
  streetNumber: string;
  complement: string;
  referenceNote: string;
  ibgeCode: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: "MANUAL" | "GPS" | null;
  locationAccuracyM: number | null;
  locationConfirmedAt: string | null;
  buyerName: string;
  costCenter: string;
  supplyType: string;
  origin: string;
  serviceNotes: string;
  salesEmail: string;
  invoiceEmail: string;
  website: string;
  externalCustomerCode: string;
  leadTimeDays: number | null;
  minimumOrderCents: number;
  freightTerms: string;
  receivingNotes: string;
  creditLimitCents: number;
  paymentTerms: string;
  paymentMethod: string;
  negotiationNotes: string;
  revision: number;
}

// Valores do formulário: campos numéricos/monetários ficam como texto digitado e só viram número no payload.
export interface SupplierInput {
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
  personType: PersonType;
  active: boolean;
  taxProfile: string;
  stateExempt: boolean;
  contactRole: string;
  contactWhatsapp: boolean;
  streetNumber: string;
  complement: string;
  referenceNote: string;
  ibgeCode: string;
  latitude: string;
  longitude: string;
  locationSource: "MANUAL" | "GPS" | "";
  locationAccuracyM: string;
  locationConfirmed: boolean;
  buyerName: string;
  costCenter: string;
  supplyType: string;
  origin: string;
  serviceNotes: string;
  salesEmail: string;
  invoiceEmail: string;
  website: string;
  externalCustomerCode: string;
  leadTimeDays: string;
  minimumOrder: string;
  freightTerms: string;
  receivingNotes: string;
  creditLimit: string;
  paymentTerms: string;
  paymentMethod: string;
  negotiationNotes: string;
  contacts: SupplierContact[];
}

export interface SupplierCategory {
  id: string;
  name: string;
  active: boolean;
}

export type CandidateStage = "EM_ESTUDO" | "EM_CONTATO" | "EM_COTACAO" | "NAO_SELECIONADO" | "CADASTRADO";

export const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  EM_ESTUDO: "Em estudo",
  EM_CONTATO: "Em contato",
  EM_COTACAO: "Em cotação",
  NAO_SELECIONADO: "Não selecionado",
  CADASTRADO: "Cadastrado como fornecedor",
};

export interface SupplierCandidate {
  id: string;
  tradeName: string;
  legalName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  website: string;
  ownerName: string;
  origin: string;
  notes: string;
  stage: CandidateStage;
  firstRegisteredAt: string;
  lastContactOn: string | null;
  nextContactOn: string | null;
  linkedSupplierId: string | null;
  revision: number;
  products: string[];
  categoryIds: string[];
}

export interface CandidateInput {
  tradeName: string;
  legalName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  website: string;
  ownerName: string;
  origin: string;
  notes: string;
  stage: Exclude<CandidateStage, "CADASTRADO">;
  nextContactOn: string;
  products: string[];
  categoryIds: string[];
}

export interface CandidateContact {
  id: string;
  kind: "CONTATO" | "CONVERSAO";
  contactedOn: string;
  note: string;
  createdAt: string;
}
