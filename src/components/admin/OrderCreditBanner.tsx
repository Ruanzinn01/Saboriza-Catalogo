import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { rpcUntyped } from "@/lib/supabase-rpc";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import type { CreditSnapshot } from "@/store/faturar-store";

const BLOCKER_LABEL = { OVERDUE: "títulos vencidos", OVER_LIMIT: "limite excedido" } as const;

interface Props {
  orderId: string;
  customerId: string;
  total: number;
  status: string;
}

export function OrderCreditBanner({ orderId, customerId, total, status }: Props) {
  const [overview, setOverview] = useState<CreditSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await rpcUntyped("oris360_credit_overview", {
      p_customer_id: customerId,
      p_order_id: orderId,
      p_financed_part: total,
    });
    if (error || !data) {
      setOverview(null);
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    setOverview(data as CreditSnapshot);
  }, [customerId, orderId, total]);

  useEffect(() => {
    void load();
  }, [load, status]);

  const request = async () => {
    setSending(true);
    const { error } = await rpcUntyped("oris360_credit_request_release", { p_order_id: orderId, p_reason: reason.trim() });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Liberação solicitada ao responsável");
    setAsking(false);
    setReason("");
    await load();
  };

  if (unavailable) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Consulta de crédito indisponível. O pedido não deve ser tratado como liberado.
      </div>
    );
  }
  if (!overview) return null;

  const blockers = overview.blockers ?? [];
  const uncovered = overview.uncovered ?? blockers;
  const pending = Boolean((overview as unknown as { authorization_pending?: boolean }).authorization_pending);

  if (blockers.length === 0) {
    return (
      <div className="rounded-2xl border border-forest-950/10 bg-white p-4 text-sm text-ink-700">
        Crédito regular. Disponível após este pedido: <strong>{formatCurrency(overview.available_after)}</strong> de {formatCurrency(overview.credit_limit)}.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p>
        <strong>Impedimento de crédito:</strong> {blockers.map((b) => BLOCKER_LABEL[b]).join(" e ")}.
        {overview.overdue_amount > 0 && ` Vencido: ${formatCurrency(overview.overdue_amount)} (maior atraso ${overview.max_overdue_days ?? 0} dia(s)).`}
        {overview.excess > 0 && ` Excesso projetado: ${formatCurrency(overview.excess)}.`}
      </p>
      {uncovered.length === 0 ? (
        <p>Liberação excepcional vigente para este pedido.</p>
      ) : pending ? (
        <p>Liberação solicitada, aguardando o responsável. O pedido não está liberado.</p>
      ) : (
        <div>
          <Button variant="outline" onClick={() => setAsking(true)}>
            Solicitar liberação
          </Button>
        </div>
      )}

      {asking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-ink-900">
            <h3 className="mb-2 text-lg font-extrabold text-forest-950">Solicitar liberação de crédito</h3>
            <p className="text-sm text-ink-700/70">A liberação vale só para este pedido e não altera o limite nem remove vencidos.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Justificativa"
              className="mt-3 w-full rounded-xl border border-ink-900/15 p-3 text-sm"
              rows={3}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAsking(false)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={sending || reason.trim().length < 5} onClick={() => void request()}>
                Enviar solicitação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
