import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Archive, Repeat } from "lucide-react";
import { usePatrimonioStore } from "@/store/patrimonio-store";
import { useEmployeesStore } from "@/store/employees-store";
import { useDespesasStore } from "@/store/despesas-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_TONE: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-800",
  BAIXADO: "bg-ink-900/10 text-ink-muted",
};

function NewAssetForm({ onDone }: { onDone: () => void }) {
  const createAsset = usePatrimonioStore((s) => s.createAsset);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const expenses = useDespesasStore((s) => s.expenses);
  const fetchExpenses = useDespesasStore((s) => s.fetchAll);
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("OUTRO");
  const [acquisitionValue, setAcquisitionValue] = useState("");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [expenseId, setExpenseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  useEffect(() => {
    if (expenses.length === 0) fetchExpenses();
  }, [expenses.length, fetchExpenses]);

  const investmentExpenses = expenses.filter((e) => e.nature === "INVESTIMENTO");

  async function submit() {
    if (!modelName || !acquisitionValue) {
      toast.error("Preencha nome do bem e valor de aquisição");
      return;
    }
    setSaving(true);
    const err = await createAsset({
      modelName,
      category,
      acquisitionValue: Number(acquisitionValue),
      acquisitionDate: acquisitionDate || undefined,
      responsibleId: responsibleId || undefined,
      expenseId: expenseId || undefined,
      quantity: Number(quantity) || 1,
    });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Bem cadastrado");
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-forest-950/10 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Nome do bem
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Categoria
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Valor de aquisição
          <input type="number" value={acquisitionValue} onChange={(e) => setAcquisitionValue(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Data de aquisição
          <input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Responsável (opcional)
          <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">-----</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Despesa de aquisição (opcional)
          <select value={expenseId} onChange={(e) => setExpenseId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
            <option value="">-----</option>
            {investmentExpenses.map((e) => (
              <option key={e.id} value={e.id}>{e.description}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-900">
          Quantidade
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          <span className="text-xs text-ink-muted">Cria uma unidade individual por item (cada uma pode ter responsável e baixa próprios).</span>
        </label>
      </div>
      <Button onClick={() => void submit()} disabled={saving} className="self-start">
        {saving ? "Salvando..." : "Cadastrar bem"}
      </Button>
    </div>
  );
}

function AppropriateFromFormationCard() {
  const formationBalances = usePatrimonioStore((s) => s.formationBalances);
  const fetchFormationBalances = usePatrimonioStore((s) => s.fetchFormationBalances);
  const appropriateFromFormation = usePatrimonioStore((s) => s.appropriateFromFormation);
  const employees = useEmployeesStore((s) => s.employees);
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [modelName, setModelName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [responsibleId, setResponsibleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchFormationBalances();
  }, [fetchFormationBalances]);

  async function submit() {
    if (!categoryId || !modelName || !amount) {
      toast.error("Preencha categoria, nome do bem e valor a apropriar");
      return;
    }
    setSaving(true);
    const err = await appropriateFromFormation({
      categoryId,
      modelName,
      amount: Number(amount),
      quantity: Number(quantity) || 1,
      responsibleId: responsibleId || undefined,
    });
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Bem apropriado do saldo em formação — nenhuma nova saída foi criada");
    setModelName("");
    setAmount("");
    setQuantity("1");
    setOpen(false);
  }

  if (formationBalances.length === 0) return null;

  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-forest-950">Saldo em formação (vindo de Despesas)</p>
          <p className="text-xs text-ink-muted">Investimentos lançados em Despesas acumulam aqui até você apropriar o bem pronto. Apropriar não cria nova saída.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>Apropriar bem</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {formationBalances.map((f) => (
          <div key={f.categoryId} className="rounded-xl bg-white p-3">
            <p className="text-xs text-ink-muted">{f.categoryId}</p>
            <p className="font-bold text-forest-950">{brl(f.balance)}</p>
          </div>
        ))}
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Categoria
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
              <option value="">Selecione</option>
              {formationBalances.map((f) => <option key={f.categoryId} value={f.categoryId}>{f.categoryId} (saldo {brl(f.balance)})</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Nome do bem
            <input value={modelName} onChange={(e) => setModelName(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Valor a apropriar
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Quantidade
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-900">
            Responsável (opcional)
            <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
              <option value="">-----</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <Button onClick={() => void submit()} disabled={saving} className="self-end">{saving ? "Salvando..." : "Confirmar apropriação"}</Button>
        </div>
      )}
    </div>
  );
}

function VisaoGeralTab() {
  const assets = usePatrimonioStore((s) => s.assets);

  const metrics = useMemo(() => {
    const ativos = assets.filter((a) => a.status === "ATIVO");
    const valorAquisicao = ativos.reduce((s, a) => s + a.acquisitionValue, 0);
    const valorAtual = ativos.reduce((s, a) => s + (a.estimatedCurrentValue ?? a.acquisitionValue), 0);
    const byCategory = new Map<string, { count: number; value: number }>();
    ativos.forEach((a) => {
      const entry = byCategory.get(a.category) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += a.acquisitionValue;
      byCategory.set(a.category, entry);
    });
    return { ativosCount: ativos.length, baixadosCount: assets.length - ativos.length, valorAquisicao, valorAtual, categories: [...byCategory.entries()] };
  }, [assets]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Bens ativos</p><p className="text-lg font-extrabold text-forest-950">{metrics.ativosCount}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Baixados</p><p className="text-lg font-extrabold text-ink-muted">{metrics.baixadosCount}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Valor de aquisição (ativos)</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.valorAquisicao)}</p></div>
        <div className="rounded-2xl border border-forest-950/10 bg-white p-4"><p className="text-xs text-ink-muted">Valor estimado atual</p><p className="text-lg font-extrabold text-forest-950">{brl(metrics.valorAtual)}</p></div>
      </div>

      <AppropriateFromFormationCard />

      <div className="rounded-3xl border border-forest-950/10 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-forest-950">Por categoria</p>
        {metrics.categories.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum bem ativo.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {metrics.categories.map(([cat, data]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-ink-700">{cat} ({data.count})</span>
                <span className="font-semibold text-ink-900">{brl(data.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PatrimonioPage() {
  const assets = usePatrimonioStore((s) => s.assets);
  const movements = usePatrimonioStore((s) => s.movements);
  const status = usePatrimonioStore((s) => s.status);
  const fetchAll = usePatrimonioStore((s) => s.fetchAll);
  const writeOffAsset = usePatrimonioStore((s) => s.writeOffAsset);
  const transferResponsible = usePatrimonioStore((s) => s.transferResponsible);
  const employees = useEmployeesStore((s) => s.employees);
  const fetchEmployees = useEmployeesStore((s) => s.fetchEmployees);
  const [tab, setTab] = useState<"visao" | "lista">("visao");
  const [showForm, setShowForm] = useState(false);
  const [writeOffModal, setWriteOffModal] = useState<string | null>(null);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees.length, fetchEmployees]);

  async function handleWriteOff() {
    if (!writeOffModal || writeOffReason.trim().length < 5) {
      toast.error("Informe um motivo (mínimo 5 caracteres)");
      return;
    }
    setSaving(true);
    const err = await writeOffAsset(writeOffModal, writeOffReason.trim());
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Bem baixado");
    setWriteOffModal(null);
    setWriteOffReason("");
  }

  async function handleTransfer() {
    if (!transferModal || !transferTarget) {
      toast.error("Escolha o novo responsável");
      return;
    }
    setSaving(true);
    const err = await transferResponsible(transferModal, transferTarget, transferReason.trim());
    setSaving(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Responsável atualizado");
    setTransferModal(null);
    setTransferTarget("");
    setTransferReason("");
  }

  const MOVEMENT_LABELS: Record<string, string> = { BAIXA: "Baixa", TRANSFERENCIA_RESPONSAVEL: "Transferência de responsável" };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-950">Patrimônio</h1>
          <p className="text-sm text-ink-muted">Cadastro de bens da empresa e seus responsáveis.</p>
        </div>
        {tab === "lista" && (
          <Button className="w-full sm:w-auto" onClick={() => setShowForm((v) => !v)}>
            <Plus size={18} /> Novo bem
          </Button>
        )}
      </div>

      <div className="flex gap-2 rounded-xl bg-forest-950/5 p-1 w-fit">
        {[
          ["visao", "Visão Geral"],
          ["lista", "Lista"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value as "visao" | "lista")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-forest-950 shadow-sm" : "text-ink-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visao" ? (
        <VisaoGeralTab />
      ) : (
        <>
          {showForm && <NewAssetForm onDone={() => setShowForm(false)} />}

          {status === "loading" && assets.length === 0 ? (
            <AdminState variant="loading" message="Carregando patrimônio..." />
          ) : status === "error" ? (
            <AdminState variant="error" message="Não foi possível carregar o patrimônio." />
          ) : assets.length === 0 ? (
            <AdminState variant="empty" message="Nenhum bem cadastrado ainda." />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-forest-950/10 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-forest-950/10 text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3">Bem</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Despesa de aquisição</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const assetMovements = movements.filter((m) => m.assetUnitId === a.id);
                    const isExpanded = expandedAsset === a.id;
                    return (
                      <Fragment key={a.id}>
                        <tr className="border-b border-forest-950/5 last:border-none hover:bg-forest-950/5">
                          <td className="px-4 py-3 font-semibold text-ink-900">{a.modelName}</td>
                          <td className="px-4 py-3 text-ink-700/70">{a.category}</td>
                          <td className="px-4 py-3 font-semibold text-ink-900">{brl(a.acquisitionValue)}</td>
                          <td className="px-4 py-3 text-ink-700/70">{a.responsibleName ?? "-----"}</td>
                          <td className="px-4 py-3 text-ink-700/70">
                            {a.expenseId ? (
                              <Link to="/admin/despesas" className="hover:underline">
                                {a.expenseDescription ?? "Ver despesa"}
                              </Link>
                            ) : (
                              "-----"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[a.status]}`}>{a.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {a.status !== "BAIXADO" && (
                                <>
                                  <button
                                    onClick={() => { setTransferModal(a.id); setTransferTarget(""); setTransferReason(""); }}
                                    aria-label="Transferir responsável"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
                                  >
                                    <Repeat size={16} />
                                  </button>
                                  <button
                                    onClick={() => { setWriteOffModal(a.id); setWriteOffReason(""); }}
                                    aria-label="Dar baixa no bem"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-red-700 hover:bg-red-50"
                                  >
                                    <Archive size={16} />
                                  </button>
                                </>
                              )}
                              {assetMovements.length > 0 && (
                                <button onClick={() => setExpandedAsset(isExpanded ? null : a.id)} className="text-xs font-semibold text-forest-800 hover:underline">
                                  {isExpanded ? "Ocultar" : "Histórico"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-forest-950/5 bg-forest-950/5">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                {assetMovements.map((m) => (
                                  <div key={m.id} className="rounded-xl bg-white p-2 text-xs">
                                    <span className="font-semibold text-ink-900">{MOVEMENT_LABELS[m.type] ?? m.type}</span>
                                    <span className="ml-2 text-ink-muted">{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                                    {m.notes && <p className="mt-1 text-ink-700">{m.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {writeOffModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Dar baixa no bem</h2>
            <textarea
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              placeholder="Motivo da baixa (mínimo 5 caracteres)"
              className="w-full rounded-xl border border-ink-900/15 p-3 text-sm"
              rows={3}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setWriteOffModal(null)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={saving} onClick={() => void handleWriteOff()}>{saving ? "Salvando..." : "Confirmar baixa"}</Button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 className="mb-3 text-lg font-extrabold text-forest-950">Transferir responsável</h2>
            <label className="flex flex-col gap-1 text-sm text-ink-900">
              Novo responsável
              <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)} className="h-11 rounded-xl border border-ink-900/15 px-3 text-sm">
                <option value="">-----</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Observação (opcional)"
              className="mt-3 w-full rounded-xl border border-ink-900/15 p-3 text-sm"
              rows={2}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setTransferModal(null)} className="rounded-lg border border-ink-900/15 px-4 py-2 text-sm font-semibold">Cancelar</button>
              <Button disabled={saving} onClick={() => void handleTransfer()}>{saving ? "Salvando..." : "Transferir"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
