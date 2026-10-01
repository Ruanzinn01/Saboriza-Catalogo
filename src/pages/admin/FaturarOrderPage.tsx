import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Plus, Printer, Settings2, Trash2 } from "lucide-react";
import { useFaturarStore, generatesCredit, type PaymentType } from "@/store/faturar-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAYMENT_TYPES: PaymentType[] = ["BOLETO", "PIX", "DINHEIRO", "CARTAO", "TRANSFERENCIA", "OUTROS"];
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

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
  const updateInstallment = useFaturarStore((s) => s.updateInstallment);
  const chargeSettings = useFaturarStore((s) => s.chargeSettings);
  const setChargeSettings = useFaturarStore((s) => s.setChargeSettings);
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
  const [showChargeSettings, setShowChargeSettings] = useState(false);
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

  function printDocument(title: string, bodyHtml: string) {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>` +
        `<style>body{font-family:Arial,sans-serif;padding:24px;color:#172231}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}` +
        `td,th{border-bottom:1px solid #dce3ea;padding:8px;text-align:left}td.num,th.num{text-align:right}</style></head>` +
        `<body>${bodyHtml}<script>window.onload=()=>window.print()<\/script></body></html>`
    );
    win.document.close();
  }

  function printOrderDocument() {
    if (!order) return;
    const rows = order.items
      .map((i) => `<tr><td>${i.name}</td><td class="num">${i.packs}</td><td class="num">${brl(i.unitPrice * i.packs)}</td></tr>`)
      .join("");
    printDocument(
      `Pedido #${order.number}`,
      `<h1>Pedido #${order.number}${fiscalChoice === "EMITIR_NFE" ? " — NF-e em processamento" : ""}</h1>` +
        `<p><b>Cliente:</b> ${order.customer.company || order.customer.name}<br><b>Endereço:</b> ${order.customer.address || "-----"}</p>` +
        `<table><thead><tr><th>Produto</th><th class="num">Qtd.</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>` +
        `<p style="text-align:right;margin-top:12px"><b>Total: ${brl(total)}</b></p>`
    );
  }

  function printBoletos() {
    const boletos = paymentMethods.filter((p) => p.type === "BOLETO");
    const rows = boletos
      .flatMap((p) => p.installments.map((i) => `<tr><td>${i.number}/${p.installments.length}</td><td>${fmtDate(i.dueDate)}</td><td class="num">${brl(i.amount)}</td></tr>`))
      .join("");
    printDocument(
      `Boletos — Pedido #${order?.number}`,
      `<h1>Boletos do Pedido #${order?.number}</h1>` +
        `<table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  if (orderStatus === "loading" || orderStatus === "idle") return <AdminState variant="loading" message="Carregando pedido..." />;
  if (orderStatus === "error" || !order) return <AdminState variant="error" message="Não foi possível carregar este pedido." />;

  if (billingDone) {
    const boletoCount = paymentMethods.filter((p) => p.type === "BOLETO").reduce((n, p) => n + p.installments.length, 0);
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

        <div className="mt-2 w-full max-w-lg text-left">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-muted">Documentos para entrega</h2>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-950/10 p-4">
            <div>
              <p className="font-bold text-forest-950">
                {fiscalChoice === "EMITIR_NFE" ? `DANFE — NF-e do Pedido #${order.number}` : `PDF do Pedido #${order.number}`}
              </p>
              <p className="text-xs text-ink-muted">
                {fiscalChoice === "EMITIR_NFE" ? "Documento fiscal em processamento" : "Documento do pedido para acompanhar a entrega"}
              </p>
            </div>
            <button onClick={printOrderDocument} className="flex items-center gap-1 rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-semibold hover:bg-forest-950/5">
              <Printer size={14} /> Imprimir
            </button>
          </div>
          {boletoCount > 0 ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-forest-950/10 p-4">
              <div>
                <p className="font-bold text-forest-950">Boletos — {boletoCount}</p>
                <p className="text-xs text-ink-muted">Carnê de cobrança deste faturamento</p>
              </div>
              <button onClick={printBoletos} className="flex items-center gap-1 rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs font-semibold hover:bg-forest-950/5">
                <Printer size={14} /> Imprimir
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-muted">Sem boletos neste faturamento. As demais formas de pagamento continuam registradas no financeiro.</p>
          )}
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

              {(pm.type === "BOLETO" || pm.type === "PIX") && (
                <label className="mt-3 flex items-center gap-2 text-sm text-ink-900">
                  <input
                    type="checkbox"
                    checked={pm.asaas}
                    onChange={(e) => updatePaymentMethod(pm.id, { asaas: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Gerar cobrança no Asaas
                </label>
              )}

              {pm.installments.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {pm.installments.map((inst, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
                      <span className="font-bold text-ink-muted">{inst.number}/{pm.installments.length}</span>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => updateInstallment(pm.id, i, { dueDate: e.target.value })}
                        className="h-9 rounded-lg border border-ink-900/15 px-2 text-sm"
                      />
                      <input
                        type="number"
                        value={inst.amount}
                        onChange={(e) => updateInstallment(pm.id, i, { amount: Number(e.target.value) })}
                        className="h-9 rounded-lg border border-ink-900/15 px-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {pm.type === "BOLETO" && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-forest-950">⚙ Encargos e desconto <span className="font-normal text-emerald-700">Padrão da empresa</span></p>
                    <button onClick={() => setShowChargeSettings(true)} className="flex items-center gap-1 rounded-lg border border-ink-900/15 bg-white px-2 py-1 text-xs font-semibold hover:bg-forest-950/5">
                      <Settings2 size={12} /> Alterar
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink-900">
                      {chargeSettings.fineOn ? `Multa ${chargeSettings.fineType === "percent" ? `${chargeSettings.fine}%` : brl(chargeSettings.fine)}` : "Sem multa"}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink-900">
                      {chargeSettings.interestOn ? `Juros ${chargeSettings.interest}% a.m.` : "Sem juros"}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink-900">
                      {chargeSettings.discountOn ? `Desconto ${chargeSettings.discountType === "percent" ? `${chargeSettings.discount}%` : brl(chargeSettings.discount)}` : "Sem desconto"}
                    </span>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-700">
                    <input type="checkbox" checked={chargeSettings.autoMessages} onChange={(e) => setChargeSettings({ autoMessages: e.target.checked })} className="h-4 w-4" />
                    Enviar mensagens automáticas ao cliente
                  </label>
                </div>
              )}

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
            <div className="flex flex-col gap-2 text-sm text-ink-700/70">
              <p><b>Pedido:</b> #{order.number} — {brl(total)}</p>
              <div>
                <b>Pagamento</b>
                {paymentMethods.map((pm) => (
                  <p key={pm.id}>{pm.type}: {brl(pm.amount)} {pm.mode === "term" ? `(${pm.daysText} dias)` : "(à vista)"}</p>
                ))}
              </div>
              <p><b>Fiscal:</b> {fiscalChoice === "EMITIR_NFE" ? "Emitir NF-e" : "Sem documento fiscal nesta operação"}</p>
              {paymentMethods.some((p) => p.type === "BOLETO") && (
                <p className="rounded-lg bg-forest-950/5 p-2">
                  <b>Encargos dos boletos:</b> Multa {chargeSettings.fineOn ? (chargeSettings.fineType === "percent" ? `${chargeSettings.fine}%` : brl(chargeSettings.fine)) : "não"} •
                  {" "}Juros {chargeSettings.interestOn ? `${chargeSettings.interest}% a.m.` : "não"} •
                  {" "}Desconto {chargeSettings.discountOn ? (chargeSettings.discountType === "percent" ? `${chargeSettings.discount}%` : brl(chargeSettings.discount)) : "nenhum"}
                  <br />Mensagens automáticas: <b>{chargeSettings.autoMessages ? "Ativadas" : "Desativadas"}</b>
                </p>
              )}
              <p className="text-xs">Esta ação cria as contas a receber e libera o pedido para Entrega Registra.</p>
            </div>
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

      {showChargeSettings && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h2 className="mb-1 text-lg font-extrabold text-forest-950">Configurações da cobrança</h2>
            <p className="mb-4 text-xs text-ink-muted">Estas regras serão aplicadas a todos os boletos deste pagamento.</p>

            <div className="border-b border-forest-950/10 pb-4">
              <p className="mb-2 text-sm font-bold text-forest-950">Juros por atraso</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chargeSettings.interestOn} onChange={(e) => setChargeSettings({ interestOn: e.target.checked })} className="h-4 w-4" />
                Aplicar juros
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                Juros ao mês (%)
                <input type="number" value={chargeSettings.interest} onChange={(e) => setChargeSettings({ interest: Number(e.target.value) })} className="h-9 w-32 rounded-lg border border-ink-900/15 px-2 text-sm" />
              </label>
            </div>

            <div className="border-b border-forest-950/10 py-4">
              <p className="mb-2 text-sm font-bold text-forest-950">Multa por atraso</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chargeSettings.fineOn} onChange={(e) => setChargeSettings({ fineOn: e.target.checked })} className="h-4 w-4" />
                Aplicar multa
              </label>
              <div className="mb-2 flex gap-4 text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={chargeSettings.fineType === "percent"} onChange={() => setChargeSettings({ fineType: "percent" })} /> Percentual</label>
                <label className="flex items-center gap-1"><input type="radio" checked={chargeSettings.fineType === "fixed"} onChange={() => setChargeSettings({ fineType: "fixed" })} /> Valor fixo</label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                {chargeSettings.fineType === "percent" ? "Multa (%)" : "Multa (R$)"}
                <input type="number" value={chargeSettings.fine} onChange={(e) => setChargeSettings({ fine: Number(e.target.value) })} className="h-9 w-32 rounded-lg border border-ink-900/15 px-2 text-sm" />
              </label>
            </div>

            <div className="py-4">
              <p className="mb-2 text-sm font-bold text-forest-950">Desconto por antecipação</p>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={chargeSettings.discountOn} onChange={(e) => setChargeSettings({ discountOn: e.target.checked })} className="h-4 w-4" />
                Aplicar desconto
              </label>
              {chargeSettings.discountOn && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1"><input type="radio" checked={chargeSettings.discountType === "percent"} onChange={() => setChargeSettings({ discountType: "percent" })} /> Percentual</label>
                    <label className="flex items-center gap-1"><input type="radio" checked={chargeSettings.discountType === "fixed"} onChange={() => setChargeSettings({ discountType: "fixed" })} /> Valor fixo</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      {chargeSettings.discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}
                      <input type="number" value={chargeSettings.discount} onChange={(e) => setChargeSettings({ discount: Number(e.target.value) })} className="h-9 rounded-lg border border-ink-900/15 px-2 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-ink-muted">
                      Prazo máximo do desconto
                      <select value={chargeSettings.discountDeadline} onChange={(e) => setChargeSettings({ discountDeadline: e.target.value })} className="h-9 rounded-lg border border-ink-900/15 px-2 text-sm">
                        <option>Até o dia do vencimento</option>
                        <option>1 dia antes</option>
                        <option>3 dias antes</option>
                        <option>5 dias antes</option>
                        <option>7 dias antes</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowChargeSettings(false)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button onClick={() => setShowChargeSettings(false)}>Aplicar aos boletos</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
