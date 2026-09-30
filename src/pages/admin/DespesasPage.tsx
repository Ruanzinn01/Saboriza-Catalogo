import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";
import { useDespesasStore, type ExpenseNature } from "@/store/despesas-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NATURES: ExpenseNature[] = ["OPERACIONAL", "INVESTIMENTO", "OUTRO"];

const STATUS_TONE: Record<string, string> = {
  ABERTO: "bg-gold-500/20 text-gold-700",
  AGENDADO: "bg-amber-100 text-amber-800",
  PAGO: "bg-emerald-100 text-emerald-800",
  ATRASADO: "bg-red-100 text-red-700",
};

function NewExpenseForm({ onDone }: { onDone: () => void }) {
  const createExpense = useDespesasStore((s) => s.createExpense);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [nature, setNature] = useState<ExpenseNature>("OPERACIONAL");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!description || !amount) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSaving(true);
    const err = await createExpense({ description, category, nature, amount: Number(amount), dueDate: dueDate || undefined });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Despesa lançada");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Descrição
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Categoria
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Natureza
          <select value={nature} onChange={(e) => setNature(e.target.value as ExpenseNature)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            {NATURES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Valor
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Vencimento
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Lançar despesa"}
      </Button>
    </div>
  );
}

function SalariosTab() {
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const obligations = useDespesasStore((s) => s.obligations);
  const generateObligation = useDespesasStore((s) => s.generateObligation);
  const createAdvance = useDespesasStore((s) => s.createAdvance);
  const payAdvance = useDespesasStore((s) => s.payAdvance);
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  const employeesWithoutObligation = employees.filter(
    (e) => e.salaryBase && !obligations.some((o) => o.employeeId === e.id && o.competence === competence)
  );

  async function handleGenerateAll() {
    for (const e of employeesWithoutObligation) {
      await generateObligation(e.id, e.name, competence, e.salaryBase ?? 0);
    }
    toast.success("Obrigações salariais geradas");
  }

  async function handleAdvance(obligationId: string) {
    const value = Number(advanceInputs[obligationId]);
    if (!value) return;
    const err = await createAdvance(obligationId, value);
    if (err) toast.error(err);
    else {
      toast.success("Vale solicitado");
      setAdvanceInputs((s) => ({ ...s, [obligationId]: "" }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Competência
          <input type="month" value={competence.slice(0, 7)} onChange={(e) => setCompetence(e.target.value + "-01")} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        {employeesWithoutObligation.length > 0 && (
          <Button onClick={() => void handleGenerateAll()}>
            Gerar obrigações ({employeesWithoutObligation.length} colaborador{employeesWithoutObligation.length > 1 ? "es" : ""})
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">Salário</th>
              <th className="px-4 py-3">Vales pagos</th>
              <th className="px-4 py-3">Saldo restante</th>
              <th className="px-4 py-3">Novo vale</th>
            </tr>
          </thead>
          <tbody>
            {obligations.filter((o) => o.competence === competence).map((o) => (
              <tr key={o.id} className="border-b border-forest-950/5 last:border-none">
                <td className="px-4 py-3 font-semibold text-ink-900">
                  <Link to={`/admin/colaboradores/${o.employeeId}`} className="hover:underline">
                    {o.employeeName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-700/70">{brl(o.baseSalary)}</td>
                <td className="px-4 py-3 text-ink-700/70">{brl(o.advancesPaid)}</td>
                <td className="px-4 py-3 font-semibold text-forest-950">{brl(o.remaining)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={advanceInputs[o.id] ?? ""}
                      onChange={(e) => setAdvanceInputs((s) => ({ ...s, [o.id]: e.target.value }))}
                      className="h-9 w-24 rounded-lg border border-ink-900/15 px-2 text-sm"
                      placeholder="R$"
                    />
                    <button onClick={() => void handleAdvance(o.id)} className="rounded-lg border border-forest-950/15 px-2 py-1.5 text-xs font-bold text-forest-800 hover:bg-forest-950/5">
                      Registrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DespesasPage() {
  const expenses = useDespesasStore((s) => s.expenses);
  const status = useDespesasStore((s) => s.status);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const markExpensePaid = useDespesasStore((s) => s.markExpensePaid);
  const [tab, setTab] = useState<"despesas" | "salarios">("despesas");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openTotal = useMemo(() => expenses.filter((e) => e.status !== "PAGO").reduce((s, e) => s + e.amount, 0), [expenses]);

  async function handlePaid(id: string, amount: number) {
    const err = await markExpensePaid(id, amount);
    if (err) toast.error(err);
    else toast.success("Despesa marcada como paga");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Despesas</h1>
          <p className="text-sm text-ink-muted">O salário não é redigitado aqui — vem do cadastro do colaborador.</p>
        </div>
        {tab === "despesas" && (
          <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
            <Plus size={18} /> Nova despesa
          </Button>
        )}
      </div>

      <div className="flex gap-2 rounded-xl bg-forest-950/5 p-1 w-fit">
        {[
          ["despesas", "Lançamentos"],
          ["salarios", "Salários e Vales"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as "despesas" | "salarios")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "despesas" ? (
        <>
          {showForm && <NewExpenseForm onDone={() => setShowForm(false)} />}
          <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
            <p className="text-xs text-ink-muted">Total em aberto</p>
            <p className="text-xl font-extrabold text-red-600">{brl(openTotal)}</p>
          </div>

          {status === "loading" && expenses.length === 0 ? (
            <AdminState variant="loading" message="Carregando despesas..." />
          ) : status === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar as despesas." />
          ) : expenses.length === 0 ? (
            <AdminState variant="empty" message="Nenhuma despesa lançada ainda." />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Natureza</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                      <td className="px-4 py-3 font-semibold text-ink-900">{e.description}</td>
                      <td className="px-4 py-3 text-ink-700/70">{e.nature}</td>
                      <td className="px-4 py-3 font-semibold text-ink-900">{brl(e.amount)}</td>
                      <td className="px-4 py-3 text-ink-700/70">{e.dueDate ?? "-----"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[e.status]}`}>{e.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {e.status !== "PAGO" && (
                          <button
                            onClick={() => void handlePaid(e.id, e.amount)}
                            aria-label="Marcar como pago"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <SalariosTab />
      )}
    </div>
  );
}
