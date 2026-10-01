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
  openBalance: number;
  installmentNumber: number;
  totalInstallments: number;
  payerId: string | null;
  payerName: string | null;
  dueDate: string | null;
  status: ReceivableStatus;
  receivedAt: string | null;
}

export interface Receipt {
  id: string;
  receivableId: string;
  receivedAmount: number;
  effectiveDate: string;
  reversedReceiptId: string | null;
}

export interface NewRevenueInput {
  description: string;
  category: string;
  origin: RevenueOrigin;
  amount: number;
  dueDate?: string;
  payerOriginId?: string;
  installments?: number;
}

interface ReceitasState {
  revenues: Revenue[];
  receipts: Receipt[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createRevenue: (input: NewRevenueInput) => Promise<string | null>;
  markReceived: (receivableId: string, receivedAmount: number) => Promise<string | null>;
  reverseReceipt: (receiptId: string) => Promise<string | null>;
}

export const useReceitasStore = create<ReceitasState>((set, get) => ({
  revenues: [],
  receipts: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const [{ data: rows, error }, { data: receiptRows }] = await Promise.all([
      supabase
        .from("revenue_receivables")
        .select(
          "id, due_date, effective_date, status, principal, open_balance, installment_number, total_installments, revenue_id, revenues(id, description, category, origin, payer_origin_id, customers(name))"
        )
        .order("due_date", { ascending: false }),
      supabase.from("revenue_receipts").select("id, receivable_id, received_amount, effective_date, reversed_receipt_id"),
    ]);

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
          openBalance: r.open_balance,
          installmentNumber: r.installment_number,
          totalInstallments: r.total_installments,
          payerId: revenue?.payer_origin_id ?? null,
          payerName: revenue?.customers?.name ?? null,
          dueDate: r.due_date,
          status: r.status as ReceivableStatus,
          receivedAt: r.effective_date,
        };
      }),
      receipts: (receiptRows ?? []).map((r) => ({
        id: r.id,
        receivableId: r.receivable_id,
        receivedAmount: r.received_amount,
        effectiveDate: r.effective_date,
        reversedReceiptId: r.reversed_receipt_id,
      })),
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

    const totalInstallments = Math.max(1, input.installments ?? 1);
    const baseDate = input.dueDate ? new Date(input.dueDate + "T00:00:00") : new Date();
    const each = Number((input.amount / totalInstallments).toFixed(2));
    const receivables = Array.from({ length: totalInstallments }, (_, i) => {
      const due = new Date(baseDate);
      due.setMonth(due.getMonth() + i);
      const principal = i === totalInstallments - 1 ? Number((input.amount - each * (totalInstallments - 1)).toFixed(2)) : each;
      return {
        revenue_id: revenue.id,
        installment_number: i + 1,
        total_installments: totalInstallments,
        principal,
        open_balance: principal,
        due_date: due.toISOString().slice(0, 10),
        status: "ABERTO",
      };
    });

    const { error: receivableError } = await supabase.from("revenue_receivables").insert(receivables);
    if (receivableError) return receivableError.message;

    await get().fetchAll();
    return null;
  },

  markReceived: async (receivableId, receivedAmount) => {
    const { data: receivable } = await supabase.from("revenue_receivables").select("open_balance, due_date").eq("id", receivableId).maybeSingle();
    if (!receivable) return "Título não encontrado";

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

    const newBalance = Number((receivable.open_balance - receivedAmount).toFixed(2));
    const isOverdue = receivable.due_date < now.slice(0, 10);
    const { error: updateError } = await supabase
      .from("revenue_receivables")
      .update({
        status: newBalance <= 0.004 ? "RECEBIDO" : isOverdue ? "VENCIDO" : "ABERTO",
        open_balance: Math.max(newBalance, 0),
        effective_date: now,
      })
      .eq("id", receivableId);
    if (updateError) return updateError.message;

    await get().fetchAll();
    return null;
  },

  reverseReceipt: async (receiptId) => {
    const { data: original, error: fetchError } = await supabase
      .from("revenue_receipts")
      .select("receivable_id, received_amount")
      .eq("id", receiptId)
      .maybeSingle();
    if (fetchError || !original) return fetchError?.message ?? "Recebimento original não encontrado";

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("revenue_receipts").insert({
      receivable_id: original.receivable_id,
      received_amount: -original.received_amount,
      principal_received: -original.received_amount,
      discount: 0,
      interest_penalty: 0,
      effective_date: now,
      reversed_receipt_id: receiptId,
    });
    if (insertError) return insertError.message;

    const { data: receivable } = await supabase.from("revenue_receivables").select("open_balance, principal, due_date").eq("id", original.receivable_id).maybeSingle();
    if (receivable) {
      const restoredBalance = Math.min(receivable.open_balance + original.received_amount, receivable.principal);
      const isOverdue = receivable.due_date < now.slice(0, 10);
      await supabase
        .from("revenue_receivables")
        .update({ open_balance: restoredBalance, status: isOverdue ? "VENCIDO" : "ABERTO" })
        .eq("id", original.receivable_id);
    }

    await get().fetchAll();
    return null;
  },
}));
