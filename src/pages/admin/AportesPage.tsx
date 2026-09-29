import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, XCircle, CheckCircle2 } from "lucide-react";
import { useAportesStore, type ContributionOrigin } from "@/store/aportes-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ORIGINS: ContributionOrigin[] = ["TRANSFERENCIA", "PIX", "DEPOSITO", "DINHEIRO", "PAGAMENTO_DIRETO_DESPESA", "OUTRO"];

const STATUS_LABELS: Record<string, string> = {
  PLANEJADO: "Planejado",
  A_CONFIRMAR: "A confirmar",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};
const STATUS_TONE: Record<string, string> = {
  PLANEJADO: "bg-gold-500/20 text-gold-700",
  A_CONFIRMAR: "bg-amber-100 text-amber-800",
  REALIZADO: "bg-emerald-100 text-emerald-800",
  CANCELADO: "bg-ink-900/10 text-ink-muted",
  ESTORNADO: "bg-red-100 text-red-700",
};

function NewContributionForm({ onDone }: { onDone: () => void }) {
  const partners = useAportesStore((s) => s.partners);
  const createPartner = useAportesStore((s) => s.createPartner);
  const createContribution = useAportesStore((s) => s.createContribution);

  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? "");
  const [newPartnerName, setNewPartnerName] = useState("");
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState<ContributionOrigin>("PIX");
  const [isPlanned, setIsPlanned] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    let finalPartnerId = partnerId;
    if (!finalPartnerId && newPartnerName.trim()) {
      setSaving(true);
      const err = await createPartner(newPartnerName.trim());
      setSaving(false);
      if (err) {
        toast.error(err);
        return;
      }
      finalPartnerId = useAportesStore.getState().partners.find((p) => p.name === newPartnerName.trim())?.id ?? "";
    }
    if (!finalPartnerId || !amount) {
      toast.error("Escolha o sócio e informe o valor");
      return;
    }

    setSaving(true);
    const err = await createContribution({
      partnerId: finalPartnerId,
      amount: Number(amount),
      status: isPlanned ? "PLANEJADO" : "REALIZADO",
      origin,
      plannedDate: isPlanned ? date : undefined,
      realizedDate: isPlanned ? undefined : date,
    });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Aporte registrado");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Sócio
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">+ Novo sócio</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        {!partnerId && (
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Nome do novo sócio
            <input value={newPartnerName} onChange={(e) => setNewPartnerName(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Valor
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Origem
          <select value={origin} onChange={(e) => setOrigin(e.target.value as ContributionOrigin)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            {ORIGINS.map((o) => (
              <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-900">
          <input type="checkbox" checked={isPlanned} onChange={(e) => setIsPlanned(e.target.checked)} />
          Aporte planejado (ainda não ocorreu)
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          {isPlanned ? "Data prevista" : "Data realizada"}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Registrar aporte"}
      </Button>
    </div>
  );
}

export function AportesPage() {
  const contributions = useAportesStore((s) => s.contributions);
  const status = useAportesStore((s) => s.status);
  const fetchAll = useAportesStore((s) => s.fetchAll);
  const realizePlanned = useAportesStore((s) => s.realizePlanned);
  const cancelContribution = useAportesStore((s) => s.cancelContribution);
  const reverseContribution = useAportesStore((s) => s.reverseContribution);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const metrics = useMemo(() => {
    const now = new Date();
    const realized = contributions.filter((c) => c.status === "REALIZADO");
    const thisMonth = realized.filter((c) => c.realizedDate && new Date(c.realizedDate).getMonth() === now.getMonth() && new Date(c.realizedDate).getFullYear() === now.getFullYear());
    const thisYear = realized.filter((c) => c.realizedDate && new Date(c.realizedDate).getFullYear() === now.getFullYear());
    const partnersSet = new Set(realized.map((c) => c.partnerId));
    const planned = contributions.filter((c) => c.status === "PLANEJADO");
    return {
      month: thisMonth.reduce((s, c) => s + c.amount, 0),
      year: thisYear.reduce((s, c) => s + c.amount, 0),
      partners: partnersSet.size,
      maxContribution: realized.reduce((max, c) => Math.max(max, c.amount), 0),
      planned: planned.reduce((s, c) => s + c.amount, 0),
    };
  }, [contributions]);

  async function handleAction(action: (id: string) => Promise<string | null>, id: string, successMsg: string) {
    const err = await action(id);
    if (err) toast.error(err);
    else toast.success(successMsg);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Aportes de Sócios</h1>
          <p className="text-sm text-ink-muted">Aportes não são receita operacional — entram nas Entradas sem dupla soma.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
          <Plus size={18} /> Novo aporte
        </Button>
      </div>

      {showForm && <NewContributionForm onDone={() => setShowForm(false)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">No mês</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.month)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">No ano</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.year)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Sócios aportantes</p><p className="text-lg font-extrabold text-forest-950">{metrics.partners}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Maior aporte</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.maxContribution)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Planejados</p><p className="text-lg font-extrabold text-gold-700">{brl(metrics.planned)}</p></div>
      </div>

      {status === "loading" && contributions.length === 0 ? (
        <AdminState variant="loading" message="Carregando aportes..." />
      ) : status === "error" ? (
        <AdminState variant="error" message="Não foi possível carregar os aportes." />
      ) : contributions.length === 0 ? (
        <AdminState variant="empty" message="Nenhum aporte registrado ainda." />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Sócio</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id} className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                  <td className="px-4 py-3 font-semibold text-ink-900">{c.partnerName}</td>
                  <td className="px-4 py-3 text-ink-700/70">{c.origin.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{brl(c.amount)}</td>
                  <td className="px-4 py-3 text-ink-700/70">{c.realizedDate ?? c.plannedDate ?? "-----"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "PLANEJADO" && (
                        <button
                          onClick={() => void handleAction((id) => realizePlanned(id, new Date().toISOString().slice(0, 10)), c.id, "Aporte realizado")}
                          aria-label="Marcar como realizado"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-50"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      {(c.status === "PLANEJADO" || c.status === "A_CONFIRMAR") && (
                        <button
                          onClick={() => void handleAction(cancelContribution, c.id, "Aporte cancelado")}
                          aria-label="Cancelar"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                      {c.status === "REALIZADO" && (
                        <button
                          onClick={() => void handleAction(reverseContribution, c.id, "Aporte estornado")}
                          aria-label="Estornar"
                          className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
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
