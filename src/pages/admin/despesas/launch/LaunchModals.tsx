import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";
import { useExpenseLaunchStore, type LaunchKind } from "@/store/expense-launch-store";
import type { Employee } from "@/types/employee";
import { brl } from "@/pages/admin/despesas/shared";
import { frequencyLabel, type CartLine } from "./types";

const C = DESPESAS_COLORS;

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#092d237a] p-4" onClick={onClose}>
      <div className="max-h-[75vh] w-full max-w-[620px] overflow-auto rounded-[18px] bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b p-[21px]" style={{ borderColor: C.line }}>
          <h2 className="text-lg font-extrabold" style={{ color: C.green }}>{title}</h2>
          <button onClick={onClose} className="px-1.5 text-2xl leading-none" style={{ color: C.green }}>×</button>
        </div>
        <div className="p-[22px]">{children}</div>
      </div>
    </div>
  );
}

const fieldCls = "w-full rounded-[10px] border px-3 py-3 text-sm";

/** Recorrência e detalhes do contrato — equivalente a `itemConfig()` do HTML V3. */
export function ItemConfigModal({ line, onClose, onSave }: { line: CartLine; onClose: () => void; onSave: (patch: Partial<CartLine>) => void }) {
  const [contract, setContract] = useState(line.contractLabel);
  const [reference, setReference] = useState(line.referenceExpenseId ?? "");
  const [enabled, setEnabled] = useState(line.recurrence.enabled);
  const [frequency, setFrequency] = useState(line.recurrence.frequency);
  const [intervalDays, setIntervalDays] = useState(line.recurrence.intervalDays ?? 30);
  const [dayOfMonth, setDayOfMonth] = useState(line.recurrence.dayOfMonth ?? 10);
  const [startDate, setStartDate] = useState(line.recurrence.startDate);
  const [endMode, setEndMode] = useState(line.recurrence.endMode);
  const [endDate, setEndDate] = useState(line.recurrence.endDate ?? "");
  const [occurrences, setOccurrences] = useState(line.recurrence.occurrences ?? 12);
  const [variable, setVariable] = useState(line.recurrence.variableAmount);

  function submit() {
    if (!contract.trim()) {
      toast.error("Identifique o contrato.");
      return;
    }
    if (enabled && (!startDate || (endMode === "date" && (!endDate || endDate < startDate)))) {
      toast.error("Revise as datas da recorrência.");
      return;
    }
    onSave({
      contractLabel: contract.trim(),
      referenceExpenseId: reference.trim() || undefined,
      recurrence: { enabled, frequency, intervalDays, dayOfMonth, startDate, endMode, endDate: endDate || undefined, occurrences, variableAmount: variable },
    });
    onClose();
  }

  return (
    <ModalShell title="Recorrência e detalhes" onClose={onClose}>
      <h3 className="mb-3 font-bold" style={{ color: C.green }}>{line.name}</h3>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold">Identificação do contrato / compromisso *</span>
        <input value={contract} onChange={(e) => setContract(e.target.value)} maxLength={100} placeholder="Ex.: Aluguel do depósito" className={fieldCls} style={{ borderColor: C.line }} />
      </label>
      {line.kind === "partner" && (
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs font-semibold">Referência da despesa original (reembolso)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID/código da despesa paga pelo sócio" className={fieldCls} style={{ borderColor: C.line }} />
        </label>
      )}
      <label className="mb-3 flex items-start gap-2 rounded-[10px] p-3" style={{ background: "#f4f7f0" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5" />
        <span className="text-xs leading-relaxed">
          <strong style={{ color: C.green }}>Este compromisso se repete</strong>
          <br />
          Próximas ocorrências serão preparadas sem relançamento manual.
        </span>
      </label>
      {enabled && (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="text-xs"><span className="mb-1 block font-semibold">Frequência</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className={fieldCls} style={{ borderColor: C.line }}>
              <option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option><option value="custom">Personalizada (dias)</option>
            </select>
          </label>
          <label className="text-xs"><span className="mb-1 block font-semibold">Intervalo (dias, se personalizada)</span>
            <input type="number" min={1} max={3650} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))} className={fieldCls} style={{ borderColor: C.line }} />
          </label>
          <label className="text-xs"><span className="mb-1 block font-semibold">Início</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
          </label>
          <label className="text-xs"><span className="mb-1 block font-semibold">Dia de vencimento mensal</span>
            <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className={fieldCls} style={{ borderColor: C.line }} />
          </label>
          <label className="text-xs"><span className="mb-1 block font-semibold">Encerramento</span>
            <select value={endMode} onChange={(e) => setEndMode(e.target.value as typeof endMode)} className={fieldCls} style={{ borderColor: C.line }}>
              <option value="none">Sem data final</option><option value="date">Em uma data</option><option value="count">Após N ocorrências</option>
            </select>
          </label>
          {endMode === "date" && (
            <label className="text-xs"><span className="mb-1 block font-semibold">Data final</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
            </label>
          )}
          {endMode === "count" && (
            <label className="text-xs"><span className="mb-1 block font-semibold">Quantidade de ocorrências</span>
              <input type="number" min={1} max={600} value={occurrences} onChange={(e) => setOccurrences(Number(e.target.value))} className={fieldCls} style={{ borderColor: C.line }} />
            </label>
          )}
          <label className="col-span-2 text-xs"><span className="mb-1 block font-semibold">Valor das próximas ocorrências</span>
            <select value={variable ? "variable" : "fixed"} onChange={(e) => setVariable(e.target.value === "variable")} className={fieldCls} style={{ borderColor: C.line }}>
              <option value="fixed">Fixo</option><option value="variable">Variável — aguardar valor real</option>
            </select>
          </label>
        </div>
      )}
      <p className="mt-3 rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#fff4d8", color: "#86682b" }}>
        A geração automática das próximas ocorrências é uma etapa futura — este cadastro só registra o compromisso recorrente.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border px-3.5 py-2.5 text-sm font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Cancelar</button>
        <Button onClick={submit}>Salvar configuração</Button>
      </div>
    </ModalShell>
  );
}

/** Categorias e padrão de rateio — equivalente a `categoriesModal()`. */
export function CategoriesModal({ kind, onClose }: { kind: LaunchKind; onClose: () => void }) {
  const categories = useExpenseLaunchStore((s) => s.categories);
  const createCategory = useExpenseLaunchStore((s) => s.createCategory);
  const updateCategoryName = useExpenseLaunchStore((s) => s.updateCategoryName);
  const deleteCategory = useExpenseLaunchStore((s) => s.deleteCategory);
  const setCategoryRate = useExpenseLaunchStore((s) => s.setCategoryRate);
  const [name, setName] = useState("");
  const [catKind, setCatKind] = useState<LaunchKind>(kind === "salary" ? "expense" : kind);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function submit() {
    if (!name.trim()) return;
    const err = await createCategory(name.trim(), catKind, false);
    if (err) toast.error(err);
    else {
      toast.success("Categoria criada");
      setName("");
    }
  }

  async function saveEdit() {
    if (!editingId || !editingName.trim()) return;
    const err = await updateCategoryName(editingId, editingName.trim());
    if (err) toast.error(err);
    else {
      toast.success("Categoria atualizada");
      setEditingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta categoria? Lançamentos já feitos com ela não são afetados.")) return;
    const err = await deleteCategory(id);
    if (err) toast.error(err);
    else toast.success("Categoria excluída");
  }

  return (
    <ModalShell title="Categorias e padrão de rateio" onClose={onClose}>
      <p className="mb-3 text-xs" style={{ color: C.muted }}>Cada categoria mantém seu destino. A recorrência pertence ao compromisso, não à categoria.</p>
      <div className="mb-4 max-h-64 overflow-auto">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 border-b py-3" style={{ borderColor: C.line }}>
            {editingId === c.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void saveEdit()}
                maxLength={70}
                className="flex-1 rounded-[10px] border px-3 py-2 text-sm"
                style={{ borderColor: C.line }}
              />
            ) : (
              <div>
                <strong className="text-sm" style={{ color: C.green }}>{c.name}</strong>
                <p className="text-xs" style={{ color: C.muted }}>{c.kind}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {c.kind === "expense" && editingId !== c.id && (
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={c.rateable} onChange={(e) => setCategoryRate(c.id, e.target.checked)} />
                  Rateável
                </label>
              )}
              {editingId === c.id ? (
                <>
                  <button onClick={() => void saveEdit()} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>Salvar</button>
                  <button onClick={() => setEditingId(null)} className="px-1.5 text-xs" style={{ color: C.muted }}>Cancelar</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(c.id); setEditingName(c.name); }} className="px-1.5 text-xs font-bold" style={{ color: C.green }}>Editar</button>
                  <button onClick={() => void remove(c.id)} className="px-1.5 text-xs font-bold" style={{ color: "#b3261e" }}>Excluir</button>
                </>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="py-3 text-sm" style={{ color: C.muted }}>Nenhuma categoria cadastrada ainda.</p>}
      </div>
      <h3 className="mb-2 font-bold" style={{ color: C.green }}>Nova categoria</h3>
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome *" maxLength={70} className={fieldCls} style={{ borderColor: C.line }} />
        <select value={catKind} onChange={(e) => setCatKind(e.target.value as LaunchKind)} className={fieldCls} style={{ borderColor: C.line }}>
          <option value="stock">Insumos e mercadorias</option>
          <option value="asset">Bens e investimentos</option>
          <option value="expense">Serviços e outras despesas</option>
          <option value="partner">Sócios e retiradas</option>
        </select>
      </div>
      <Button onClick={() => void submit()} className="mt-3">Criar categoria</Button>
    </ModalShell>
  );
}

/** Cadastrar item — equivalente a `itemModal()`. */
export function NewItemModal({ kind, onClose }: { kind: LaunchKind; onClose: () => void }) {
  const categories = useExpenseLaunchStore((s) => s.categories);
  const createCatalogItem = useExpenseLaunchStore((s) => s.createCatalogItem);
  const [name, setName] = useState("");
  const [itemKind, setItemKind] = useState<"asset" | "expense" | "partner">(kind === "salary" || kind === "stock" ? "expense" : kind);
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("un");
  const [price, setPrice] = useState("0");
  const [suggest, setSuggest] = useState(false);

  const categoryOptions = categories.filter((c) => c.kind === itemKind);

  async function submit() {
    if (!name.trim()) return;
    if (itemKind === "asset" && unit !== "un") {
      toast.error("Bens devem ser cadastrados por unidade.");
      return;
    }
    const err = await createCatalogItem({ name: name.trim(), kind: itemKind, categoryId, unit, suggestedPrice: Number(price), suggestRecurring: suggest });
    if (err) toast.error(err);
    else {
      toast.success("Item cadastrado");
      onClose();
    }
  }

  return (
    <ModalShell title="Cadastrar item" onClose={onClose}>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold">Nome *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Expositor de chão ou aluguel do depósito" className={fieldCls} style={{ borderColor: C.line }} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="text-xs"><span className="mb-1 block font-semibold">Tipo</span>
          <select value={itemKind} onChange={(e) => setItemKind(e.target.value as typeof itemKind)} className={fieldCls} style={{ borderColor: C.line }}>
            <option value="asset">Bens e investimentos</option><option value="expense">Serviços e outras despesas</option><option value="partner">Sócios e retiradas</option>
          </select>
        </label>
        <label className="text-xs"><span className="mb-1 block font-semibold">Categoria</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
            <option value="">Selecione</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs"><span className="mb-1 block font-semibold">Unidade</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldCls} style={{ borderColor: C.line }}>
            <option>un</option><option>kg</option><option>caixa</option><option>mês</option><option>serv.</option>
          </select>
        </label>
        <label className="text-xs"><span className="mb-1 block font-semibold">Valor sugerido (R$)</span>
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 rounded-[10px] p-3" style={{ background: "#f4f7f0" }}>
        <input type="checkbox" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} className="mt-0.5" />
        <span className="text-xs">Sugerir lançamento recorrente ao adicionar este item ao carrinho.</span>
      </label>
      <Button onClick={() => void submit()} className="mt-4">Salvar cadastro</Button>
    </ModalShell>
  );
}

/** Apurar remuneração do mês — equivalente a `salaryModal()`/`salaryPreview()`. */
export function SalaryApurationModal({
  employee,
  advancePaid,
  competence,
  onClose,
  onSave,
}: {
  employee: Employee;
  advancePaid: number;
  competence: string;
  onClose: () => void;
  onSave: (line: { extra: number; discount: number }) => void;
}) {
  const [extra, setExtra] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [confirmed, setConfirmed] = useState(false);
  const base = employee.salaryBase ?? 0;
  const net = base + Number(extra || 0) - Number(discount || 0) - advancePaid;

  function submit() {
    if (!confirmed) {
      toast.error("Confirme que conferiu a composição desta competência.");
      return;
    }
    if (net <= 0) {
      toast.error("Saldo não positivo. Revise os ajustes.");
      return;
    }
    onSave({ extra: Number(extra || 0), discount: Number(discount || 0) });
    onClose();
  }

  return (
    <ModalShell title="Apurar remuneração do mês" onClose={onClose}>
      <h3 className="mb-2 font-bold" style={{ color: C.green }}>{employee.name} · {competence.slice(0, 7)}</h3>
      <div className="mb-4 rounded-xl p-4" style={{ background: "#f3f7ee" }}>
        Remuneração-base: <strong>{brl(base)}</strong>
        <p className="text-xs" style={{ color: C.muted }}>Resolvida pela vigência vigente em Colaboradores.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="text-xs"><span className="mb-1 block font-semibold">Horas extras / adicionais (R$)</span>
          <input type="number" min={0} step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
        </label>
        <label className="text-xs"><span className="mb-1 block font-semibold">Outros descontos (R$)</span>
          <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
        </label>
      </div>
      <p className="mt-3 text-sm">Adiantamentos já pagos: <strong>{brl(advancePaid)}</strong></p>
      <div className="mt-3 rounded-xl p-4" style={{ background: "#f1f7ed", border: "1px solid #d7e5d2" }}>Saldo a pagar: <strong>{brl(net)}</strong></div>
      <label className="mt-4 flex items-start gap-2 rounded-[10px] p-3" style={{ background: "#f4f7f0" }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
        <span className="text-xs">Conferi a composição desta competência.</span>
      </label>
      <Button onClick={submit} className="mt-4 w-full">Adicionar apuração ao lançamento</Button>
    </ModalShell>
  );
}

/** Lançar vale / adiantamento — equivalente a `advanceModal()`. */
export function AdvanceModal({ employee, competence, onClose, onSave }: { employee: Employee; competence: string; onClose: () => void; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState("");

  function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    onSave(value);
    onClose();
  }

  return (
    <ModalShell title="Lançar vale / adiantamento" onClose={onClose}>
      <h3 className="mb-3 font-bold" style={{ color: C.green }}>{employee.name}</h3>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-xs font-semibold">Valor (R$) *</span>
        <input type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldCls} style={{ borderColor: C.line }} />
      </label>
      <p className="rounded-[10px] p-3 text-xs leading-relaxed" style={{ background: "#fff4d8", color: "#86682b" }}>
        O vale reduz o saldo salarial a pagar após a confirmação do pagamento — não duplica a despesa econômica da folha. Competência: {competence.slice(0, 7)}.
      </p>
      <Button onClick={submit} className="mt-4 w-full">Adicionar vale ao lançamento</Button>
    </ModalShell>
  );
}
