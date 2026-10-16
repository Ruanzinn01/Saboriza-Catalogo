import { create } from "zustand";
import { toast } from "sonner";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { callRpc, friendlyRpcError, selectFrom } from "@/lib/supplier-rpc";
import type { CandidateContact, CandidateInput, CandidateStage, SupplierCandidate, SupplierInput } from "@/types/supplier";

interface CandidateRow {
  id: string;
  trade_name: string;
  legal_name: string;
  contact_name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  website: string;
  owner_name: string;
  origin: string;
  notes: string;
  stage: CandidateStage;
  first_registered_at: string;
  last_contact_on: string | null;
  next_contact_on: string | null;
  linked_supplier_id: string | null;
  revision: number;
  products: string[];
  category_ids: string[];
}

interface ContactRow {
  id: string;
  kind: "CONTATO" | "CONVERSAO";
  contacted_on: string;
  note: string;
  created_at: string;
}

export function candidateFromRow(row: CandidateRow): SupplierCandidate {
  return {
    id: row.id,
    tradeName: row.trade_name,
    legalName: row.legal_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    website: row.website,
    ownerName: row.owner_name,
    origin: row.origin,
    notes: row.notes,
    stage: row.stage,
    firstRegisteredAt: row.first_registered_at,
    lastContactOn: row.last_contact_on,
    nextContactOn: row.next_contact_on,
    linkedSupplierId: row.linked_supplier_id,
    revision: row.revision,
    products: row.products ?? [],
    categoryIds: row.category_ids ?? [],
  };
}

export function candidatePayload(input: CandidateInput) {
  return {
    trade_name: input.tradeName,
    legal_name: input.legalName,
    contact_name: input.contactName,
    phone: input.phone,
    email: input.email,
    city: input.city,
    state: input.state,
    website: input.website,
    owner_name: input.ownerName,
    origin: input.origin,
    notes: input.notes,
    stage: input.stage,
    next_contact_on: input.nextContactOn || null,
    products: input.products,
    category_ids: input.categoryIds,
  };
}

export function supplierPayload(input: SupplierInput, categoryIds: string[]) {
  return {
    name: input.name,
    company_name: input.companyName,
    phone: input.phone,
    trade_name: input.tradeName,
    cnpj: input.cnpj,
    ie: input.ie,
    email: input.email,
    address: input.address,
    neighborhood: input.neighborhood,
    cep: input.cep,
    city: input.city,
    state: input.state,
    category_ids: categoryIds,
  };
}

export interface CandidateSearch {
  query: string;
  stage: string;
  categoryId: string;
  page: number;
  pageSize: number;
}

interface CandidatesState {
  candidates: SupplierCandidate[];
  total: number;
  status: "idle" | "loading" | "ready" | "error";
  search: (params: CandidateSearch) => Promise<void>;
  register: (input: CandidateInput) => Promise<boolean>;
  update: (id: string, expectedRevision: number, input: CandidateInput) => Promise<boolean>;
  recordContact: (id: string, note: string, contactedOn: string, nextContactOn: string, stage: string) => Promise<boolean>;
  fetchCandidate: (id: string) => Promise<SupplierCandidate | null>;
  listContacts: (id: string) => Promise<CandidateContact[]>;
  convert: (
    candidateId: string,
    existingSupplierId: string | null,
    supplier: SupplierInput,
    categoryIds: string[]
  ) => Promise<{ supplierId: string } | { duplicateOf: string } | null>;
}

export const useSupplierCandidatesStore = create<CandidatesState>()((set) => ({
  candidates: [],
  total: 0,
  status: "idle",

  search: async (params) => {
    set({ status: "loading" });
    const { data, error } = await callRpc<{ total: number; rows: CandidateRow[] }>("search_supplier_candidates", {
      p_query: params.query,
      p_stage: params.stage || null,
      p_category_id: params.categoryId || null,
      p_limit: params.pageSize,
      p_offset: (params.page - 1) * params.pageSize,
    });
    if (error || !data) {
      toast.error(friendlyRpcError(error ?? "", "Não foi possível carregar os possíveis fornecedores"));
      set({ status: "error" });
      return;
    }
    set({ candidates: data.rows.map(candidateFromRow), total: data.total, status: "ready" });
  },

  register: async (input) => {
    const { error } = await callRpc("register_supplier_candidate", { p_command_id: crypto.randomUUID(), p_payload: candidatePayload(input) });
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível registrar o possível fornecedor"));
      return false;
    }
    toast.success("Possível fornecedor registrado");
    return true;
  },

  update: async (id, expectedRevision, input) => {
    const { error } = await callRpc("update_supplier_candidate", { p_id: id, p_expected_revision: expectedRevision, p_payload: candidatePayload(input) });
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível atualizar o possível fornecedor"));
      return false;
    }
    toast.success("Possível fornecedor atualizado");
    return true;
  },

  recordContact: async (id, note, contactedOn, nextContactOn, stage) => {
    const { error } = await callRpc("record_candidate_contact", {
      p_id: id,
      p_note: note,
      p_contacted_on: contactedOn || null,
      p_next_contact_on: nextContactOn || null,
      p_stage: stage || null,
    });
    if (error) {
      toast.error(friendlyRpcError(error, "Não foi possível registrar o contato"));
      return false;
    }
    toast.success("Contato registrado");
    return true;
  },

  fetchCandidate: async (id) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return null;
    const [row, products, cats] = await Promise.all([
      selectFrom("supplier_candidates", "*").eq("company_id", companyId).eq("id", id),
      selectFrom("supplier_candidate_products", "label").eq("company_id", companyId).eq("candidate_id", id),
      selectFrom("supplier_candidate_categories", "category_id").eq("company_id", companyId).eq("candidate_id", id),
    ]);
    const base = ((row.data as Omit<CandidateRow, "products" | "category_ids">[] | null) ?? [])[0];
    if (row.error || !base) return null;
    return candidateFromRow({
      ...base,
      products: ((products.data as { label: string }[] | null) ?? []).map((item) => item.label),
      category_ids: ((cats.data as { category_id: string }[] | null) ?? []).map((item) => item.category_id),
    });
  },

  listContacts: async (id) => {
    const { data, error } = await callRpc<ContactRow[]>("list_candidate_contacts", { p_id: id });
    if (error || !data) return [];
    return data.map((row) => ({ id: row.id, kind: row.kind, contactedOn: row.contacted_on, note: row.note, createdAt: row.created_at }));
  },

  convert: async (candidateId, existingSupplierId, supplier, categoryIds) => {
    const { data, error } = await callRpc<{ supplier_id: string }>("convert_candidate_to_supplier", {
      p_candidate_id: candidateId,
      p_existing_supplier_id: existingSupplierId,
      p_supplier: supplierPayload(supplier, categoryIds),
    });
    if (error) {
      const duplicate = /DUPLICADO:([0-9a-f-]{36})/i.exec(error);
      if (duplicate) return { duplicateOf: duplicate[1] };
      toast.error(friendlyRpcError(error, "Não foi possível cadastrar como fornecedor"));
      return null;
    }
    return data ? { supplierId: data.supplier_id } : null;
  },
}));
