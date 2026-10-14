import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { brl } from "@/pages/admin/despesas/shared";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";
import { useDespesasStore } from "@/store/despesas-store";
import { usePurchaseStore, type LaunchItemRow } from "@/store/purchase-store";

const C = DESPESAS_COLORS;

/** Efeitos de estoque de uma compra já lançada: confirmar o que chegou e devolver ao fornecedor.
 * Nada aqui cria outra obrigação financeira: devolução abate o que está em aberto ou gera crédito. */
export function PurchaseStockPanel({ launchId }: { launchId: string }) {
  const fetchLaunchItems = usePurchaseStore((s) => s.fetchLaunchItems);
  const confirmReceipt = usePurchaseStore((s) => s.confirmReceipt);
  const returnItems = usePurchaseStore((s) => s.returnItems);
  const correctItem = usePurchaseStore((s) => s.correctItem);
  const refreshExpenses = useDespesasStore((s) => s.fetchAll);

  const [items, setItems] = useState<LaunchItemRow[] | null>(null);
  const [returning, setReturning] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [fixes, setFixes] = useState<Record<string, { quantity: string; price: string }>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await fetchLaunchItems(launchId));
  }, [fetchLaunchItems, launchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (items === null || items.length === 0) return null;

  const pending = items.filter((item) => item.receivedAt === null);
  const returnable = items.filter((item) => item.receivedAt !== null && item.landedUnitCost !== null && item.returnedQuantity < item.quantity);

  async function handleReceipt() {
    if (busy) return;
    setBusy(true);
    const error = await confirmReceipt(launchId);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Recebimento confirmado: o estoque recebeu a quantidade uma única vez.");
    await load();
    void refreshExpenses();
  }

  const correctable = items.filter((item) => item.receivedAt !== null && item.landedUnitCost !== null);

  async function handleCorrect() {
    if (busy) return;
    const changed = correctable
      .map((item) => {
        const fix = fixes[item.id];
        return { item, quantity: Number(fix?.quantity ?? item.quantity), price: Number(fix?.price ?? item.unitPrice) };
      })
      .filter((row) => row.quantity !== row.item.quantity || row.price !== row.item.unitPrice);
    if (changed.length === 0) {
      toast.error("Altere a quantidade ou o valor de pelo menos um item.");
      return;
    }
    if (reason.trim() === "") {
      toast.error("Informe o motivo da correção.");
      return;
    }
    setBusy(true);
    const messages: string[] = [];
    for (const row of changed) {
      const result = await correctItem(row.item.id, row.quantity, row.price, reason.trim());
      if ("error" in result) {
        setBusy(false);
        toast.error(`${row.item.name}: ${result.error}`);
        await load();
        return;
      }
      messages.push(
        result.extraCharge > 0
          ? `${brl(result.extraCharge)} de cobrança adicional (compra já paga)`
          : result.creditCreated > 0
            ? `${brl(result.creditCreated)} a recuperar do fornecedor`
            : `${brl(Math.abs(result.appliedToOpen))} ajustados no que está em aberto`
      );
    }
    setBusy(false);
    toast.success(`Correção registrada: ${messages.join("; ")}. O histórico original foi preservado.`);
    setCorrecting(false);
    setFixes({});
    setReason("");
    await load();
    void refreshExpenses();
  }

  async function handleReturn() {
    if (busy) return;
    const lines = returnable
      .map((item) => ({ launchItemId: item.id, quantity: Number(quantities[item.id] || 0) }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      toast.error("Informe a quantidade a devolver em pelo menos um item.");
      return;
    }
    if (reason.trim() === "") {
      toast.error("Informe o motivo da devolução.");
      return;
    }
    setBusy(true);
    const result = await returnItems(launchId, lines, reason.trim());
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.creditCreated > 0
        ? `Devolução registrada. ${brl(result.appliedToOpen)} abatidos do que estava em aberto e ${brl(result.creditCreated)} a recuperar do fornecedor.`
        : `Devolução registrada. ${brl(result.appliedToOpen)} abatidos do valor em aberto.`
    );
    setReturning(false);
    setQuantities({});
    setReason("");
    await load();
    void refreshExpenses();
  }

  return (
    <section className="mt-3 rounded-[10px] border p-3.5" style={{ borderColor: C.line }} aria-label="Itens de estoque desta compra">
      <h3 className="mb-2 text-sm font-bold" style={{ color: C.green }}>Itens de estoque desta compra</h3>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: C.muted }}>
            <span>
              <strong style={{ color: C.green }}>{item.name}</strong> · {item.quantity.toLocaleString("pt-BR")} {item.unit} × {brl(item.unitPrice)}
              {item.landedUnitCost !== null ? ` (custo rateado ${brl(item.landedUnitCost)})` : ""}
              {item.returnedQuantity > 0 ? ` · devolvido ${item.returnedQuantity.toLocaleString("pt-BR")}` : ""}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: item.receivedAt ? "#e7f4e9" : "#fff0db", color: item.receivedAt ? "#2e754b" : "#9a6520" }}>
              {item.receivedAt ? "Recebido" : "Aguardando recebimento"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pending.length > 0 && (
          <Button size="sm" disabled={busy} onClick={() => void handleReceipt()}>
            {busy ? "Confirmando..." : "Confirmar recebimento"}
          </Button>
        )}
        {correctable.length > 0 && (
          <button onClick={() => { setCorrecting((open) => !open); setReturning(false); }} className="rounded-xl border px-3.5 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
            Corrigir compra
          </button>
        )}
        {returnable.length > 0 && (
          <button onClick={() => { setReturning((open) => !open); setCorrecting(false); }} className="rounded-xl border px-3.5 py-2 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
            Devolver ao fornecedor
          </button>
        )}
      </div>

      {correcting && (
        <div className="mt-3 rounded-[10px] p-3" style={{ background: "#f7f9f4" }}>
          <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
            A correção não apaga o lançamento original: a diferença de quantidade vira um movimento novo no estoque, o custo médio acompanha a diferença de valor e o financeiro ajusta o que está em aberto (compra já paga gera cobrança adicional ou crédito). Compras com frete, outras despesas ou desconto rateados devem ser corrigidas por devolução e novo lançamento.
          </p>
          {correctable.map((item) => (
            <div key={item.id} className="mb-2 grid grid-cols-[1fr_auto_auto] items-end gap-2 text-xs" style={{ color: C.green }}>
              <span>{item.name}<small className="block" style={{ color: C.muted }}>hoje {item.quantity.toLocaleString("pt-BR")} {item.unit} × {brl(item.unitPrice)}</small></span>
              <label className="flex flex-col gap-0.5">Qtd.
                <input type="number" min={item.returnedQuantity || 0.001} step="any" value={fixes[item.id]?.quantity ?? String(item.quantity)} onChange={(e) => setFixes((prev) => ({ ...prev, [item.id]: { quantity: e.target.value, price: prev[item.id]?.price ?? String(item.unitPrice) } }))} className="h-9 w-24 rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} aria-label={`Nova quantidade de ${item.name}`} />
              </label>
              <label className="flex flex-col gap-0.5">Valor unit.
                <input type="number" min={0} step="0.01" value={fixes[item.id]?.price ?? String(item.unitPrice)} onChange={(e) => setFixes((prev) => ({ ...prev, [item.id]: { quantity: prev[item.id]?.quantity ?? String(item.quantity), price: e.target.value } }))} className="h-9 w-24 rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} aria-label={`Novo valor unitário de ${item.name}`} />
              </label>
            </div>
          ))}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo da correção (obrigatório)" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} />
          <Button size="sm" className="mt-2" disabled={busy} onClick={() => void handleCorrect()}>
            {busy ? "Registrando..." : "Registrar correção"}
          </Button>
        </div>
      )}

      {returning && (
        <div className="mt-3 rounded-[10px] p-3" style={{ background: "#f7f9f4" }}>
          <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
            A devolução reduz o estoque pela quantidade devolvida e abate o valor em aberto; se já foi pago, vira crédito a recuperar do fornecedor. Devolução total tira esta compra da referência de custo.
          </p>
          {returnable.map((item) => (
            <label key={item.id} className="mb-1.5 flex items-center justify-between gap-2 text-xs" style={{ color: C.green }}>
              <span>{item.name} (máx. {(item.quantity - item.returnedQuantity).toLocaleString("pt-BR")} {item.unit})</span>
              <input
                type="number"
                min={0}
                max={item.quantity - item.returnedQuantity}
                step="any"
                value={quantities[item.id] ?? ""}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="h-9 w-28 rounded-lg border px-2 text-sm"
                style={{ borderColor: C.line }}
                aria-label={`Quantidade a devolver de ${item.name}`}
              />
            </label>
          ))}
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo da devolução (obrigatório)" className="mt-1 h-9 w-full rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} />
          <Button size="sm" className="mt-2" disabled={busy} onClick={() => void handleReturn()}>
            {busy ? "Registrando..." : "Registrar devolução"}
          </Button>
        </div>
      )}
    </section>
  );
}
