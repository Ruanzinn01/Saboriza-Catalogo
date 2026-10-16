import { create } from "zustand";
import { toast } from "sonner";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import { supplierFromRow, type SupplierRow } from "@/lib/mappers/supplier-mapper";
import { callRpc, friendlyRpcError, selectFrom } from "@/lib/supplier-rpc";
import { toSupplierPayload } from "@/lib/supplier-form";
import type { Supplier, SupplierInput } from "@/types/supplier";

export type SaveResult = { id: string; revision: number } | { duplicateOf: string } | { conflict: true } | null;

function sortByName(items: Supplier[]) {
  return [...items].sort((a, b) => (a.tradeName || a.companyName).localeCompare(b.tradeName || b.companyName, "pt-BR"));
}

function parseDuplicate(message: string): string | null {
  return /DUPLICADO:([0-9a-f-]{36})/i.exec(message)?.[1] ?? null;
}

interface SuppliersState {
  suppliers: Supplier[];
  status: "idle" | "loading" | "ready" | "error";
  fetchSuppliers: () => Promise<void>;
  // categoryIds vai junto no mesmo comando (criação atômica); commandId é gerado por intenção e reaproveitado no retry.
  createSupplier: (input: SupplierInput, categoryIds: string[], commandId: string) => Promise<SaveResult>;
  updateSupplier: (id: string, expectedRevision: number, input: SupplierInput, categoryDelta: { add: string[]; remove: string[] }) => Promise<SaveResult>;
  setActive: (id: string, active: boolean, expectedRevision: number) => Promise<boolean>;
  findByDocument: (document: string, excludeId?: string) => Promise<{ id: string; trade_name: string; company_name: string; active: boolean } | null>;
}

export const useSuppliersStore = create<SuppliersState>()((set) => ({
  suppliers: [],
  status: "idle",

  fetchSuppliers: async () => {
    set({ status: "loading" });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }
    const { data, error } = await selectFrom("suppliers", "*").eq("company_id", companyId).order("name", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar os fornecedores");
      set({ status: "error" });
      return;
    }
    set({ suppliers: sortByName(((data as SupplierRow[]) ?? []).map(supplierFromRow)), status: "ready" });
  },

  createSupplier: async (input, categoryIds, commandId) => {
    const { data, error } = await callRpc<{ id: string; revision: number }>("create_supplier", {
      p_command_id: commandId,
      p_payload: { ...toSupplierPayload(input), category_ids: categoryIds },
    });
    if (error || !data) {
      const duplicate = parseDuplicate(error ?? "");
      if (duplicate) return { duplicateOf: duplicate };
      toast.error(friendlyRpcError(error ?? "", "Não foi possível cadastrar o fornecedor"));
      return null;
    }
    toast.success("Fornecedor cadastrado");
    return { id: data.id, revision: data.revision };
  },

  updateSupplier: async (id, expectedRevision, input, categoryDelta) => {
    const { data, error } = await callRpc<{ id: string; revision: number }>("update_supplier", {
      p_id: id,
      p_expected_revision: expectedRevision,
      p_payload: { ...toSupplierPayload(input), category_add: categoryDelta.add, category_remove: categoryDelta.remove },
    });
    if (error || !data) {
      if ((error ?? "").startsWith("CONFLITO_REVISAO")) return { conflict: true };
      const duplicate = parseDuplicate(error ?? "");
      if (duplicate) return { duplicateOf: duplicate };
      toast.error(friendlyRpcError(error ?? "", "Não foi possível atualizar o fornecedor"));
      return null;
    }
    toast.success("Fornecedor atualizado");
    return { id: data.id, revision: data.revision };
  },

  setActive: async (id, active, expectedRevision) => {
    const { data, error } = await callRpc<{ id: string; revision: number; active: boolean }>("set_supplier_active", {
      p_id: id,
      p_active: active,
      p_expected_revision: expectedRevision,
    });
    if (error || !data) {
      toast.error(friendlyRpcError(error ?? "", "Não foi possível alterar a situação do cadastro"));
      return false;
    }
    set((state) => ({
      suppliers: state.suppliers.map((item) => (item.id === id ? { ...item, active: data.active, revision: data.revision } : item)),
    }));
    toast.success(active ? "Cadastro reativado" : "Cadastro inativado; histórico e vínculos preservados");
    return true;
  },

  findByDocument: async (document, excludeId) => {
    const { data } = await callRpc<{ id: string; trade_name: string; company_name: string; active: boolean } | null>("find_supplier_by_document", {
      p_document: document,
      p_exclude: excludeId ?? null,
    });
    return data ?? null;
  },
}));
