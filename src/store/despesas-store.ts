import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type ExpenseNature = "OPERACIONAL" | "INVESTIMENTO" | "SALARIO" | "OUTRO";
export type ExpenseStatus = "ABERTO" | "AGENDADO" | "PAGO" | "ATRASADO";

export interface Expense {
  id: string;
  description: string;
  category: string;
  nature: ExpenseNature;
  employeeId: string | null;
  amount: number;
  status: ExpenseStatus;
  dueDate: string | null;
  paidAt: string | null;
}

export interface NewExpenseInput {
  description: string;
  category: string;
  nature: ExpenseNature;
  amount: number;
  dueDate?: string;
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

interface DespesasState {
  expenses: Expense[];
  obligations: SalaryObligation[];
  status: "idle" | "loading" | "ready" | "error";

  fetchAll: () => Promise<void>;
  createExpense: (input: NewExpenseInput) => Promise<string | null>;
  markExpensePaid: (id: string, paidAmount: number) => Promise<string | null>;

  generateObligation: (employeeId: string, employeeName: string, competence: string, baseSalary: number) => Promise<string | null>;
  createAdvance: (obligationId: string, amount: number) => Promise<string | null>;
  payAdvance: (id: string) => Promise<string | null>;
}

export const useDespesasStore = create<DespesasState>((set, get) => ({
  expenses: [],
  obligations: [],
  status: "idle",

  fetchAll: async () => {
    set({ status: "loading" });

    const [{ data: expenseRows, error: expenseError }, { data: obligationRows, error: obligationError }, { data: advanceRows }] = await Promise.all([
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("salary_obligations").select("id, employee_id, competence, base_salary, status, employees(name)").order("competence", { ascending: false }),
      supabase.from("salary_advances").select("salary_obligation_id, amount, status"),
    ]);

    if (expenseError || obligationError) {
      set({ status: "error" });
      return;
    }

    const paidByObligation = new Map<string, number>();
    (advanceRows ?? []).forEach((a) => {
      if (a.status !== "PAGO") return;
      paidByObligation.set(a.salary_obligation_id, (paidByObligation.get(a.salary_obligation_id) ?? 0) + a.amount);
    });

    set({
      expenses: (expenseRows ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        nature: e.nature as ExpenseNature,
        employeeId: e.employee_id,
        amount: e.amount,
        status: e.status as ExpenseStatus,
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
      status: "ready",
    });
  },

  createExpense: async (input) => {
    const { error } = await supabase.from("expenses").insert({
      description: input.description,
      category: input.category,
      nature: input.nature,
      amount: input.amount,
      due_date: input.dueDate || null,
      employee_id: input.employeeId || null,
    });
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  markExpensePaid: async (id, paidAmount) => {
    const { error } = await supabase.from("expenses").update({ status: "PAGO", paid_at: new Date().toISOString(), paid_amount: paidAmount }).eq("id", id);
    if (error) return error.message;
    await get().fetchAll();
    return null;
  },

  generateObligation: async (employeeId, _employeeName, competence, baseSalary) => {
    const { error } = await supabase.from("salary_obligations").insert({ employee_id: employeeId, competence, base_salary: baseSalary });
    if (error) return error.code === "23505" ? "Já existe obrigação salarial para este colaborador nesta competência" : error.message;
    await get().fetchAll();
    return null;
  },

  createAdvance: async (obligationId, amount) => {
    const { error } = await supabase.from("salary_advances").insert({ salary_obligation_id: obligationId, amount, status: "SOLICITADO" });
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
}));
