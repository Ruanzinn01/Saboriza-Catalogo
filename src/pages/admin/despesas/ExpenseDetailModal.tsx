import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDespesasStore, type BlockType } from "@/store/despesas-store";
import { Button } from "@/components/ui/Button";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CLASS: Record<string, { bg: string; text: string; label: string }> = {
  PAGO: { bg: "#e7f4e9", text: "#2e754b", label: "Pago" },
  ABERTO: { bg: "#eef0ed", text: "#68726b", label: "Em aberto" },
  AGENDADO: { bg: "#e8f0f9", text: "#2c6499", label: "Agendado" },
  ATRASADO: { bg: "#fbe9e7", text: "#a6433a", label: "Atrasado" },
  BLOQUEADO: { bg: "#fff0db", text: "#9a6520", label: "Bloqueado" },
};

const BLOCK_OPTIONS: { value: BlockType; title: string; description: string }[] = [
  { value: "hold", title: "Não pagar por enquanto", description: "Suspende o pagamento; o compromisso continua em aberto." },
  { value: "skip_occurrence", title: "Essa despesa não ocorrerá neste mês", description: "Cancela somente esta ocorrência; recorrência futura continua." },
  { value: "end_recurrence", title: "Não haverá mais essa despesa", description: "Encerra recorrências futuras e preserva o histórico." },
];

/** Equivalente ao `<dialog id="detailModal">` do HTML V2 — modal flutuante sobre a Visão Geral,
 * não uma navegação de página cheia (DRT §7). */
export function ExpenseDetailModal({ expenseId, onClose }: { expenseId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const expenses = useDespesasStore((s) => s.expenses);
  const markExpensePaid = useDespesasStore((s) => s.markExpensePaid);
  const blockExpense = useDespesasStore((s) => s.blockExpense);
  const createExpenseAdjustment = useDespesasStore((s) => s.createExpenseAdjustment);

  const [showBlock, setShowBlock] = useState(false);
  const [blockChoice, setBlockChoice] = useState<BlockType>("hold");
  const [blockReason, setBlockReason] = useState("");
  const [payValue, setPayValue] = useState("");
  const [paying, setPaying] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");

  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return null;

  const remaining = expense.amount - (expense.paidAmount ?? 0);
  const tone = STATUS_CLASS[expense.status];

  async function handlePaid() {
    const value = Number(payValue);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setPaying(true);
    const err = await markExpensePaid(expense!.id, value);
    setPaying(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Pagamento registrado");
    setPayValue("");
  }

  async function handleBlock() {
    if (!blockReason.trim()) {
      toast.error("Informe o motivo do bloqueio.");
      return;
    }
    setBlocking(true);
    const err = await blockExpense(expense!.id, blockChoice, blockReason.trim());
    setBlocking(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(
      blockChoice === "hold"
        ? "Pagamento suspenso; compromisso continua em aberto."
        : blockChoice === "skip_occurrence"
          ? "Ocorrência do mês cancelada; recorrência futura preservada."
          : "Recorrência futura encerrada; histórico preservado."
    );
    setShowBlock(false);
    setBlockReason("");
  }

  async function handleAdjust() {
    if (!adjustReason.trim()) {
      toast.error("Motivo é obrigatório");
      return;
    }
    const err = await createExpenseAdjustment(expense!.id, adjustReason.trim(), adjustAmount ? { amount: Number(adjustAmount) } : undefined);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Ajuste registrado — competência histórica preservada");
    setShowAdjust(false);
    setAdjustReason("");
    setAdjustAmount("");
  }

  function openSource() {
    if (expense!.sourceModule === "raw_materials" && expense!.sourceEntityId) {
      navigate(`/admin/materias-primas/${expense!.sourceEntityId}`);
      return;
    }
    toast.info("Este lançamento não possui origem externa vinculada.");
  }

  return (
    <dialog open className="m-0 w-full max-w-[780px] rounded-[18px] border-0 p-0 shadow-[0_20px_80px_#082d2333]" style={{ color: C.green }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#092d237a] p-4" onClick={onClose}>
        <div className="max-h-[78vh] w-full max-w-[780px] overflow-auto rounded-[18px] bg-white p-[22px]" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[3px]" style={{ color: C.gold }}>{expense.origin.toUpperCase()}</p>
              <h2 className="text-lg font-extrabold" style={{ color: C.green }}>{expense.description}</h2>
              <p className="text-xs" style={{ color: C.muted }}>{[expense.partyName, expense.documentRef].filter(Boolean).join(" · ") || "Lançamento direto"}</p>
            </div>
            <button onClick={onClose} className="px-1.5 text-2xl leading-none" style={{ color: C.green }}>×</button>
          </div>

          <div className="my-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}><span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>Valor</span><strong className="text-[13px]">{brl(expense.amount)}</strong></div>
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}><span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>Vencimento</span><strong className="text-[13px]">{expense.dueDate ?? "-----"}</strong></div>
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}>
              <span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>Status</span>
              <strong className="text-[13px]"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tone.bg, color: tone.text }}>{tone.label}</span></strong>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}><span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>Categoria</span><strong className="text-[13px]">{expense.subcategory ? `${expense.category} · ${expense.subcategory}` : expense.category}</strong></div>
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}><span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>Competência</span><strong className="text-[13px]">{expense.competence ?? "-----"}</strong></div>
            <div className="rounded-xl p-3" style={{ background: "#f6f8f3" }}>
              <span className="block text-[10px] uppercase" style={{ color: "#7a8179" }}>{expense.status === "PAGO" ? "Pagamento" : "Saldo"}</span>
              <strong className="text-[13px]">{expense.status === "PAGO" ? expense.settledAt?.slice(0, 10) ?? "Confirmado" : brl(remaining)}</strong>
            </div>
          </div>

          {expense.itemDetail && (
            <p className="mb-2.5 rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#f6f8f3", color: C.green }}>
              <strong>Descrição:</strong> {expense.itemDetail}
            </p>
          )}

          {expense.blockType && (
            <p className="rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#fff4d8", color: "#806426" }}>
              <strong>Bloqueio ativo:</strong> {expense.blockReason}
            </p>
          )}

          {expense.origin === "asset" && (
            <p className="mt-2 rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#edf5ee", color: "#356449" }}>
              <strong>Patrimônio:</strong> este lançamento alimenta o saldo em formação da categoria {expense.category}. Não cria outro valor patrimonial até a apropriação.
            </p>
          )}

          {expense.status !== "PAGO" && (
            <div className="mt-3.5 flex items-center gap-2 rounded-[10px] p-3" style={{ background: "#f7f9f4" }}>
              <input
                type="number"
                value={payValue}
                onChange={(e) => setPayValue(e.target.value)}
                placeholder={`R$ (saldo ${brl(remaining)})`}
                className="h-10 w-48 rounded-lg border px-3 text-sm"
                style={{ borderColor: C.line }}
              />
              <Button size="sm" disabled={paying} onClick={() => void handlePaid()}>{paying ? "Salvando..." : "Registrar pagamento"}</Button>
            </div>
          )}

          <div className="mt-[18px] flex flex-wrap justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Fechar</button>
            {expense.status !== "PAGO" && (
              <button onClick={() => setShowBlock(true)} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
                Bloquear / interromper
              </button>
            )}
            <button onClick={() => setShowAdjust((v) => !v)} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
              Ajuste/correção
            </button>
            {(expense.sourceModule || expense.sourceEntityId) && (
              <Button size="sm" onClick={openSource}>Abrir lançamento-fonte</Button>
            )}
          </div>

          {showAdjust && (
            <div className="mt-3 rounded-[10px] border p-3.5" style={{ borderColor: C.line }}>
              <p className="mb-2 text-[11px]" style={{ color: C.muted }}>
                Correção de competência fechada não edita o fato original — cria um novo evento vinculado (delta de valor).
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs" style={{ color: C.green }}>
                  Novo valor (opcional)
                  <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="h-9 w-36 rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} />
                </label>
                <label className="flex flex-col gap-1 text-xs" style={{ color: C.green }}>
                  Motivo
                  <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="h-9 w-56 rounded-lg border px-2 text-sm" style={{ borderColor: C.line }} />
                </label>
                <Button size="sm" onClick={() => void handleAdjust()}>Confirmar</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBlock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#092d237a] p-4" onClick={() => setShowBlock(false)}>
          <div className="w-full max-w-lg rounded-[18px] bg-white p-[22px]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[3px]" style={{ color: C.gold }}>AÇÃO CONTROLADA</p>
                <h2 className="text-lg font-extrabold" style={{ color: C.green }}>Bloquear / interromper despesa</h2>
                <p className="text-xs" style={{ color: C.muted }}>{expense.description} · {brl(expense.amount)} · {tone.label}</p>
              </div>
              <button onClick={() => setShowBlock(false)} className="px-1.5 text-2xl leading-none" style={{ color: C.green }}>×</button>
            </div>

            {expense.status === "AGENDADO" && (
              <p className="mb-3 rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#fff4d8", color: "#806426" }}>
                Este pagamento está agendado. O bloqueio só é concluído depois da confirmação do cancelamento da programação financeira.
              </p>
            )}

            <div className="my-3.5 grid gap-2">
              {BLOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBlockChoice(opt.value)}
                  className="rounded-[12px] border p-3.5 text-left"
                  style={blockChoice === opt.value ? { borderColor: "#93b9a1", background: "#f2f7ef" } : { borderColor: C.line }}
                >
                  <strong className="mb-1 block" style={{ color: C.green }}>{opt.title}</strong>
                  <span className="text-xs" style={{ color: C.muted }}>{opt.description}</span>
                </button>
              ))}
            </div>

            <label className="mb-1.5 block text-xs" style={{ color: C.muted }}>Motivo obrigatório</label>
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Informe o motivo da decisão"
              className="w-full rounded-[10px] border p-[11px] text-sm"
              style={{ borderColor: "#d9ded7" }}
            />

            <div className="mt-[18px] flex justify-end gap-2">
              <button onClick={() => setShowBlock(false)} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Cancelar</button>
              <Button disabled={blocking} onClick={() => void handleBlock()}>{blocking ? "Salvando..." : "Confirmar"}</Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
