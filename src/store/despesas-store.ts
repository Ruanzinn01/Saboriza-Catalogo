import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type ExpenseNature = "OPERACIONAL" | "INVESTIMENTO" | "SALARIO" | "OUTRO";
export type ExpenseStatus = "ABERTO" | "AGENDADO" | "PAGO" | "ATRASADO" | "BLOQUEADO";
export type ExpenseOrigin = "stock" | "asset" | "expense" | "salary" | "commission" | "partner";
export type ExpensePattern = "fixed" | "variable" | "eventual";
export type BlockType = "hold" | "skip_occurrence" | "end_recurrence";

export interface Expense {
  id: string;
  description: string;
  category: string;
  nature: ExpenseNature;
  origin: ExpenseOrigin;
  pattern: ExpensePattern;
  employeeId: string | null;
  partnerId: string | null;
  amount: number;
  paidAmount: number | null;
  status: ExpenseStatus;
  competence: string | null;
  dueDate: string | null;
  scheduledPaymentAt: string | null;
  settledAt: string | null;
  paidAt: string | null;
  blockType: BlockType | null;
  blockReason: string | null;
  blockedAt: string | null;
  originalExpenseId: string | null;
  adjustmentReason: string | null;
  sourceModule: string | null;
  sourceEntityId: string | null;
  partyName: string | null;
  documentRef: string | null;
  createdAt: string;
}

export interface NewExpenseInput {
  description: string;
  category: string;
  nature: ExpenseNature;
  origin?: ExpenseOrigin;
  pattern?: ExpensePattern;
  amount: number;
  dueDate?: string;
  competence?: string;
  employeeId?: string;
  partnerId?: string;
  partyName?: string;
  documentRef?: string;
}

export interface SalaryObligation {
  id: string;
  employeeId: string;
  employeeName: string;
  competence: string;
  baseSalary: number;
  status: "ABERTO" | "PAGO" | "ATRASADO";
  advancesPaid: number;
  remaining: number;
}

export interface SalaryAdvance {
  id: string;
  obligationId: string;
  amount: number;
  status: "SOLICITADO" | "PAGO" | "ESTORNADO";
  requestedAt: string;
  paidAt: string | null;
  reversedAdvanceId: string | null;
}

export interface InvestmentFormationEntry {
  id: string;
  categoryId: string;
  sourceExpenseId: string | null;
  direction: "credit" | "debit" | "reversal";
  amount: number;
  competence: string;
  occurredAt: string;
}

export type ExpensePeriod = "month" | "3m" | "6m" | "year" | "custom";
export type EvolutionWindow = "3m" | "6m" | "1y";

interface PeriodRange {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}

const ORIGIN_LABEL: Record<ExpenseOrigin, string> = {
  stock: "Insumos e Mercadorias",
  asset: "Bens e Investimentos",
  expense: "Serviços e Outras Despesas",
  salary: "Gestão Salarial",
  commission: "Força de Vendas / Comissões",
  partner: "Sócios e Retiradas",
};

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // yyyy-mm
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DespesasState {
  expenses: Expense[];
  obligations: SalaryObligation[];
  advances: SalaryAdvance[];
  formationLedger: InvestmentFormationEntry[];
  status: "idle" | "loading" | "ready" | "error";
  realtimeChannel: RealtimeChannel | null;

  fetchAll: () => Promise<void>;
  createExpense: (input: NewExpenseInput) => Promise<string | null>;
  markExpensePaid: (id: string, paidAmount: number) => Promise<string | null>;

  generateObligation: (employeeId: string, employeeName: string, competence: string, baseSalary: number) => Promise<string | null>;
  createAdvance: (obligationId: string, amount: number) => Promise<string | null>;
  payAdvance: (id: string) => Promise<string | null>;
  reverseAdvance: (id: string) => Promise<string | null>;

  blockExpense: (id: string, blockType: BlockType, reason: string) => Promise<string | null>;
  createExpenseAdjustment: (
    originalId: string,
    reason: string,
    changes?: { amount?: number; category?: string; description?: string }
  ) => Promise<string | null>;
  createPartnerWithdrawal: (input: {
    partnerId: string;
    partnerName?: string;
    description: string;
    amount: number;
    competence: string;
    dueDate?: string;
    pattern?: ExpensePattern;
  }) => Promise<string | null>;
  createServiceExpense: (input: {
    description: string;
    category: string;
    amount: number;
    competence: string;
    dueDate?: string;
    pattern?: ExpensePattern;
    partyName?: string;
    documentRef?: string;
  }) => Promise<string | null>;
  createAssetInvestment: (input: {
    description: string;
    categoryId: string;
    amount: number;
    competence: string;
    dueDate?: string;
    pattern?: ExpensePattern;
  }) => Promise<string | null>;

  // Read-model (agregações client-side sobre `expenses` já carregado)
  getByPeriod: (period: ExpensePeriod, referenceDate?: Date, customRange?: PeriodRange) => Expense[];
  getEvolution: (window: EvolutionWindow, referenceDate?: Date) => { month: string; label: string; total: number }[];
  getByOrigin: (list?: Expense[]) => { origin: ExpenseOrigin; label: string; total: number }[];
  getComposition: (list?: Expense[]) => { pattern: ExpensePattern; label: string; total: number; count: number }[];

  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

function mapExpenseRow(e: Record<string, unknown>): Expense {
  return {
    id: e.id as string,
    description: e.description as string,
    category: e.category as string,
    nature: e.nature as ExpenseNature,
    origin: (e.origin as ExpenseOrigin) ?? "expense",
    pattern: (e.pattern as ExpensePattern) ?? "eventual",
    employeeId: e.employee_id as string | null,
    partnerId: e.partner_id as string | null,
    amount: e.amount as number,
    paidAmount: e.paid_amount as number | null,
    status: e.status as ExpenseStatus,
    competence: e.competence as string | null,
    dueDate: e.due_date as string | null,
    scheduledPaymentAt: e.scheduled_payment_at as string | null,
    settledAt: e.settled_at as string | null,
    paidAt: e.paid_at as string | null,
    blockType: e.block_type as BlockType | null,
    blockReason: e.block_reason as string | null,
    blockedAt: e.blocked_at as string | null,
    originalExpenseId: e.original_expense_id as string | null,
    adjustmentReason: e.adjustment_reason as string | null,
    sourceModule: e.source_module as string | null,
    sourceEntityId: e.source_entity_id as string | null,
    partyName: e.party_name as string | null,
    documentRef: e.document_ref as string | null,
    createdAt: e.created_at as string,
  };
}

export const useDespesasStore = create<DespesasState>((set, get) => ({
  expenses: [],
  obligations: [],
  advances: [],
  formationLedger: [],
  status: "idle",
  realtimeChannel: null,

  fetchAll: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const [{ data: expenseRows, error: expenseError }, { data: obligationRows, error: obligationError }, { data: advanceRows }, { data: ledgerRows }] =
      await Promise.all([
        supabase.from("expenses").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase
          .from("salary_obligations")
          .select("id, employee_id, competence, base_salary, status, employees(name)")
          .eq("company_id", companyId)
          .order("competence", { ascending: false }),
        supabase.from("salary_advances").select("id, salary_obligation_id, amount, status, requested_at, paid_at, reversed_advance_id").eq("company_id", companyId),
        supabase
          .from("investment_formation_ledger")
          .select("id, category_id, source_expense_id, direction, amount, competence, occurred_at")
          .eq("company_id", companyId)
          .order("occurred_at", { ascending: false }),
      ]);

    if (expenseError || obligationError) {
      set({ status: "error" });
      return;
    }

    const advances: SalaryAdvance[] = (advanceRows ?? []).map((a) => ({
      id: a.id,
      obligationId: a.salary_obligation_id,
      amount: a.amount,
      status: a.status as SalaryAdvance["status"],
      requestedAt: a.requested_at,
      paidAt: a.paid_at,
      reversedAdvanceId: a.reversed_advance_id,
    }));

    const reversedOriginalIds = new Set(advances.filter((a) => a.status === "ESTORNADO" && a.reversedAdvanceId).map((a) => a.reversedAdvanceId));
    const paidByObligation = new Map<string, number>();
    advances.forEach((a) => {
      if (a.status !== "PAGO" || reversedOriginalIds.has(a.id)) return;
      paidByObligation.set(a.obligationId, (paidByObligation.get(a.obligationId) ?? 0) + a.amount);
    });

    set({
      expenses: (expenseRows ?? []).map(mapExpenseRow),
      obligations: (obligationRows ?? []).map((o) => {
        const paid = paidByObligation.get(o.id) ?? 0;
        return {
          id: o.id,
          employeeId: o.employee_id,
          employeeName: (o.employees as unknown as { name: string } | null)?.name ?? "-----",
          competence: o.competence,
          baseSalary: o.base_salary,
          status: o.status as SalaryObligation["status"],
          advancesPaid: paid,
          remaining: o.base_salary - paid,
        };
      }),
      advances,
      formationLedger: (ledgerRows ?? []).map((l) => ({
        id: l.id,
        categoryId: l.category_id,
        sourceExpenseId: l.source_expense_id,
        direction: l.direction as InvestmentFormationEntry["direction"],
        amount: l.amount,
        competence: l.competence,
        occurredAt: l.occurred_at,
      })),
      status: "ready",
    });
  },

  createExpense: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      description: input.description,
      category: input.category,
      nature: input.nature,
      origin: input.origin ?? "expense",
      pattern: input.pattern ?? "eventual",
      amount: input.amount,
      due_date: input.dueDate || null,
      competence: input.competence || null,
      employee_id: input.employeeId || null,
      partner_id: input.partnerId || null,
      party_name: input.partyName || null,
      document_ref: input.documentRef || null,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  markExpensePaid: async (id, paidAmount) => {
    const { data: expense } = await supabase.from("expenses").select("amount, paid_amount, due_date").eq("id", id).maybeSingle();
    const alreadyPaid = expense?.paid_amount ?? 0;
    const total = expense?.amount ?? paidAmount;
    const newPaid = alreadyPaid + paidAmount;
    const isOverdue = !!expense?.due_date && expense.due_date < new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const isSettled = newPaid >= total;
    const { error } = await supabase
      .from("expenses")
      .update({
        status: isSettled ? "PAGO" : isOverdue ? "ATRASADO" : "ABERTO",
        paid_at: nowIso,
        paid_amount: newPaid,
        settled_at: isSettled ? nowIso : null,
      })
      .eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  generateObligation: async (employeeId, _employeeName, competence, baseSalary) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";

    // Salário-base resolvido pela vigência da competência — nunca redigitado (PRD §5.8 / RFC §15.1)
    const { data: resolvedBase } = await supabase.rpc("resolve_salary_base", {
      p_employee_id: employeeId,
      p_competence: competence,
    });
    const effectiveBase = typeof resolvedBase === "number" ? resolvedBase : baseSalary;

    const { error } = await supabase
      .from("salary_obligations")
      .insert({ employee_id: employeeId, competence, base_salary: effectiveBase, net_amount: effectiveBase, company_id: companyId });
    if (error) return error.code === "23505" ? "Já existe obrigação salarial para este colaborador nesta competência" : error.message;
    await get().fetchAll();
    return null;
  },

  createAdvance: async (obligationId, amount) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase
      .from("salary_advances")
      .insert({ salary_obligation_id: obligationId, amount, status: "SOLICITADO", company_id: companyId });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  payAdvance: async (id) => {
    const { error } = await supabase.from("salary_advances").update({ status: "PAGO", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  reverseAdvance: async (id) => {
    const { data: original, error: fetchError } = await supabase
      .from("salary_advances")
      .select("salary_obligation_id, amount")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !original) return fetchError?.message ?? "Vale original não encontrado";

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";

    const { error } = await supabase.from("salary_advances").insert({
      company_id: companyId,
      salary_obligation_id: original.salary_obligation_id,
      amount: original.amount,
      status: "ESTORNADO",
      paid_at: new Date().toISOString(),
      reversed_advance_id: id,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  blockExpense: async (id, blockType, reason) => {
    const { error } = await supabase.rpc("block_expense", { p_expense_id: id, p_block_type: blockType, p_reason: reason });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  createExpenseAdjustment: async (originalId, reason, changes) => {
    const { error } = await supabase.rpc("create_expense_adjustment", {
      p_original_expense_id: originalId,
      p_reason: reason,
      p_new_amount: changes?.amount ?? undefined,
      p_new_category: changes?.category ?? undefined,
      p_new_description: changes?.description ?? undefined,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  createPartnerWithdrawal: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      description: input.description,
      category: "Retirada de sócio",
      nature: "OUTRO",
      origin: "partner",
      pattern: input.pattern ?? "eventual",
      amount: input.amount,
      competence: input.competence,
      due_date: input.dueDate || null,
      partner_id: input.partnerId,
      party_name: input.partnerName || null,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  createServiceExpense: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      description: input.description,
      category: input.category,
      nature: "OPERACIONAL",
      origin: "expense",
      pattern: input.pattern ?? "eventual",
      amount: input.amount,
      competence: input.competence,
      due_date: input.dueDate || null,
      party_name: input.partyName || null,
      document_ref: input.documentRef || null,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  createAssetInvestment: async (input) => {
    const { error } = await supabase.rpc("create_asset_investment", {
      p_description: input.description,
      p_category_id: input.categoryId,
      p_amount: input.amount,
      p_competence: input.competence,
      p_due_date: input.dueDate ?? undefined,
      p_pattern: input.pattern ?? "eventual",
      p_idempotency_key: undefined,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  getByPeriod: (period, referenceDate = new Date(), customRange) => {
    const { expenses } = get();
    let from: string;
    let to: string;

    if (period === "custom" && customRange) {
      from = customRange.from;
      to = customRange.to;
    } else if (period === "month") {
      from = toIsoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
      to = toIsoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0));
    } else if (period === "3m") {
      from = toIsoDate(addMonths(referenceDate, -2));
      to = toIsoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0));
    } else if (period === "6m") {
      from = toIsoDate(addMonths(referenceDate, -5));
      to = toIsoDate(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0));
    } else {
      from = toIsoDate(new Date(referenceDate.getFullYear(), 0, 1));
      to = toIsoDate(new Date(referenceDate.getFullYear(), 11, 31));
    }

    return expenses.filter((e) => e.competence && e.competence >= from && e.competence <= to);
  },

  getEvolution: (window, referenceDate = new Date()) => {
    const { expenses } = get();
    const monthsCount = window === "3m" ? 3 : window === "6m" ? 6 : 12;
    const months: { month: string; label: string; total: number }[] = [];

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = addMonths(referenceDate, -i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: i === monthsCount - 1 || d.getMonth() === 0 ? "2-digit" : undefined });
      const total = expenses.filter((e) => e.competence && monthKey(e.competence) === key).reduce((sum, e) => sum + e.amount, 0);
      months.push({ month: key, label, total });
    }

    return months;
  },

  getByOrigin: (list) => {
    const expenses = list ?? get().expenses;
    const totals = new Map<ExpenseOrigin, number>();
    expenses.forEach((e) => totals.set(e.origin, (totals.get(e.origin) ?? 0) + e.amount));
    return (Object.keys(ORIGIN_LABEL) as ExpenseOrigin[])
      .map((origin) => ({ origin, label: ORIGIN_LABEL[origin], total: totals.get(origin) ?? 0 }))
      .filter((o) => o.total > 0);
  },

  getComposition: (list) => {
    const expenses = list ?? get().expenses;
    const groups: Record<ExpensePattern, { total: number; count: number }> = {
      fixed: { total: 0, count: 0 },
      variable: { total: 0, count: 0 },
      eventual: { total: 0, count: 0 },
    };
    expenses.forEach((e) => {
      groups[e.pattern].total += e.amount;
      groups[e.pattern].count += 1;
    });
    const labels: Record<ExpensePattern, string> = { fixed: "Recorrente fixa", variable: "Recorrente variável", eventual: "Eventual" };
    return (Object.keys(groups) as ExpensePattern[]).map((pattern) => ({
      pattern,
      label: labels[pattern],
      total: groups[pattern].total,
      count: groups[pattern].count,
    }));
  },

  subscribeRealtime: () => {
    if (get().realtimeChannel) return;
    const channel = supabase
      .channel("despesas")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => get().fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "salary_obligations" }, () => get().fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "salary_advances" }, () => get().fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "investment_formation_ledger" }, () => get().fetchAll())
      .subscribe();
    set({ realtimeChannel: channel });
  },

  unsubscribeRealtime: () => {
    const channel = get().realtimeChannel;
    if (channel) {
      supabase.removeChannel(channel);
      set({ realtimeChannel: null });
    }
  },
}));
