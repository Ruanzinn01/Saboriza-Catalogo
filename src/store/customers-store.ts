import { create } from "zustand";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { customerFromRow } from "@/lib/mappers/customer-mapper";
import type { Customer, CustomerInput } from "@/types/customer";

function toRow(input: CustomerInput) {
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

interface CustomersState {
  customers: Customer[];
  status: "idle" | "loading" | "ready" | "error";
  fetchCustomers: () => Promise<void>;
  createCustomer: (input: CustomerInput) => Promise<Customer | null>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<{ ok: boolean; blocked: boolean }>;
  findDuplicate: (input: CustomerInput, excludeId?: string) => Customer | null;
}

export const useCustomersStore = create<CustomersState>()((set, get) => ({
  customers: [],
  status: "idle",

  fetchCustomers: async () => {
    set({ status: "loading" });
    const { data, error } = await supabase.from("customers").select("*").order("name", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar os clientes");
      set({ status: "error" });
      return;
    }

    set({ customers: data.map(customerFromRow), status: "ready" });
  },

  findDuplicate: (input, excludeId) => {
    const cnpj = input.cnpj.trim();
    const phone = input.phone.trim();
    return (
      get().customers.find((customer) => {
        if (customer.id === excludeId) return false;
        if (cnpj) return customer.cnpj.trim() === cnpj;
        return customer.phone.trim() === phone;
      }) ?? null
    );
  },

  createCustomer: async (input) => {
    const { data, error } = await supabase.from("customers").insert(toRow(input)).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível cadastrar o cliente");
      return null;
    }

    const customer = customerFromRow(data);
    set((state) => ({ customers: [...state.customers, customer].sort((a, b) => a.name.localeCompare(b.name)) }));
    toast.success("Cliente cadastrado");
    return customer;
  },

  updateCustomer: async (id, input) => {
    const { data, error } = await supabase.from("customers").update(toRow(input)).eq("id", id).select("*").single();

    if (error || !data) {
      toast.error("Não foi possível atualizar o cliente");
      return false;
    }

    const customer = customerFromRow(data);
    set((state) => ({
      customers: state.customers.map((item) => (item.id === id ? customer : item)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    toast.success("Cliente atualizado");
    return true;
  },

  deleteCustomer: async (id) => {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id);

    if (countError) {
      toast.error("Não foi possível verificar o histórico do cliente");
      return { ok: false, blocked: false };
    }

    if ((count ?? 0) > 0) {
      return { ok: false, blocked: true };
    }

    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o cliente");
      return { ok: false, blocked: false };
    }

    set((state) => ({ customers: state.customers.filter((item) => item.id !== id) }));
    toast.success("Cliente excluído");
    return { ok: true, blocked: false };
  },
}));
