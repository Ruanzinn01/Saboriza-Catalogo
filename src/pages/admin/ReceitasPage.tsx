import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2 } from "lucide-react";
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
    const err = await createRevenue({ description, category, origin, amount: Number(amount), dueDate: dueDate || undefined, payerOriginId: payerOriginId || undefined });
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
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Lançar receita"}
      </Button>
    </div>
  );
}

export function ReceitasPage() {
  const revenues = useReceitasStore((s) => s.revenues);
  const status = useReceitasStore((s) => s.status);
  const fetchAll = useReceitasStore((s) => s.fetchAll);
  const markReceived = useReceitasStore((s) => s.markReceived);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openTotal = useMemo(() => revenues.filter((r) => r.status === "ABERTO" || r.status === "VENCIDO").reduce((s, r) => s + r.amount, 0), [revenues]);

  async function handleReceived(receivableId: string, amount: number) {
    const err = await markReceived(receivableId, amount);
    if (err) toast.error(err);
    else toast.success("Receita marcada como recebida");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Receitas</h1>
          <p className="text-sm text-ink-muted">Lançamentos avulsos de entrada de caixa fora do fluxo de pedidos.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus size={18} /> Nova receita
        </Button>
      </div>

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
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {revenues.map((r) => (
                <tr key={r.receivableId} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3 font-semibold text-ink-900">{r.description}</td>
                  <td className="px-4 py-3 text-ink-700/70">{r.payerName ?? "-----"}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{brl(r.amount)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{r.dueDate ?? "-----"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status !== "RECEBIDO" && r.status !== "CANCELADO" && (
                      <button
                        onClick={() => void handleReceived(r.receivableId, r.amount)}
                        aria-label="Marcar como recebida"
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
    </div>
  );
}
