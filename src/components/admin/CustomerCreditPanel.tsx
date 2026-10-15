import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { rpcUntyped } from "@/lib/supabase-rpc";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import type { CreditSnapshot } from "@/store/faturar-store";

const BLOCKER_LABEL = { OVERDUE: "Títulos vencidos", OVER_LIMIT: "Limite excedido" } as const;

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-xl border border-forest-950/10 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`text-lg font-extrabold ${tone === "bad" ? "text-red-700" : "text-forest-950"}`}>{value}</p>
    </div>
  );
}

export function CustomerCreditPanel({ customerId }: { customerId: string }) {
  const [overview, setOverview] = useState<CreditSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [editing, setEditing] = useState(false);
  const [newLimit, setNewLimit] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await rpcUntyped("oris360_credit_overview", { p_customer_id: customerId });
    if (error || !data) {
      setOverview(null);
      setState("unavailable");
      return;
    }
    setOverview(data as CreditSnapshot);
    setState("ready");
  }, [customerId]);

  useEffect(() => {
    setState("loading");
    void load();
  }, [load]);

  const save = async () => {
    const value = Number(newLimit.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Informe um limite válido");
      return;
    }
    setSaving(true);
    const { error } = await rpcUntyped("oris360_set_credit_limit", {
      p_customer_id: customerId,
      p_new_limit: value,
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Limite atualizado");
    setEditing(false);
    setNewLimit("");
    setReason("");
    await load();
  };

  if (state === "loading") return <p className="text-sm text-ink-muted">Consultando crédito...</p>;
  if (state === "unavailable" || !overview) {
    return (
      <div className="rounded-2xl border border-forest-950/10 bg-white p-4 text-sm text-ink-muted">
        Consulta de crédito indisponível ou sem permissão. Isso não equivale a crédito aprovado.
      </div>
    );
  }

  const blockers = overview.blockers ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-forest-950">Crédito</h2>
        <Button variant="outline" onClick={() => { setNewLimit(String(overview.credit_limit)); setEditing(true); }}>
          Gerir limite
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Limite aprovado" value={formatCurrency(overview.credit_limit)} />
        <Metric label="Dívida em aberto" value={formatCurrency(overview.open_receivables)} />
        <Metric label="Compromissos de pedidos" value={formatCurrency(overview.commitments)} />
        <Metric label="Exposição atual" value={formatCurrency(overview.current_exposure)} />
        <Metric
          label={(overview.current_excess ?? 0) > 0 ? "Excesso sobre o limite" : "Limite disponível"}
          value={formatCurrency((overview.current_excess ?? 0) > 0 ? overview.current_excess ?? 0 : overview.available ?? 0)}
          tone={(overview.current_excess ?? 0) > 0 ? "bad" : undefined}
        />
        <Metric
          label="Vencido (já na dívida)"
          value={`${formatCurrency(overview.overdue_amount)} · ${overview.overdue_count} título(s)`}
          tone={overview.overdue_amount > 0 ? "bad" : undefined}
        />
        <Metric label="Maior atraso" value={`${overview.max_overdue_days ?? 0} dia(s)`} />
        <Metric label="Situação" value={blockers.length ? blockers.map((b) => BLOCKER_LABEL[b]).join(" + ") : "Regular"} tone={blockers.length ? "bad" : undefined} />
      </div>
      {!overview.has_policy && (
        <p className="text-xs text-ink-muted">Cliente sem política de crédito cadastrada: limite 0 e pedidos não reservam crédito.</p>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="mb-1 text-lg font-extrabold text-forest-950">Alterar limite permanente</h3>
            <p className="mb-3 text-sm text-ink-700/70">Limite atual: {formatCurrency(overview.credit_limit)}. A alteração fica registrada com usuário, data, valores e motivo.</p>
            <input
              inputMode="decimal"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              aria-label="Novo limite"
              className="w-full rounded-xl border border-ink-900/15 p-3 text-sm"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da alteração"
              className="mt-3 w-full rounded-xl border border-ink-900/15 p-3 text-sm"
              rows={3}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={saving || reason.trim().length < 5 || newLimit.trim() === ""} onClick={() => void save()}>
                Salvar limite
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
