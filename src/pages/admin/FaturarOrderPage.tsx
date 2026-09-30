import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useFaturarStore, generatesCredit, type PaymentType } from "@/store/faturar-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAYMENT_TYPES: PaymentType[] = ["BOLETO", "PIX", "DINHEIRO", "CARTAO", "TRANSFERENCIA", "OUTROS"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-forest-950/10 bg-white">
      <h2 className="border-b border-forest-950/10 px-5 py-4 text-base font-extrabold text-forest-950">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CreditMetric({ label, value, tone }: { label: string; value: string; tone?: "bad" | "ok" }) {
  return (
    <div className="rounded-xl border border-forest-950/10 bg-white p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`text-sm font-bold ${tone === "bad" ? "text-red-600" : tone === "ok" ? "text-emerald-700" : "text-ink-900"}`}>
        {value}
      </p>
    </div>
  );
}

export function FaturarOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const order = useFaturarStore((s) => s.currentOrder);
  const orderStatus = useFaturarStore((s) => s.orderStatus);
  const fetchOrder = useFaturarStore((s) => s.fetchOrder);
  const paymentMethods = useFaturarStore((s) => s.paymentMethods);
  const addPaymentMethod = useFaturarStore((s) => s.addPaymentMethod);
  const removePaymentMethod = useFaturarStore((s) => s.removePaymentMethod);
  const updatePaymentMethod = useFaturarStore((s) => s.updatePaymentMethod);
  const fiscalChoice = useFaturarStore((s) => s.fiscalChoice);
  const setFiscalChoice = useFaturarStore((s) => s.setFiscalChoice);
  const noFiscalReason = useFaturarStore((s) => s.noFiscalReason);
  const setNoFiscalReason = useFaturarStore((s) => s.setNoFiscalReason);
  const creditSnapshot = useFaturarStore((s) => s.creditSnapshot);
  const creditReleased = useFaturarStore((s) => s.creditReleased);
  const authorizeException = useFaturarStore((s) => s.authorizeException);
  const isConfirming = useFaturarStore((s) => s.isConfirming);
  const confirmBilling = useFaturarStore((s) => s.confirmBilling);
  const reset = useFaturarStore((s) => s.reset);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showRelease, setShowRelease] = useState(false);
  const [releaseInput, setReleaseInput] = useState("");
  const [billingDone, setBillingDone] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) fetchOrder(orderId);
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const paidSum = paymentMethods.reduce((s, p) => s + p.amount, 0);
  const total = order?.total ?? 0;
  const paymentsOk = Math.abs(paidSum - total) < 0.01;
  const fiscalOk = fiscalChoice === "EMITIR_NFE" || noFiscalReason.trim().length >= 5;
  const hasOverdue = (creditSnapshot?.overdue_amount ?? 0) > 0;
  const overLimit = (creditSnapshot?.available_after ?? 0) < 0;
  const creditOk = (!hasOverdue && !overLimit) || creditReleased;
  const allOk = paymentsOk && fiscalOk && creditOk && paymentMethods.length > 0;

  const checks = useMemo(
    () => [
      { label: "Cliente identificado", ok: true },
      { label: "Produtos e separação conferidos", ok: true },
      { label: "Pagamento válido e soma exata", ok: paymentsOk },
      { label: "Situação fiscal definida", ok: fiscalOk },
      { label: "Financeiro/crédito liberado", ok: creditOk },
    ],
    [paymentsOk, fiscalOk, creditOk]
  );

  async function handleConfirm() {
    const { billingId, error } = await confirmBilling();
    if (error || !billingId) {
      toast.error(error ?? "Não foi possível confirmar o faturamento");
      return;
    }
    setShowConfirm(false);
    setBillingDone(billingId);
  }

  if (orderStatus === "loading" || orderStatus === "idle") return <AdminState variant="loading" message="Carregando pedido..." />;
  if (orderStatus === "error" || !order) return <AdminState variant="error" message="Não foi possível carregar este pedido." />;

  if (billingDone) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-forest-950/10 bg-white p-10 text-center">
        <CheckCircle2 className="text-emerald-600" size={56} />
        <h1 className="text-2xl font-extrabold text-forest-950">Pedido faturado com sucesso</h1>
        <p className="text-ink-700/70">Pedido #{order.number} — {brl(total)}</p>
        <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Financeiro criado ✓</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            {fiscalChoice === "EMITIR_NFE" ? "NF-e em processamento ✓" : "Sem NF-e nesta operação ✓"}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">Liberado para Entrega Registra ✓</span>
        </div>
        <Button onClick={() => navigate("/admin/faturar")}>Voltar à lista</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin/faturar")} className="flex items-center gap-1 text-sm text-ink-muted hover:text-forest-950">
          <ArrowLeft size={14} /> Voltar
        </button>
        <button onClick={() => navigate(`/admin/pedidos/${orderId}`)} className="text-sm text-ink-muted hover:text-forest-950">
          Ver pedido original
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-forest-950">Faturar Pedido #{order.number}</h1>
        <span className="rounded-full bg-gold-500/20 px-3 py-1 text-xs font-bold text-gold-700">Aguardando faturamento</span>
      </div>

      <Card title="1. Resumo do Pedido">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><p className="text-xs text-ink-muted">Cliente</p><p className="font-semibold text-ink-900">{order.customer.company || order.customer.name}</p></div>
          <div><p className="text-xs text-ink-muted">CNPJ</p><p className="font-semibold text-ink-900">{order.customer.cnpj || "-----"}</p></div>
          <div><p className="text-xs text-ink-muted">Endereço de entrega</p><p className="font-semibold text-ink-900">{order.customer.address || "-----"}</p></div>
        </div>

        <div className="mt-5 rounded-2xl border border-forest-950/10">
          <div className="border-b border-forest-950/10 px-4 py-3">
            <p className="font-bold text-forest-950">Situação financeira e crédito</p>
            <p className="text-xs text-ink-muted">Análise automática antes do faturamento</p>
          </div>
          {creditSnapshot ? (
            <>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                <CreditMetric
                  label="Situação financeira"
                  value={hasOverdue || overLimit ? "Requer análise" : "Regular"}
                  tone={hasOverdue || overLimit ? "bad" : "ok"}
                />
                <CreditMetric label="Em aberto" value={brl(creditSnapshot.open_receivables)} />
                <CreditMetric label="Vencido" value={`${brl(creditSnapshot.overdue_amount)} • ${creditSnapshot.overdue_count} títulos`} tone={hasOverdue ? "bad" : undefined} />
                <CreditMetric label="Limite cadastrado" value={brl(creditSnapshot.credit_limit)} />
                <CreditMetric label="Compromissos" value={brl(creditSnapshot.commitments)} />
                <CreditMetric label="Exposição atual" value={brl(creditSnapshot.current_exposure)} />
                <CreditMetric label="Parte financiada" value={brl(creditSnapshot.financed_part)} />
                <CreditMetric label="Disponível após faturar" value={brl(creditSnapshot.available_after)} tone={overLimit ? "bad" : "ok"} />
              </div>
              {!creditOk && (
                <div className="mx-4 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <p>
                    <b>Faturamento requer liberação:</b>{" "}
                    {[hasOverdue && `cliente possui ${brl(creditSnapshot.overdue_amount)} em títulos vencidos`, overLimit && `excede o limite disponível em ${brl(Math.abs(creditSnapshot.available_after))}`]
                      .filter(Boolean)
                      .join(" e ")}
                    .
                  </p>
                  <button onClick={() => setShowRelease(true)} className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">
                    Liberar este faturamento
                  </button>
                </div>
              )}
              {creditOk && creditReleased && (
                <div className="mx-4 mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  ✓ Faturamento liberado excepcionalmente.
                </div>
              )}
            </>
          ) : (
            <p className="p-4 text-sm text-ink-muted">Calculando análise de crédito...</p>
          )}
        </div>

        <table className="mt-5 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-muted">
            <tr><th className="py-2">Produto</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Total</th></tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-t border-forest-950/5">
                <td className="py-2">{item.name}</td>
                <td className="py-2 text-right">{item.packs}</td>
                <td className="py-2 text-right">{brl(item.unitPrice * item.packs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-3 w-full max-w-xs border-t border-forest-950/10 pt-3 text-right">
          <p className="text-lg font-extrabold text-forest-950">Total a faturar: {brl(total)}</p>
        </div>
      </Card>

      <Card title="2. Pagamento e Parcelas">
        <div className="flex flex-col gap-4">
          {paymentMethods.map((pm, idx) => (
            <div key={pm.id} className="rounded-2xl border border-forest-950/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-forest-950">Pagamento {idx + 1}</p>
                {paymentMethods.length > 1 && (
                  <button onClick={() => removePaymentMethod(pm.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Forma
                  <select
                    value={pm.type}
                    onChange={(e) => updatePaymentMethod(pm.id, { type: e.target.value as PaymentType })}
                    className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm"
                  >
                    {PAYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Condição
                  <select
                    value={pm.mode}
                    onChange={(e) => updatePaymentMethod(pm.id, { mode: e.target.value as "cash" | "term" })}
                    className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm"
                  >
                    <option value="cash">À vista</option>
                    <option value="term">A prazo</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-muted">
                  Valor
                  <input
                    type="number"
                    value={pm.amount}
                    onChange={(e) => updatePaymentMethod(pm.id, { amount: Number(e.target.value) })}
                    className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm"
                  />
                </label>
                {pm.mode === "term" && (
                  <label className="flex flex-col gap-1 text-xs text-ink-muted">
                    Vencimentos (dias)
                    <input
                      value={pm.daysText}
                      onChange={(e) => updatePaymentMethod(pm.id, { daysText: e.target.value })}
                      placeholder="28,35,42"
                      className="h-10 rounded-lg border border-ink-900/15 px-2 text-sm"
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {generatesCredit(pm.type, pm.mode) ? "Gera exposição de crédito." : "Não gera exposição de crédito."}
              </p>
            </div>
          ))}
          <button onClick={addPaymentMethod} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-forest-950/20 py-3 text-sm font-semibold text-forest-800 hover:bg-forest-950/5">
            <Plus size={16} /> Adicionar forma de pagamento
          </button>
          <div className={`rounded-xl p-3 text-sm ${paymentsOk ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {paymentsOk ? "✓ Pagamentos conferem com o total do pedido." : `Pagamentos somam ${brl(paidSum)}. Diferença de ${brl(Math.abs(total - paidSum))}.`}
          </div>
        </div>
      </Card>

      <Card title="3. Documento Fiscal">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setFiscalChoice("EMITIR_NFE")}
            className={`flex-1 rounded-xl border p-4 text-left ${fiscalChoice === "EMITIR_NFE" ? "border-forest-700 bg-forest-950/5" : "border-forest-950/10"}`}
          >
            <p className="font-bold text-forest-950">Emitir documento fiscal (NF-e)</p>
            <p className="text-xs text-ink-muted">Motor fiscal real será integrado numa fase posterior.</p>
          </button>
          <button
            onClick={() => setFiscalChoice("SEM_DOCUMENTO_FISCAL")}
            className={`flex-1 rounded-xl border p-4 text-left ${fiscalChoice === "SEM_DOCUMENTO_FISCAL" ? "border-forest-700 bg-forest-950/5" : "border-forest-950/10"}`}
          >
            <p className="font-bold text-forest-950">Não emitir documento fiscal</p>
            <p className="text-xs text-ink-muted">Exige justificativa. Financeiro continua normal.</p>
          </button>
        </div>
        {fiscalChoice === "SEM_DOCUMENTO_FISCAL" && (
          <textarea
            value={noFiscalReason}
            onChange={(e) => setNoFiscalReason(e.target.value)}
            placeholder="Justificativa para não emitir documento fiscal"
            className="mt-3 w-full rounded-xl border border-ink-900/15 p-3 text-sm"
            rows={3}
          />
        )}
      </Card>

      <Card title="4. Conferência e Confirmação">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.label} className={`rounded-lg px-3 py-2 text-sm font-semibold ${c.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              {c.ok ? "✓" : "✕"} {c.label}
            </div>
          ))}
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-forest-950/10 bg-white px-6 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:left-64">
        <div>
          <p className="text-xs text-ink-muted">Total do pedido</p>
          <p className="text-lg font-extrabold text-forest-950">{brl(total)}</p>
        </div>
        <Button disabled={!allOk} onClick={() => setShowConfirm(true)}>Confirmar e Faturar</Button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Confirmar faturamento?</h2>
            <p className="text-sm text-ink-700/70">
              Pedido #{order.number} — {brl(total)}. Esta ação cria as contas a receber e libera o pedido para Entrega Registra.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={isConfirming} onClick={() => void handleConfirm()}>
                {isConfirming ? "Confirmando..." : "Confirmar faturamento"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRelease && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Liberar faturamento excepcionalmente</h2>
            <p className="text-sm text-ink-700/70">
              Esta liberação vale somente para este faturamento. Não altera o limite permanente nem remove vencidos.
            </p>
            <textarea
              value={releaseInput}
              onChange={(e) => setReleaseInput(e.target.value)}
              placeholder="Motivo da liberação"
              className="mt-3 w-full rounded-xl border border-ink-900/15 p-3 text-sm"
              rows={3}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowRelease(false)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button
                disabled={releaseInput.trim().length < 5}
                onClick={() => {
                  authorizeException(releaseInput.trim());
                  setShowRelease(false);
                  setReleaseInput("");
                }}
              >
                Autorizar este faturamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
