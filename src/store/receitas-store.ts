import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type RevenueOrigin = "MANUAL" | "CONTRATO_RECORRENCIA" | "INTEGRACAO" | "OUTRO_MODULO";
export type ReceivableStatus = "ABERTO" | "RECEBIDO" | "VENCIDO" | "CANCELADO";

export interface Revenue {
  id: string;
  receivableId: string;
  description: string;
  category: string;
  origin: RevenueOrigin;
  amount: number;
  payerName: string | null;
  dueDate: string | null;
  status: ReceivableStatus;
  receivedAt: string | null;
}

export interface NewRevenueInput {
  description: string;
  category: string;
  origin: RevenueOrigin;
  amount: number;
  dueDate?: string;
  payerOriginId?: string;
}

interface ReceitasState {
  revenues: Revenue[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createRevenue: (input: NewRevenueInput) => Promise<string | null>;
  markReceived: (receivableId: string, receivedAmount: number) => Promise<string | null>;
}

export const useReceitasStore = create<ReceitasState>((set, get) => ({
  revenues: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const { data: rows, error } = await supabase
      .from("revenue_receivables")
      .select("id, due_date, effective_date, status, principal, revenue_id, revenues(id, description, category, origin, payer_origin_id, customers(name))")
      .order("due_date", { ascending: false });

    if (error) {
      set({ status: "error" });
      return;
    }

    set({
      revenues: (rows ?? []).map((r) => {
        const revenue = r.revenues as unknown as {
          id: string;
          description: string;
          category: string;
          origin: RevenueOrigin;
          payer_origin_id: string | null;
          customers: { name: string } | null;
        } | null;
        return {
          id: revenue?.id ?? r.revenue_id,
          receivableId: r.id,
          description: revenue?.description ?? "-----",
          category: revenue?.category ?? "-----",
          origin: revenue?.origin ?? "MANUAL",
          amount: r.principal,
          payerName: revenue?.customers?.name ?? null,
          dueDate: r.due_date,
          status: r.status as ReceivableStatus,
          receivedAt: r.effective_date,
        };
      }),
      status: "ready",
    });
  },

  createRevenue: async (input) => {
    const { data: revenue, error: revenueError } = await supabase
      .from("revenues")
      .insert({
        description: input.description,
        category: input.category,
        origin: input.origin,
        principal_amount: input.amount,
        competence: input.dueDate || new Date().toISOString().slice(0, 10),
        payer_origin_id: input.payerOriginId || null,
      })
      .select("id")
      .single();
    if (revenueError) return revenueError.message;

    const { error: receivableError } = await supabase.from("revenue_receivables").insert({
      revenue_id: revenue.id,
      installment_number: 1,
      total_installments: 1,
      principal: input.amount,
      open_balance: input.amount,
      due_date: input.dueDate || new Date().toISOString().slice(0, 10),
      status: "ABERTO",
    });
    if (receivableError) return receivableError.message;

    await get().fetchAll();
    return null;
  },

  markReceived: async (receivableId, receivedAmount) => {
    const now = new Date().toISOString();
    const { error: receiptError } = await supabase.from("revenue_receipts").insert({
      receivable_id: receivableId,
      received_amount: receivedAmount,
      principal_received: receivedAmount,
      discount: 0,
      interest_penalty: 0,
      effective_date: now,
    });
    if (receiptError) return receiptError.message;

    const { error: updateError } = await supabase
      .from("revenue_receivables")
      .update({ status: "RECEBIDO", open_balance: 0, effective_date: now })
      .eq("id", receivableId);
    if (updateError) return updateError.message;

    await get().fetchAll();
    return null;
  },
}));
