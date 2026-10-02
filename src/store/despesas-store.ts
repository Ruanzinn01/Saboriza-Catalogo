import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type ExpenseNature = "OPERACIONAL" | "INVESTIMENTO" | "SALARIO" | "OUTRO";
export type ExpenseStatus = "ABERTO" | "AGENDADO" | "PAGO" | "ATRASADO";

export interface Expense {
  id: string;
  description: string;
  category: string;
  nature: ExpenseNature;
  employeeId: string | null;
  amount: number;
  paidAmount: number | null;
  status: ExpenseStatus;
  competence: string | null;
  dueDate: string | null;
  paidAt: string | null;
}

export interface NewExpenseInput {
  description: string;
  category: string;
  nature: ExpenseNature;
  amount: number;
  dueDate?: string;
  competence?: string;
  employeeId?: string;
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

interface DespesasState {
  expenses: Expense[];
  obligations: SalaryObligation[];
  advances: SalaryAdvance[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createExpense: (input: NewExpenseInput) => Promise<string | null>;
  markExpensePaid: (id: string, paidAmount: number) => Promise<string | null>;

  generateObligation: (employeeId: string, employeeName: string, competence: string, baseSalary: number) => Promise<string | null>;
  createAdvance: (obligationId: string, amount: number) => Promise<string | null>;
  payAdvance: (id: string) => Promise<string | null>;
  reverseAdvance: (id: string) => Promise<string | null>;
}

export const useDespesasStore = create<DespesasState>((set, get) => ({
  expenses: [],
  obligations: [],
  advances: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }

    const [{ data: expenseRows, error: expenseError }, { data: obligationRows, error: obligationError }, { data: advanceRows }] = await Promise.all([
      supabase.from("expenses").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase
        .from("salary_obligations")
        .select("id, employee_id, competence, base_salary, status, employees(name)")
        .eq("company_id", companyId)
        .order("competence", { ascending: false }),
      supabase.from("salary_advances").select("id, salary_obligation_id, amount, status, requested_at, paid_at, reversed_advance_id").eq("company_id", companyId),
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
      expenses: (expenseRows ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        nature: e.nature as ExpenseNature,
        employeeId: e.employee_id,
        amount: e.amount,
        paidAmount: e.paid_amount,
        status: e.status as ExpenseStatus,
        competence: e.competence,
        dueDate: e.due_date,
        paidAt: e.paid_at,
      })),
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
      amount: input.amount,
      due_date: input.dueDate || null,
      competence: input.competence || null,
      employee_id: input.employeeId || null,
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
    const { error } = await supabase
      .from("expenses")
      .update({
        status: newPaid >= total ? "PAGO" : isOverdue ? "ATRASADO" : "ABERTO",
        paid_at: new Date().toISOString(),
        paid_amount: newPaid,
      })
      .eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  generateObligation: async (employeeId, _employeeName, competence, baseSalary) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const { error } = await supabase
      .from("salary_obligations")
      .insert({ employee_id: employeeId, competence, base_salary: baseSalary, company_id: companyId });
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
}));
