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
