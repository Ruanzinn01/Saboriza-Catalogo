import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { subscribeToTables } from "@/lib/realtime";
import { Plus, CheckCircle2, RotateCcw } from "lucide-react";
import { useReceitasStore, type RevenueOrigin } from "@/store/receitas-store";
import { useCustomersStore } from "@/store/customers-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ORIGINS: RevenueOrigin[] = ["MANUAL", "OUTRO_MODULO"];

const STATUS_TONE: Record<string, string> = {
  ABERTO: "bg-gold-500/20 text-gold-700",
  RECEBIDO: "bg-emerald-100 text-emerald-800",
  VENCIDO: "bg-red-100 text-red-700",
  CANCELADO: "bg-ink-900/10 text-ink-muted",
};

function NewRevenueForm({ onDone }: { onDone: () => void }) {
  const createRevenue = useReceitasStore((s) => s.createRevenue);
  const customers = useCustomersStore((s) => s.customers);
  const fetchCustomers = useCustomersStore((s) => s.fetchCustomers);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Geral");
  const [origin, setOrigin] = useState<RevenueOrigin>("MANUAL");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [payerOriginId, setPayerOriginId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customers.length === 0) fetchCustomers();
  }, [customers.length, fetchCustomers]);

  async function submit() {
    if (!description || !amount) {
      toast.error("Preencha descrição e valor");
      return;
    }
    setSaving(true);
    const err = await createRevenue({
      description,
      category,
      origin,
      amount: Number(amount),
      dueDate: dueDate || undefined,
      payerOriginId: payerOriginId || undefined,
      installments: Number(installments) || 1,
    });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Receita lançada");
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
          Origem
          <select value={origin} onChange={(e) => setOrigin(e.target.value as RevenueOrigin)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            {ORIGINS.map((o) => (
              <option key={o} value={o}>{o}</option>
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
          Pagador (opcional)
          <select value={payerOriginId} onChange={(e) => setPayerOriginId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">-----</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Parcelas
          <input type="number" min={1} value={installments} onChange={(e) => setInstallments(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          <span className="text-xs text-ink-muted">Divide o valor em parcelas mensais a partir do vencimento informado.</span>
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Lançar receita"}
      </Button>
    </div>
  );
}

function VisaoGeralTab() {
  const revenues = useReceitasStore((s) => s.revenues);

  const metrics = useMemo(() => {
    const now = new Date();
    const thisMonth = revenues.filter((r) => r.dueDate && new Date(r.dueDate).getMonth() === now.getMonth() && new Date(r.dueDate).getFullYear() === now.getFullYear());
    const total = thisMonth.reduce((s, r) => s + r.amount, 0);
    const recebido = thisMonth.reduce((s, r) => s + (r.amount - r.openBalance), 0);
    const aReceber = revenues.filter((r) => r.status === "ABERTO" || r.status === "VENCIDO").reduce((s, r) => s + r.openBalance, 0);

    const byCategory = new Map<string, number>();
    thisMonth.forEach((r) => byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + r.amount));
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const upcoming = revenues
      .filter((r) => r.status !== "RECEBIDO" && r.status !== "CANCELADO" && r.dueDate)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 6);

    return { total, recebido, aReceber, categories, upcoming };
  }, [revenues]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Total no mês</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.total)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Recebido no mês</p><p className="text-lg font-extrabold text-emerald-700">{brl(metrics.recebido)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">A receber (total)</p><p className="text-lg font-extrabold text-gold-700">{brl(metrics.aReceber)}</p></div>
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
          <p className="mb-3 text-sm font-bold text-forest-950">Próximos recebimentos</p>
          {metrics.upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">Nada pendente.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {metrics.upcoming.map((r) => (
                <div key={r.receivableId} className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">{r.description} {r.totalInstallments > 1 ? `(${r.installmentNumber}/${r.totalInstallments})` : ""}</span>
                  <span className="font-semibold text-ink-900">{brl(r.openBalance)} • {r.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReceitasPage() {
  const revenues = useReceitasStore((s) => s.revenues);
  const receipts = useReceitasStore((s) => s.receipts);
  const status = useReceitasStore((s) => s.status);
  const fetchAll = useReceitasStore((s) => s.fetchAll);
  const markReceived = useReceitasStore((s) => s.markReceived);
  const reverseReceipt = useReceitasStore((s) => s.reverseReceipt);
  const [tab, setTab] = useState<"visao" | "lista">("visao");
  const [showForm, setShowForm] = useState(false);
  const [receiveModal, setReceiveModal] = useState<{ receivableId: string; openBalance: number } | null>(null);
  const [receiveValue, setReceiveValue] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [expandedReceivable, setExpandedReceivable] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    return subscribeToTables("receitas", ["revenues", "revenue_receipts", "revenue_receivables", "receivables"], () => fetchAll());
  }, [fetchAll]);

  const openTotal = useMemo(() => revenues.filter((r) => r.status === "ABERTO" || r.status === "VENCIDO").reduce((s, r) => s + r.openBalance, 0), [revenues]);

  async function handleReceive() {
    if (!receiveModal) return;
    const value = Number(receiveValue);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setReceiving(true);
    const err = await markReceived(receiveModal.receivableId, value);
    setReceiving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Recebimento registrado");
    setReceiveModal(null);
    setReceiveValue("");
  }

  async function handleReverse(receiptId: string) {
    const err = await reverseReceipt(receiptId);
    if (err) toast.error(err);
    else toast.success("Recebimento estornado");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Receitas</h1>
          <p className="text-sm text-ink-muted">Lançamentos avulsos de entrada de caixa fora do fluxo de pedidos.</p>
        </div>
        {tab === "lista" && (
          <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
            <Plus size={18} /> Nova receita
          </Button>
        )}
      </div>

      <div className="flex gap-2 rounded-xl bg-forest-950/5 p-1 w-fit">
        {[
          ["visao", "Visão Geral"],
          ["lista", "Lista"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as "visao" | "lista")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visao" ? (
        <VisaoGeralTab />
      ) : (
        <>
          {showForm && <NewRevenueForm onDone={() => setShowForm(false)} />}

          <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
            <p className="text-xs text-ink-muted">Total em aberto</p>
            <p className="text-xl font-extrabold text-emerald-700">{brl(openTotal)}</p>
          </div>

          {status === "loading" && revenues.length === 0 ? (
            <AdminState variant="loading" message="Carregando receitas..." />
          ) : status === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar as receitas." />
          ) : revenues.length === 0 ? (
            <AdminState variant="empty" message="Nenhuma receita lançada ainda." />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Pagador</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Saldo</th>
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {revenues.map((r) => {
                    const receiptsForReceivable = receipts.filter((rc) => rc.receivableId === r.receivableId && rc.receivedAmount > 0);
                    const isExpanded = expandedReceivable === r.receivableId;
                    return (
                      <Fragment key={r.receivableId}>
                        <tr className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                          <td className="px-4 py-3 font-semibold text-ink-900">
                            {r.description} {r.totalInstallments > 1 && <span className="text-xs font-normal text-ink-muted">({r.installmentNumber}/{r.totalInstallments})</span>}
                          </td>
                          <td className="px-4 py-3 text-ink-700/70">
                            {r.payerId ? (
                              <Link to={`/admin/clientes/${r.payerId}`} className="hover:underline">
                                {r.payerName ?? "-----"}
                              </Link>
                            ) : (
                              r.payerName ?? "-----"
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-ink-900">{brl(r.amount)}</td>
                          <td className="px-4 py-3 text-ink-700/70">{r.status === "RECEBIDO" ? "-----" : brl(r.openBalance)}</td>
                          <td className="px-4 py-3 text-ink-700/70">{r.dueDate ?? "-----"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {r.status !== "RECEBIDO" && r.status !== "CANCELADO" && (
                                <button
                                  onClick={() => { setReceiveModal({ receivableId: r.receivableId, openBalance: r.openBalance }); setReceiveValue(String(r.openBalance)); }}
                                  aria-label="Registrar recebimento"
                                  className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              )}
                              {receiptsForReceivable.length > 0 && (
                                <button
                                  onClick={() => setExpandedReceivable(isExpanded ? null : r.receivableId)}
                                  className="text-xs font-semibold text-forest-800 hover:underline"
                                >
                                  {isExpanded ? "Ocultar" : "Recebimentos"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-forest-950/5 bg-forest-950/5">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                {receiptsForReceivable.map((rc) => (
                                  <div key={rc.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-xs">
                                    <span className="font-semibold text-ink-900">{brl(rc.receivedAmount)}</span>
                                    <span className="text-ink-muted">{new Date(rc.effectiveDate).toLocaleDateString("pt-BR")}</span>
                                    <button onClick={() => void handleReverse(rc.id)} className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 font-bold text-red-700 hover:bg-red-50">
                                      <RotateCcw size={12} /> Estornar
                                    </button>
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
          )}
        </>
      )}

      {receiveModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Registrar recebimento</h2>
            <p className="mb-3 text-sm text-ink-700/70">Saldo em aberto: {brl(receiveModal.openBalance)}. Recebimento parcial mantém o saldo restante em aberto.</p>
            <label className="flex flex-col gap-1 text-sm text-ink-900">
              Valor recebido
              <input type="number" value={receiveValue} onChange={(e) => setReceiveValue(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setReceiveModal(null)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={receiving} onClick={() => void handleReceive()}>{receiving ? "Salvando..." : "Confirmar recebimento"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
