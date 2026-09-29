import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { orderFromRow } from "@/lib/mappers/order-mapper";
import type { Order } from "@/types/order";
import type { Database } from "@/types/supabase";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export type PaymentType = "BOLETO" | "PIX" | "DINHEIRO" | "CARTAO" | "TRANSFERENCIA" | "OUTROS";

export interface InstallmentDraft {
  number: number;
  days: number;
  dueDate: string;
  amount: number;
}

export interface PaymentMethodDraft {
  id: number;
  type: PaymentType;
  mode: "cash" | "term";
  amount: number;
  daysText: string;
  installments: InstallmentDraft[];
}

export interface CreditSnapshot {
  credit_limit: number;
  open_receivables: number;
  overdue_amount: number;
  overdue_count: number;
  commitments: number;
  current_exposure: number;
  financed_part: number;
  projected_exposure: number;
  available_after: number;
  excess: number;
}

const CASH_TYPES: PaymentType[] = ["DINHEIRO"];

function generatesCredit(type: PaymentType, mode: "cash" | "term"): boolean {
  if (CASH_TYPES.includes(type)) return false;
  if (type === "PIX" && mode === "cash") return false;
  return true;
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildInstallments(pm: PaymentMethodDraft): InstallmentDraft[] {
  const daysList =
    pm.mode === "cash"
      ? [0]
      : pm.daysText
          .split(",")
          .map((d) => parseInt(d.trim(), 10))
          .filter((d) => !isNaN(d) && d >= 0);
  const list = daysList.length ? daysList : [30];
  const each = pm.amount / list.length;
  const today = new Date();
  return list.map((days, i) => ({
    number: i + 1,
    days,
    dueDate: addDays(today, days),
    amount: i === list.length - 1 ? Number((pm.amount - each * (list.length - 1)).toFixed(2)) : Number(each.toFixed(2)),
  }));
}

interface FaturarState {
  eligibleOrders: Order[];
  listStatus: "idle" | "loading" | "ready" | "error";
  fetchEligibleOrders: () => Promise<void>;

  currentOrder: Order | null;
  orderStatus: "idle" | "loading" | "ready" | "error";
  fetchOrder: (orderId: string) => Promise<void>;

  paymentMethods: PaymentMethodDraft[];
  addPaymentMethod: () => void;
  removePaymentMethod: (id: number) => void;
  updatePaymentMethod: (id: number, patch: Partial<PaymentMethodDraft>) => void;

  fiscalChoice: "EMITIR_NFE" | "SEM_DOCUMENTO_FISCAL";
  setFiscalChoice: (choice: "EMITIR_NFE" | "SEM_DOCUMENTO_FISCAL") => void;
  noFiscalReason: string;
  setNoFiscalReason: (reason: string) => void;

  creditSnapshot: CreditSnapshot | null;
  creditReleased: boolean;
  releaseReason: string;
  refreshQuote: () => Promise<void>;
  authorizeException: (reason: string) => void;

  isConfirming: boolean;
  confirmBilling: () => Promise<{ billingId: string | null; error: string | null }>;

  reset: () => void;
}

let nextPmId = 2;

export const useFaturarStore = create<FaturarState>((set, get) => ({
  eligibleOrders: [],
  listStatus: "idle",

  fetchEligibleOrders: async () => {
    set({ listStatus: "loading" });
    const { data: orderRows, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "COMPLETED")
      .not("separation_finished_at", "is", null);

    if (error || !orderRows) {
      set({ listStatus: "error" });
      return;
    }

    const orderIds = orderRows.map((r) => r.id);
    const { data: billingRows } = await supabase
      .from("billings")
      .select("order_id, status")
      .in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);

    const billedOrderIds = new Set((billingRows ?? []).filter((b) => b.status === "CONFIRMADO").map((b) => b.order_id));
    const pendingRows = (orderRows as OrderRow[]).filter((r) => !billedOrderIds.has(r.id));

    const { data: itemRows } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", pendingRows.length ? pendingRows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]);

    const itemsByOrder = new Map<string, OrderItemRow[]>();
    (itemRows ?? []).forEach((row) => {
      const list = itemsByOrder.get(row.order_id) ?? [];
      list.push(row);
      itemsByOrder.set(row.order_id, list);
    });

    set({
      eligibleOrders: pendingRows.map((row) => orderFromRow(row, itemsByOrder.get(row.id) ?? [])),
      listStatus: "ready",
    });
  },

  currentOrder: null,
  orderStatus: "idle",

  fetchOrder: async (orderId) => {
    set({ orderStatus: "loading", currentOrder: null, creditSnapshot: null, creditReleased: false, releaseReason: "" });
    const { data: row, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (error || !row) {
      set({ orderStatus: "error" });
      return;
    }
    const { data: itemRows } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    const order = orderFromRow(row as OrderRow, (itemRows ?? []) as OrderItemRow[]);

    nextPmId = 2;
    const defaultPm: PaymentMethodDraft = {
      id: 1,
      type: "BOLETO",
      mode: "term",
      amount: order.total,
      daysText: "28,35,42",
      installments: [],
    };
    defaultPm.installments = buildInstallments(defaultPm);

    set({ currentOrder: order, orderStatus: "ready", paymentMethods: [defaultPm], fiscalChoice: "EMITIR_NFE", noFiscalReason: "" });
    await get().refreshQuote();
  },

  paymentMethods: [],

  addPaymentMethod: () => {
    const pm: PaymentMethodDraft = { id: nextPmId++, type: "PIX", mode: "cash", amount: 0, daysText: "30", installments: [] };
    pm.installments = buildInstallments(pm);
    set((s) => ({ paymentMethods: [...s.paymentMethods, pm] }));
    void get().refreshQuote();
  },

  removePaymentMethod: (id) => {
    set((s) => ({ paymentMethods: s.paymentMethods.filter((p) => p.id !== id) }));
    void get().refreshQuote();
  },

  updatePaymentMethod: (id, patch) => {
    set((s) => ({
      paymentMethods: s.paymentMethods.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        next.installments = buildInstallments(next);
        return next;
      }),
    }));
    void get().refreshQuote();
  },

  fiscalChoice: "EMITIR_NFE",
  setFiscalChoice: (choice) => set({ fiscalChoice: choice }),
  noFiscalReason: "",
  setNoFiscalReason: (reason) => set({ noFiscalReason: reason }),

  creditSnapshot: null,
  creditReleased: false,
  releaseReason: "",

  refreshQuote: async () => {
    const { currentOrder, paymentMethods } = get();
    if (!currentOrder) return;
    const financedPart = paymentMethods
      .filter((p) => generatesCredit(p.type, p.mode))
      .reduce((sum, p) => sum + p.amount, 0);

    const { data } = await supabase.rpc("oris360_billing_quote", {
      p_order_id: currentOrder.id,
      p_financed_part: financedPart,
    });
    if (data) set({ creditSnapshot: data as unknown as CreditSnapshot });
  },

  authorizeException: (reason) => set({ creditReleased: true, releaseReason: reason }),

  isConfirming: false,

  confirmBilling: async () => {
    const { currentOrder, paymentMethods, fiscalChoice } = get();
    if (!currentOrder) return { billingId: null, error: "Pedido não carregado" };

    set({ isConfirming: true });

    const payload = paymentMethods.map((p) => ({
      type: p.type,
      amount: p.amount,
      condition: p.mode === "cash" ? "À vista" : `${p.daysText} dias`,
      generates_credit: generatesCredit(p.type, p.mode),
      fees: {},
      auto_messages: true,
      installments: p.installments.map((i) => ({ number: i.number, days: i.days, due_date: i.dueDate, amount: i.amount })),
    }));

    const idempotencyKey = crypto.randomUUID();

    const { data, error } = await supabase.rpc("oris360_billing_confirm", {
      p_order_id: currentOrder.id,
      p_payment_methods: payload,
      p_fiscal_choice: fiscalChoice,
      p_idempotency_key: idempotencyKey,
    });

    set({ isConfirming: false });

    if (error || !data) return { billingId: null, error: error?.message ?? "Não foi possível confirmar o faturamento" };
    return { billingId: data as unknown as string, error: null };
  },

  reset: () =>
    set({
      currentOrder: null,
      orderStatus: "idle",
      paymentMethods: [],
      creditSnapshot: null,
      creditReleased: false,
      releaseReason: "",
      fiscalChoice: "EMITIR_NFE",
      noFiscalReason: "",
    }),
}));

export { generatesCredit };
