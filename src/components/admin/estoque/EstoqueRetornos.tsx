import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, KpiButton } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/currency";
import { LOSS_KIND_LABEL, RETURN_SOURCE_LABEL } from "@/lib/estoque";
import { formatDateTime, normalizeText } from "@/lib/inventory";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";
import type { LossKind, StockItemType, StockReturnRow } from "@/types/estoque";

const fieldCls = "min-h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function EstoqueRetornos({ goTo }: { goTo: (tab: string) => void }) {
  const returns = useEstoqueStore((s) => s.returns);
  const losses = useEstoqueStore((s) => s.losses);
  const position = useEstoqueStore((s) => s.position);
  const fetchReturns = useEstoqueStore((s) => s.fetchReturns);
  const fetchLosses = useEstoqueStore((s) => s.fetchLosses);
  const fetchPosition = useEstoqueStore((s) => s.fetchPosition);
  const confirmReturn = useEstoqueStore((s) => s.confirmReturn);
  const registerLoss = useEstoqueStore((s) => s.registerLoss);

  const [checking, setChecking] = useState<StockReturnRow | null>(null);
  const [good, setGood] = useState("");
  const [notes, setNotes] = useState("");
  const [arrived, setArrived] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossSearch, setLossSearch] = useState("");
  const [lossItem, setLossItem] = useState("");
  const [lossKind, setLossKind] = useState<LossKind>("EXPIRY");
  const [lossQty, setLossQty] = useState("");
  const [lossDate, setLossDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lossReason, setLossReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchReturns();
    void fetchLosses();
    if (position.length === 0) void fetchPosition();
  }, [fetchReturns, fetchLosses, fetchPosition, position.length]);

  const awaiting = returns.filter((row) => row.status === "AWAITING");
  const monthLosses = useMemo(() => losses.filter((row) => row.occurredOn >= monthStart()), [losses]);
  const monthCost = monthLosses.reduce((sum, row) => sum + (row.totalCost ?? 0), 0);
  const unknownCost = monthLosses.filter((row) => row.totalCost === null).length;

  const lossOptions = useMemo(() => {
    const term = normalizeText(lossSearch.trim());
    return position.filter((item) => item.physical > 0 && (term === "" || normalizeText(`${item.name} ${item.sku}`).includes(term))).slice(0, 60);
  }, [position, lossSearch]);

  function openReturn(row: StockReturnRow) {
    setChecking(row);
    setGood(String(row.expectedUnits));
    setNotes("");
    setArrived(false);
    setError(null);
  }

  async function handleConfirm() {
    if (!checking || busy) return;
    setBusy(true);
    setError(null);
    const message = await confirmReturn({ returnId: checking.id, goodUnits: Number(good), notes: notes.trim(), received: arrived });
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    toast.success("Aptas retornaram ao disponível. Impróprias ficaram fora do saldo, sem segunda baixa.");
    setChecking(null);
  }

  async function handleLoss() {
    if (busy) return;
    const selected = position.find((item) => item.itemId === lossItem);
    if (!selected) {
      setError("Selecione o item.");
      return;
    }
    setBusy(true);
    setError(null);
    const message = await registerLoss({
      itemType: selected.itemType as StockItemType,
      itemId: selected.itemId,
      quantity: Number(lossQty),
      kind: lossKind,
      occurredOn: lossDate,
      reason: lossReason.trim(),
    });
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    toast.success("Perda registrada com movimento próprio e custo rastreável.");
    setLossOpen(false);
    setLossQty("");
    setLossReason("");
    setLossItem("");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-amber-500/15 p-3 text-sm leading-relaxed text-amber-900">
        <b>Cancelar o pedido não comprova retorno físico.</b> A mercadoria só volta ao saldo disponível após recebimento e conferência. Mercadoria imprópria não fica disponível para venda.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiButton title="RETORNOS AGUARDANDO" accent="#c78132" value={awaiting.length} sub="Conferência física pendente" />
        <KpiButton
          title="PERDAS DO MÊS"
          accent="#bf5a50"
          value={formatCurrency(monthCost)}
          sub={unknownCost > 0 ? `${monthLosses.length} ocorrências · ${unknownCost} sem custo conhecido` : `${monthLosses.length} ocorrências`}
        />
        <KpiButton title="VALIDADE" accent="#7966a6" value="Lotes" sub="Perda por vencimento nasce dos lotes" onClick={() => goTo("lotes")} />
      </div>

      <Card title="Retornos aguardando conferência">
        {returns.length === 0 ? (
          <p className="p-4 text-sm text-ink-muted">Nenhum retorno esperado. Eles aparecem quando uma entrega é parcial/recusada ou quando um pedido já separado é cancelado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-forest-950/10 bg-cream-50 text-[10px] uppercase tracking-wide text-ink-muted">
                <tr><th className="px-3 py-3">Retorno / origem</th><th className="px-3 py-3">Produto</th><th className="px-3 py-3">Quantidade</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Ação</th></tr>
              </thead>
              <tbody>
                {returns.map((row) => (
                  <tr key={row.id} className="border-b border-forest-950/5 last:border-none">
                    <td className="px-3 py-3"><b>{row.sourceRef || "Retorno"}</b><small className="block text-[11px] text-ink-muted">{RETURN_SOURCE_LABEL[row.source]} · {formatDateTime(row.createdAt)}</small></td>
                    <td className="px-3 py-3">{row.productName}</td>
                    <td className="px-3 py-3">{formatNumber(row.expectedUnits)} un</td>
                    <td className="px-3 py-3">{row.status === "CONFIRMED" ? `Conferido · ${formatNumber(row.goodUnits ?? 0)} aptas / ${formatNumber(row.badUnits ?? 0)} impróprias` : "Aguardando conferência física"}</td>
                    <td className="px-3 py-3"><Button size="sm" variant="outline" className="min-h-11" disabled={row.status === "CONFIRMED"} onClick={() => openReturn(row)}>Conferir retorno</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Perdas e avarias">
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-ink-700">Perda conhecida exige motivo e custo rastreável. Não escondê-la como ajuste genérico.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setLossOpen(true); setError(null); }}>Registrar perda / avaria</Button>
            <span className="text-xs text-ink-muted">Vencimento · avaria · quebra · contaminação · outro. Correções de saldo sem perda conhecida passam pelo Inventário.</span>
          </div>
          {losses.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-forest-950/10 text-[10px] uppercase tracking-wide text-ink-muted">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Quantidade</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Custo</th><th className="px-3 py-2">Motivo</th></tr>
                </thead>
                <tbody>
                  {losses.map((row) => (
                    <tr key={row.id} className="border-b border-forest-950/5 last:border-none">
                      <td className="px-3 py-2">{new Date(`${row.occurredOn}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2"><b>{row.itemName}</b>{row.source === "RETURN" ? <small className="block text-[10px] text-ink-muted">Retorno impróprio</small> : null}</td>
                      <td className="px-3 py-2">{formatNumber(row.quantity)}</td>
                      <td className="px-3 py-2">{LOSS_KIND_LABEL[row.kind]}</td>
                      <td className="px-3 py-2">{row.totalCost === null ? <span className="text-ink-muted">Custo desconhecido</span> : formatCurrency(row.totalCost)}</td>
                      <td className="px-3 py-2 text-ink-muted">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={checking !== null} onClose={() => setChecking(null)} title={checking ? `Conferência física · ${checking.sourceRef}` : ""}>
        {checking && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Retorno esperado: <b>{formatNumber(checking.expectedUnits)} un</b> de {checking.productName}. Confirme a chegada física antes de concluir.</p>
            <label className="flex flex-col gap-1 text-xs font-bold">
              Quantidade apta a retornar ao disponível
              <input type="number" min={0} max={checking.expectedUnits} step={1} value={good} onChange={(e) => setGood(e.target.value)} className={fieldCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">
              Observação / destino das impróprias
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-forest-700" />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arrived} onChange={(e) => setArrived(e.target.checked)} /> Mercadoria recebida e conferida fisicamente</label>
            {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
            <Button disabled={busy} onClick={() => void handleConfirm()}>{busy ? "Confirmando..." : "Confirmar conferência"}</Button>
          </div>
        )}
      </Dialog>

      <Dialog open={lossOpen} onClose={() => setLossOpen(false)} title="Registrar perda / avaria">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold">
            Buscar item com saldo
            <input value={lossSearch} onChange={(e) => setLossSearch(e.target.value)} placeholder="Nome ou código" className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">
            Item
            <select value={lossItem} onChange={(e) => setLossItem(e.target.value)} className={fieldCls}>
              <option value="">Selecione</option>
              {lossOptions.map((item) => (
                <option key={item.itemId} value={item.itemId}>{item.name} — saldo {formatNumber(item.physical)} {item.baseUnit}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-bold">Tipo de ocorrência
              <select value={lossKind} onChange={(e) => setLossKind(e.target.value as LossKind)} className={fieldCls}>
                {(Object.keys(LOSS_KIND_LABEL) as LossKind[]).map((key) => <option key={key} value={key}>{LOSS_KIND_LABEL[key]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">Quantidade perdida
              <input type="number" min={0} step="any" value={lossQty} onChange={(e) => setLossQty(e.target.value)} className={fieldCls} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">Data
              <input type="date" max={new Date().toISOString().slice(0, 10)} value={lossDate} onChange={(e) => setLossDate(e.target.value)} className={fieldCls} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-bold">
            Justificativa / motivo
            <textarea value={lossReason} onChange={(e) => setLossReason(e.target.value)} rows={3} className="rounded-xl border border-ink-900/15 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-forest-700" />
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
          <Button disabled={busy || lossItem === "" || Number(lossQty) <= 0 || lossReason.trim() === ""} onClick={() => void handleLoss()}>{busy ? "Registrando..." : "Registrar perda"}</Button>
          <p className="text-xs text-ink-muted">O responsável e a data de registro são gravados pelo servidor. Se o custo do item for desconhecido, a perda fica sem valor em vez de zero.</p>
        </div>
      </Dialog>
    </div>
  );
}
