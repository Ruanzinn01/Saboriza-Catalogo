import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type ContributionStatus = "PLANEJADO" | "A_CONFIRMAR" | "REALIZADO" | "CANCELADO" | "ESTORNADO";
export type ContributionOrigin = "TRANSFERENCIA" | "PIX" | "DEPOSITO" | "DINHEIRO" | "PAGAMENTO_DIRETO_DESPESA" | "OUTRO";

export interface Partner {
  id: string;
  name: string;
  document: string | null;
  status: string;
}

export interface Contribution {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  status: ContributionStatus;
  origin: ContributionOrigin;
  plannedDate: string | null;
  realizedDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface NewContributionInput {
  partnerId: string;
  amount: number;
  status: "PLANEJADO" | "REALIZADO";
  origin: ContributionOrigin;
  plannedDate?: string;
  realizedDate?: string;
  notes?: string;
}

interface AportesState {
  partners: Partner[];
  contributions: Contribution[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createPartner: (name: string, document?: string) => Promise<string | null>;
  createContribution: (input: NewContributionInput) => Promise<string | null>;
  realizePlanned: (id: string, realizedDate: string) => Promise<string | null>;
  cancelContribution: (id: string) => Promise<string | null>;
  reverseContribution: (id: string) => Promise<string | null>;
}

export const useAportesStore = create<AportesState>((set, get) => ({
  partners: [],
  contributions: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });
    const [{ data: partnerRows, error: partnerError }, { data: contributionRows, error: contributionError }] = await Promise.all([
      supabase.from("company_partners").select("id, name, document, status").order("name"),
      supabase
        .from("partner_contributions")
        .select("id, partner_id, amount, status, origin, planned_date, realized_date, notes, created_at, company_partners(name)")
        .order("created_at", { ascending: false }),
    ]);

    if (partnerError || contributionError) {
      set({ status: "error" });
      return;
    }

    set({
      partners: (partnerRows ?? []).map((p) => ({ id: p.id, name: p.name, document: p.document, status: p.status })),
      contributions: (contributionRows ?? []).map((c) => ({
        id: c.id,
        partnerId: c.partner_id,
        partnerName: (c.company_partners as unknown as { name: string } | null)?.name ?? "-----",
        amount: c.amount,
        status: c.status as ContributionStatus,
        origin: c.origin as ContributionOrigin,
        plannedDate: c.planned_date,
        realizedDate: c.realized_date,
        notes: c.notes,
        createdAt: c.created_at,
      })),
      status: "ready",
    });
  },

  createPartner: async (name, document) => {
    const { data, error } = await supabase.from("company_partners").insert({ name, document: document || null }).select("id").single();
    if (error || !data) return error?.message ?? "Não foi possível cadastrar o sócio";
    await get().fetchAll();
    return null;
  },

  createContribution: async (input) => {
    const { error } = await supabase.from("partner_contributions").insert({
      partner_id: input.partnerId,
      amount: input.amount,
      status: input.status,
      origin: input.origin,
      planned_date: input.plannedDate || null,
      realized_date: input.realizedDate || null,
      notes: input.notes || null,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  realizePlanned: async (id, realizedDate) => {
    const { error } = await supabase
      .from("partner_contributions")
      .update({ status: "REALIZADO", realized_date: realizedDate })
      .eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  cancelContribution: async (id) => {
    const { error } = await supabase.from("partner_contributions").update({ status: "CANCELADO" }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  reverseContribution: async (id) => {
    const { error } = await supabase.from("partner_contributions").update({ status: "ESTORNADO" }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },
}));
