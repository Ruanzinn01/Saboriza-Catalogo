import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { resolveCurrentCompanyId } from "@/lib/current-company";

export type TaskStatus = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface EmployeeTask {
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface NewTaskInput {
  employeeId: string;
  title: string;
  description?: string;
  dueDate?: string;
}

interface TasksState {
  tasks: EmployeeTask[];
  status: "idle" | "loading" | "ready" | "error";

  fetchTasks: () => Promise<void>;
  createTask: (input: NewTaskInput) => Promise<string | null>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<string | null>;
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  status: "idle",

  fetchTasks: async () => {
    set({ status: "loading" });
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) {
      set({ status: "error" });
      return;
    }
    const { data, error } = await supabase
      .from("employee_tasks")
      .select("id, employee_id, title, description, due_date, status, completed_at, created_at, employees(name)")
      .eq("company_id", companyId)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error || !data) {
      set({ status: "error" });
      return;
    }

    set({
      tasks: data.map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: (row.employees as unknown as { name: string } | null)?.name ?? "-----",
        title: row.title,
        description: row.description,
        dueDate: row.due_date,
        status: row.status as TaskStatus,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      })),
      status: "ready",
    });
  },

  createTask: async (input) => {
    const companyId = await resolveCurrentCompanyId();
    if (!companyId) return "Não foi possível identificar a empresa";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("employee_tasks").insert({
      company_id: companyId,
      employee_id: input.employeeId,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate || null,
      created_by: user?.id ?? null,
    });
    if (error) return error.message;
    await get().fetchTasks();
    return null;
  },

  updateTaskStatus: async (id, status) => {
    const { error } = await supabase
      .from("employee_tasks")
      .update({ status, completed_at: status === "CONCLUIDA" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return error.message;
    await get().fetchTasks();
    return null;
  },
}));

export function formatTaskStatus(status: TaskStatus): string {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "EM_ANDAMENTO":
      return "Em andamento";
    case "CONCLUIDA":
      return "Concluída";
    case "CANCELADA":
      return "Cancelada";
  }
}
