import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, CheckCircle2, RotateCcw } from "lucide-react";
import { useDespesasStore, type ExpenseNature } from "@/store/despesas-store";
import { useEmployeesStore } from "@/store/employees-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const NATURES: ExpenseNature[] = ["OPERACIONAL", "INVESTIMENTO", "OUTRO"];
const todayIso = () => new Date().toISOString().slice(0, 10);

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
  const [competence, setCompetence] = useState(() => todayIso().slice(0, 7) + "-01");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!description || !amount) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSaving(true);
    const err = await createExpense({ description, category, nature, amount: Number(amount), dueDate: dueDate || undefined, competence });
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
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Competência
          <input type="month" value={competence.slice(0, 7)} onChange={(e) => setCompetence(e.target.value + "-01")} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Lançar despesa"}
      </Button>
    </div>
  );
}

function VisaoGeralTab() {
  const expenses = useDespesasStore((s) => s.expenses);
  const obligations = useDespesasStore((s) => s.obligations);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter((e) => {
      const ref = e.competence ?? e.dueDate;
      if (!ref) return false;
      const d = new Date(ref);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const total = thisMonth.reduce((s, e) => s + e.amount, 0);
    const pago = thisMonth.reduce((s, e) => s + (e.paidAmount ?? (e.status === "PAGO" ? e.amount : 0)), 0);
    const aberto = thisMonth.filter((e) => e.status === "ABERTO" || e.status === "AGENDADO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
    const atrasado = thisMonth.filter((e) => e.status === "ATRASADO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
    const folha = obligations.filter((o) => o.competence.slice(0, 7) === now.toISOString().slice(0, 7)).reduce((s, o) => s + o.baseSalary, 0);

    const byCategory = new Map<string, number>();
    thisMonth.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount));
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const upcoming = expenses
      .filter((e) => e.status !== "PAGO" && e.dueDate)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 6);

    return { total, pago, aberto, atrasado, folha, categories, upcoming };
  }, [expenses, obligations]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Total no mês</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.total)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Pago</p><p className="text-lg font-extrabold text-emerald-700">{brl(metrics.pago)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Em aberto</p><p className="text-lg font-extrabold text-gold-700">{brl(metrics.aberto)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Atrasado</p><p className="text-lg font-extrabold text-red-600">{brl(metrics.atrasado)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Folha do mês</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.folha)}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-forest-950">Top categorias no mês</p>
          {metrics.categories.length === 0 ? (
            <p className="text-sm text-ink-muted">Sem lançamentos no mês.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metrics.categories.map(([cat, value]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{cat}</span>
                  <span className="font-semibold text-ink-900">{brl(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-forest-950">Próximos vencimentos</p>
          {metrics.upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">Nada pendente.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metrics.upcoming.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{e.description}</span>
                  <span className="font-semibold text-ink-900">{brl(e.amount)} • {e.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SalariosTab() {
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const obligations = useDespesasStore((s) => s.obligations);
  const advances = useDespesasStore((s) => s.advances);
  const generateObligation = useDespesasStore((s) => s.generateObligation);
  const createAdvance = useDespesasStore((s) => s.createAdvance);
  const payAdvance = useDespesasStore((s) => s.payAdvance);
  const reverseAdvance = useDespesasStore((s) => s.reverseAdvance);
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({});
  const [expandedObligation, setExpandedObligation] = useState<string | null>(null);

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

  async function handlePayAdvance(id: string) {
    const err = await payAdvance(id);
    if (err) toast.error(err);
    else toast.success("Vale pago");
  }

  async function handleReverseAdvance(id: string) {
    const err = await reverseAdvance(id);
    if (err) toast.error(err);
    else toast.success("Vale estornado");
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
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {obligations.filter((o) => o.competence === competence).map((o) => {
              const obligationAdvances = advances.filter((a) => a.obligationId === o.id);
              const isExpanded = expandedObligation === o.id;
              return (
                <Fragment key={o.id}>
                  <tr className="border-b border-forest-950/5 last:border-none">
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
                    <td className="px-4 py-3">
                      {obligationAdvances.length > 0 && (
                        <button
                          onClick={() => setExpandedObligation(isExpanded ? null : o.id)}
                          className="text-xs font-semibold text-forest-800 hover:underline"
                        >
                          {isExpanded ? "Ocultar vales" : `Ver vales (${obligationAdvances.length})`}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-forest-950/5 bg-forest-950/5">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {obligationAdvances.map((a) => (
                            <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-xs">
                              <span className="font-semibold text-ink-900">{brl(a.amount)}</span>
                              <span className="text-ink-muted">{a.status === "SOLICITADO" ? "Solicitado" : a.status === "PAGO" ? "Pago" : "Estornado"}</span>
                              <div className="flex items-center gap-1">
                                {a.status === "SOLICITADO" && (
                                  <button onClick={() => void handlePayAdvance(a.id)} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 font-bold text-emerald-700 hover:bg-emerald-50">
                                    <CheckCircle2 size={12} /> Pagar
                                  </button>
                                )}
                                {a.status === "PAGO" && (
                                  <button onClick={() => void handleReverseAdvance(a.id)} className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 font-bold text-red-700 hover:bg-red-50">
                                    <RotateCcw size={12} /> Estornar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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
  const [tab, setTab] = useState<"visao" | "despesas" | "salarios">("visao");
  const [showForm, setShowForm] = useState(false);
  const [payModal, setPayModal] = useState<{ id: string; remaining: number } | null>(null);
  const [payValue, setPayValue] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openTotal = useMemo(() => expenses.filter((e) => e.status !== "PAGO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0), [expenses]);

  async function handlePaid() {
    if (!payModal) return;
    const value = Number(payValue);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setPaying(true);
    const err = await markExpensePaid(payModal.id, value);
    setPaying(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Pagamento registrado");
    setPayModal(null);
    setPayValue("");
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
          ["visao", "Visão Geral"],
          ["despesas", "Lançamentos"],
          ["salarios", "Salários e Vales"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as "visao" | "despesas" | "salarios")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visao" ? (
        <VisaoGeralTab />
      ) : tab === "despesas" ? (
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
                    <th className="px-4 py-3">Saldo</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => {
                    const remaining = e.amount - (e.paidAmount ?? 0);
                    return (
                      <tr key={e.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                        <td className="px-4 py-3 font-semibold text-ink-900">{e.description}</td>
                        <td className="px-4 py-3 text-ink-700/70">{e.nature}</td>
                        <td className="px-4 py-3 font-semibold text-ink-900">{brl(e.amount)}</td>
                        <td className="px-4 py-3 text-ink-700/70">{e.status === "PAGO" ? "-----" : brl(remaining)}</td>
                        <td className="px-4 py-3 text-ink-700/70">{e.dueDate ?? "-----"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[e.status]}`}>{e.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {e.status !== "PAGO" && (
                            <button
                              onClick={() => { setPayModal({ id: e.id, remaining }); setPayValue(String(remaining)); }}
                              aria-label="Registrar pagamento"
                              className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <SalariosTab />
      )}

      {payModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Registrar pagamento</h2>
            <p className="mb-3 text-sm text-ink-700/70">Saldo em aberto: {brl(payModal.remaining)}. Informe o valor pago (pagamento parcial mantém o saldo em aberto).</p>
            <label className="flex flex-col gap-1 text-sm text-ink-900">
              Valor pago
              <input type="number" value={payValue} onChange={(e) => setPayValue(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPayModal(null)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={paying} onClick={() => void handlePaid()}>{paying ? "Salvando..." : "Confirmar pagamento"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
