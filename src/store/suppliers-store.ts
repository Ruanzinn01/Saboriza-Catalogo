import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { supplierFromRow } from "@/lib/mappers/supplier-mapper";
import type { Supplier, SupplierInput } from "@/types/supplier";

function toRow(input: SupplierInput) {
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
  };
}

interface SuppliersState {
  suppliers: Supplier[];
  status: "idle" | "loading" | "ready" | "error";
  fetchSuppliers: () => Promise<void>;
  createSupplier: (input: SupplierInput) => Promise<Supplier | null>;
  updateSupplier: (id: string, input: SupplierInput) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<{ ok: boolean; blocked: boolean }>;
  findDuplicate: (input: SupplierInput, excludeId?: string) => Supplier | null;
}

export const useSuppliersStore = create<SuppliersState>()((set, get) => ({
  suppliers: [],
  status: "idle",

  fetchSuppliers: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar os fornecedores");
      set({ status: "error" });
      return;
    }

    set({ suppliers: data.map(supplierFromRow), status: "ready" });
  },

  findDuplicate: (input, excludeId) => {
    const cnpj = input.cnpj.trim();
    const phone = input.phone.trim();
    return (
      get().suppliers.find((supplier) => {
        if (supplier.id === excludeId) return false;
        if (cnpj) return supplier.cnpj.trim() === cnpj;
        return supplier.phone.trim() === phone;
      }) ?? null
    );
  },

  createSupplier: async (input) => {
    const { data, error } = await supabase.from("suppliers").insert(toRow(input)).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível cadastrar o fornecedor");
      return null;
    }

    const supplier = supplierFromRow(data);
    set((state) => ({ suppliers: [...state.suppliers, supplier].sort((a, b) => a.name.localeCompare(b.name)) }));
    toast.success("Fornecedor cadastrado");
    return supplier;
  },

  updateSupplier: async (id, input) => {
    const { data, error } = await supabase.from("suppliers").update(toRow(input)).eq("id", id).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível atualizar o fornecedor");
      return false;
    }

    const supplier = supplierFromRow(data);
    set((state) => ({
      suppliers: state.suppliers.map((item) => (item.id === id ? supplier : item)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    toast.success("Fornecedor atualizado");
    return true;
  },

  deleteSupplier: async (id) => {
    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", id);

    if (countError) {
      toast.error("Não foi possível verificar os produtos do fornecedor");
      return { ok: false, blocked: false };
    }

    if ((count ?? 0) > 0) {
      return { ok: false, blocked: true };
    }

    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o fornecedor");
      return { ok: false, blocked: false };
    }

    set((state) => ({ suppliers: state.suppliers.filter((item) => item.id !== id) }));
    toast.success("Fornecedor excluído");
    return { ok: true, blocked: false };
  },
}));
