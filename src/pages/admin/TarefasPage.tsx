import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, Plus, Search } from "lucide-react";
import { useTasksStore, formatTaskStatus, type EmployeeTask, type TaskStatus } from "@/store/tasks-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

const brDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const STATUS_TONE: Record<TaskStatus, string> = {
  PENDENTE: "bg-ink-900/5 text-ink-700",
  EM_ANDAMENTO: "bg-blue-50 text-blue-700",
  CONCLUIDA: "bg-emerald-50 text-emerald-700",
  CANCELADA: "bg-ink-900/5 text-ink-muted line-through decoration-ink-muted/50",
};

type Bucket = "atrasada" | "hoje" | "semana" | "sem_prazo" | "futura" | "encerrada";

const BUCKET_LABEL: Record<Bucket, string> = {
  atrasada: "Atrasadas",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  sem_prazo: "Sem prazo",
  futura: "Mais adiante",
  encerrada: "Concluídas e canceladas",
};

const BUCKET_ORDER: Bucket[] = ["atrasada", "hoje", "semana", "sem_prazo", "futura", "encerrada"];

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function bucketFor(task: EmployeeTask): Bucket {
  if (task.status === "CONCLUIDA" || task.status === "CANCELADA") return "encerrada";
  if (!task.dueDate) return "sem_prazo";

  const today = startOfToday();
  const due = new Date(`${task.dueDate}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "atrasada";
  if (diffDays === 0) return "hoje";
  if (diffDays <= 7) return "semana";
  return "futura";
}

function NewTaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTask = useTasksStore((s) => s.createTask);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  useEffect(() => {
    if (!open) {
      setEmployeeId("");
      setTitle("");
      setDescription("");
      setDueDate("");
    }
  }, [open]);

  async function submit() {
    if (!employeeId || !title) {
      toast.error("Selecione o colaborador e informe o título da tarefa");
      return;
    }
    setSaving(true);
    const err = await createTask({ employeeId, title, description: description || undefined, dueDate: dueDate || undefined });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Tarefa criada");
    onClose();
  }

  const inputClass = "h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nova tarefa"
      footer={
        <Button onClick={() => void submit()} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Criar tarefa"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-900">
          Colaborador
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} autoFocus>
            <option value="">Selecione...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-900">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-900">
          Descrição (opcional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detalhes, contexto ou instruções"
            className="rounded-xl border border-ink-900/15 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-forest-700"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-900">
          Prazo (opcional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </label>
      </div>
    </Sheet>
  );
}

function TaskRow({ task }: { task: EmployeeTask }) {
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus);
  const bucket = bucketFor(task);
  const isDone = task.status === "CONCLUIDA";
  const isCancelled = task.status === "CANCELADA";

  async function toggleDone() {
    const err = await updateTaskStatus(task.id, isDone ? "PENDENTE" : "CONCLUIDA");
    if (err) toast.error(err);
  }

  async function changeStatus(status: TaskStatus) {
    const err = await updateTaskStatus(task.id, status);
    if (err) toast.error(err);
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <button
        type="button"
        onClick={() => void toggleDone()}
        disabled={isCancelled}
        aria-label={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
        aria-pressed={isDone}
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isDone ? "border-emerald-600 bg-emerald-600 text-white" : "border-ink-900/20 text-transparent hover:border-forest-700",
          isCancelled && "opacity-40"
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className={cn("text-sm font-semibold text-ink-900", (isDone || isCancelled) && "text-ink-muted line-through decoration-ink-muted/40")}>
            {task.title}
          </p>
          {task.dueDate && (
            <span className={cn("shrink-0 text-xs font-semibold", bucket === "atrasada" ? "text-red-600" : "text-ink-muted")}>
              {brDate(task.dueDate)}
            </span>
          )}
        </div>
        {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{task.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            to={`/admin/colaboradores/${task.employeeId}`}
            className="rounded-full bg-forest-950/[0.04] px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-950/10"
          >
            {task.employeeName}
          </Link>
          <select
            value={task.status}
            onChange={(e) => void changeStatus(e.target.value as TaskStatus)}
            className={cn("h-7 shrink-0 rounded-full border-none px-2.5 text-xs font-semibold outline-none", STATUS_TONE[task.status])}
          >
            {(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{formatTaskStatus(s)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function TarefasPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const status = useTasksStore((s) => s.status);
  const fetchTasks = useTasksStore((s) => s.fetchTasks);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchTasks();
    if (employees.length === 0) fetchEmployees();
  }, [fetchTasks, employees.length, fetchEmployees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (employeeFilter && t.employeeId !== employeeFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, employeeFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<Bucket, EmployeeTask[]>();
    for (const task of filtered) {
      const bucket = bucketFor(task);
      const list = map.get(bucket) ?? [];
      list.push(task);
      map.set(bucket, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    }
    return map;
  }, [filtered]);

  const openCount = tasks.filter((t) => t.status === "PENDENTE" || t.status === "EM_ANDAMENTO").length;
  const overdueCount = tasks.filter((t) => bucketFor(t) === "atrasada").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Tarefas e Missões</h1>
          <p className="text-sm text-ink-muted">
            {openCount} em aberto{overdueCount > 0 && <span className="text-red-600"> · {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setSheetOpen(true)}>
          <Plus size={18} /> Nova tarefa
        </Button>
      </div>

      {tasks.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por tarefa ou colaborador..."
              className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-10 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
            />
          </div>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="h-11 shrink-0 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700 sm:w-56"
          >
            <option value="">Todos os colaboradores</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
      )}

      {status === "loading" && tasks.length === 0 ? (
        <AdminState variant="loading" message="Carregando tarefas..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as tarefas." onRetry={fetchTasks} />
      ) : tasks.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma tarefa cadastrada ainda. Crie uma tarefa pra atribuir a um colaborador." />
      ) : filtered.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma tarefa encontrada com esse filtro." />
      ) : (
        <div className="flex flex-col gap-5">
          {BUCKET_ORDER.filter((bucket) => grouped.has(bucket)).map((bucket) => (
            <section key={bucket} className="flex flex-col gap-2">
              <h2 className={cn("px-1 text-xs font-bold uppercase tracking-wide", bucket === "atrasada" ? "text-red-600" : "text-ink-muted")}>
                {BUCKET_LABEL[bucket]}
              </h2>
              <div
                className={cn(
                  "flex flex-col divide-y divide-forest-950/5 overflow-hidden rounded-3xl border bg-white",
                  bucket === "atrasada" ? "border-red-200" : "border-forest-950/10",
                  bucket === "encerrada" && "opacity-70"
                )}
              >
                {grouped.get(bucket)!.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <NewTaskSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
