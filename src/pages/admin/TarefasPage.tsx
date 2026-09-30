import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useTasksStore, formatTaskStatus, type TaskStatus } from "@/store/tasks-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR");

const STATUS_TONE: Record<TaskStatus, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  EM_ANDAMENTO: "bg-blue-100 text-blue-800",
  CONCLUIDA: "bg-emerald-100 text-emerald-800",
  CANCELADA: "bg-ink-900/10 text-ink-muted",
};

function NewTaskForm({ onDone }: { onDone: () => void }) {
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
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Colaborador
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">-----</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Prazo (opcional)
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900 sm:col-span-2">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900 sm:col-span-2">
          Descrição (opcional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 px-3 py-2 text-sm" />
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Criar tarefa"}
      </Button>
    </div>
  );
}

export function TarefasPage() {
  const tasks = useTasksStore((s) => s.tasks);
  const status = useTasksStore((s) => s.status);
  const fetchTasks = useTasksStore((s) => s.fetchTasks);
  const updateTaskStatus = useTasksStore((s) => s.updateTaskStatus);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleStatusChange(id: string, value: TaskStatus) {
    const err = await updateTaskStatus(id, value);
    if (err) toast.error(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Tarefas e Missões</h1>
          <p className="text-sm text-ink-muted">Tarefas atribuídas a colaboradores, com prazo e acompanhamento de status.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus size={18} /> Nova tarefa
        </Button>
      </div>

      {showForm && <NewTaskForm onDone={() => setShowForm(false)} />}

      {status === "loading" && tasks.length === 0 ? (
        <AdminState variant="loading" message="Carregando tarefas..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar as tarefas." />
      ) : tasks.length === 0 ? (
        <AdminState variant="empty" message="Nenhuma tarefa cadastrada ainda." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Tarefa</th>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{t.title}</p>
                    {t.description && <p className="text-xs text-ink-muted">{t.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">
                    <Link to={`/admin/colaboradores/${t.employeeId}`} className="hover:underline">{t.employeeName}</Link>
                  </td>
                  <td className="px-4 py-3 text-ink-700/70">{t.dueDate ? brDate(t.dueDate) : "-----"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onChange={(e) => void handleStatusChange(t.id, e.target.value as TaskStatus)}
                      className={`h-9 rounded-full border-none px-3 text-xs font-semibold outline-none ${STATUS_TONE[t.status]}`}
                    >
                      {(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"] as TaskStatus[]).map((s) => (
                        <option key={s} value={s}>{formatTaskStatus(s)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
