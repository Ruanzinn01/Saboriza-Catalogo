import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useCatalogStore } from "@/store/catalog-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import { AdminState } from "@/components/admin/AdminState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SupplierBankSection } from "@/components/admin/fornecedores/form/SupplierBankSection";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import {
  EVENT_LABELS,
  emptyBankInput,
  fetchFinanceSummary,
  fetchSupplierContacts,
  listFiles,
  listSupplierEvents,
  signedFileUrl,
  type SupplierEvent,
  type SupplierFile,
} from "@/lib/supplier-api";
import {
  agoLabel,
  daysBetween,
  type FinancialSummary,
  formatBrl,
  formatDateBr,
  monthLabel,
  PERIOD_LABELS,
  periodRange,
  purchaseStateLabel,
  type SupplierPeriod,
  todayInZone,
} from "@/lib/supplier-finance";
import { PAYMENT_TERMS, supplierMapsUrl } from "@/lib/supplier-form";
import { getSupplierDisplayName } from "@/lib/supplier-display";
import type { Supplier, SupplierContact } from "@/types/supplier";

type FinanceState = { kind: "restricted" } | { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; data: FinancialSummary };
type DetailTab = "compras" | "itens" | "documentos" | "historico";

const PERIODS = Object.keys(PERIOD_LABELS) as SupplierPeriod[];
const KIND_LABELS: Record<string, { label: string; note: string }> = {
  stock: { label: "Compras para estoque", note: "Não equivalem automaticamente ao custo vendido." },
  expense: { label: "Serviços e despesas", note: "Reconhecimento conforme competência e classificação." },
  asset: { label: "Bens e investimentos", note: "Destino patrimonial; não despesa integral automática." },
};

function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-forest-950/5 py-1.5 text-sm last:border-none">
      <span className="text-ink-700/70">{label}</span>
      <strong className="text-right text-ink-900">{value}</strong>
    </div>
  );
}

function Unavailable({ state }: { state: FinanceState }) {
  const text =
    state.kind === "restricted"
      ? "Acesso restrito: seu perfil não inclui a posição financeira de fornecedores."
      : state.kind === "loading"
        ? "Carregando..."
        : "Fonte indisponível: não foi possível ler Compras e Contas a Pagar. Nenhum valor é exibido.";
  return <p className="text-sm text-ink-muted">{text}</p>;
}

export function SupplierDetailPage() {
  const { supplierId } = useParams();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.includes(params.get("periodo") as SupplierPeriod) ? params.get("periodo") : "six") as SupplierPeriod;
  const tab = (["compras", "itens", "documentos", "historico"].includes(params.get("aba") ?? "") ? params.get("aba") : "compras") as DetailTab;

  const suppliers = useSuppliersStore((state) => state.suppliers);
  const status = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const setActive = useSuppliersStore((state) => state.setActive);
  const products = useCatalogStore((state) => state.products);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const permissionsStatus = useSupplierPermissionsStore((state) => state.status);
  const loadPermissions = useSupplierPermissionsStore((state) => state.load);

  const [expanded, setExpanded] = useState(false);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [finance, setFinance] = useState<FinanceState>({ kind: "loading" });
  const [events, setEvents] = useState<SupplierEvent[] | null>(null);
  const [files, setFiles] = useState<SupplierFile[] | null>(null);
  const [confirmActive, setConfirmActive] = useState(false);
  const [showTitles, setShowTitles] = useState(false);
  const [itemOpen, setItemOpen] = useState<FinancialSummary["items"][number] | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => {
    if (suppliers.length === 0) void fetchSuppliers();
    if (products.length === 0) void fetchCatalog();
    if (categoriesStatus === "idle") void fetchCategories();
    if (permissionsStatus === "idle") void loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supplier = suppliers.find((item) => item.id === supplierId);
  const range = useMemo(() => periodRange(period, todayInZone()), [period]);

  useEffect(() => {
    if (!supplierId) return;
    void fetchSupplierContacts(supplierId).then(setContacts);
  }, [supplierId]);

  const loadFinance = useCallback(async () => {
    if (!supplierId || (permissionsStatus !== "ready" && permissionsStatus !== "error")) return;
    if (!permissions["fornecedores.financeiro"]) {
      setFinance({ kind: "restricted" });
      return;
    }
    setFinance({ kind: "loading" });
    const { data, error } = await fetchFinanceSummary(supplierId, range.from, range.to);
    setFinance(error || !data ? { kind: "unavailable" } : { kind: "ready", data });
  }, [supplierId, permissions, permissionsStatus, range]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  useEffect(() => {
    if (!supplierId || permissionsStatus !== "ready") return;
    if (permissions["fornecedores.read"]) void listSupplierEvents(supplierId).then(setEvents);
    if (permissions["fornecedores.anexos"]) void listFiles({ supplierId }).then(setFiles);
  }, [supplierId, permissions, permissionsStatus]);

  function setParam(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  }

  const categoryNames = useMemo(
    () => (linksBySupplier.get(supplierId ?? "") ?? []).map((id) => categories.find((c) => c.id === id)?.name).filter((name): name is string => Boolean(name)),
    [linksBySupplier, categories, supplierId]
  );
  const supplierProducts = useMemo(() => products.filter((p) => p.supplierId === supplierId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [products, supplierId]);

  if (status === "loading" && !supplier) return <AdminState variant="loading" message="Carregando fornecedor..." />;
  if (!supplier) return <AdminState variant="empty" message="Fornecedor não encontrado." />;

  const asOf = finance.kind === "ready" ? finance.data.as_of : todayInZone();
  const fin = finance.kind === "ready" ? finance.data : null;
  const periodText = `${PERIOD_LABELS[period]}${range.from ? ` · ${formatDateBr(range.from)} a ${formatDateBr(asOf)}` : ""}`;

  async function openFile(file: SupplierFile) {
    const url = await signedFileUrl(file.storagePath);
    if (!url) toast.error("Não foi possível abrir o arquivo.");
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/fornecedores" className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-ink-700/70 hover:text-ink-900">
        <ArrowLeft size={16} /> Voltar para fornecedores
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">Ficha do fornecedor</p>
          <h1 className="break-words text-2xl font-extrabold text-forest-950">{getSupplierDisplayName(supplier)}</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {permissions["fornecedores.manage"] && (
            <>
              <Link to={`/admin/fornecedores/${supplier.id}/editar`}>
                <Button variant="outline" className="min-h-11 w-full sm:w-auto">
                  <Pencil size={16} /> Alterar cadastro
                </Button>
              </Link>
              <Button variant="outline" className="min-h-11" onClick={() => setConfirmActive(true)}>
                {supplier.active ? "Inativar cadastro" : "Reativar cadastro"}
              </Button>
            </>
          )}
          <Link to={`/admin/despesas/nova?fornecedor=${supplier.id}`}>
            <Button className="min-h-11 w-full sm:w-auto">
              <Plus size={16} /> Nova compra / despesa
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-auto text-xs text-ink-muted">Posição em {formatDateBr(asOf)}</span>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
          Período
          <select
            value={period}
            aria-label="Período"
            onChange={(e) => setParam({ periodo: e.target.value === "six" ? "" : e.target.value })}
            className="h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <IdentityCard supplier={supplier} categoryNames={categoryNames} contacts={contacts} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />

          <Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Recent label="Última compra" big={fin ? agoLabel(fin.purchased.last_purchase_on, asOf) : "—"} sub={fin ? (fin.purchased.last_purchase_on ? formatDateBr(fin.purchased.last_purchase_on) : "Sem compra confirmada") : "Indisponível"} />
              <Recent
                label="Último pagamento"
                big={fin ? agoLabel(fin.paid.last_payment_on, asOf) : "—"}
                sub={fin ? (fin.paid.last_payment_on ? `${formatDateBr(fin.paid.last_payment_on)} · ${formatBrl(fin.paid.last_payment_cents ?? 0)}` : "Sem baixa confirmada") : "Indisponível"}
              />
              <Recent label="Prazo médio real" big={fin ? (fin.terms.effective_avg_days === null ? "—" : `${fin.terms.effective_avg_days} dias`) : "—"} sub="Emissão → pagamento · ponderado por valor" />
            </div>
            {!fin && <Unavailable state={finance} />}
          </Card>

          <Card title="Compras ao longo do período">
            {fin ? (
              <>
                <div className="flex flex-wrap gap-4 text-xs text-ink-700">
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2.5 w-2.5 rounded-full bg-forest-600" /> Compras confirmadas
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2.5 w-2.5 rounded-full bg-gold-500" /> Pagamentos por data da baixa
                  </span>
                </div>
                <MonthlyChart data={fin.monthly} />
                <p className="text-xs text-ink-muted">Cada barra tem sua própria data: compra e pagamento não precisam ocorrer no mesmo mês.</p>
              </>
            ) : (
              <Unavailable state={finance} />
            )}
          </Card>

          <section className="flex flex-col gap-3 rounded-3xl border border-forest-950/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-forest-950">Compras e documentos</h2>
              {fin && <span className="text-xs text-ink-muted">{fin.purchased.count} confirmadas</span>}
            </div>
            <div role="tablist" aria-label="Compras e documentos" className="flex gap-1 overflow-x-auto rounded-2xl bg-forest-950/5 p-1">
              {(
                [
                  ["compras", "Compras"],
                  ["itens", "Itens comprados"],
                  ["documentos", "Documentos"],
                  ["historico", "Histórico"],
                ] as [DetailTab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setParam({ aba: key === "compras" ? "" : key })}
                  className={cn("min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold", tab === key ? "bg-white text-forest-950 shadow-sm" : "text-ink-700 hover:bg-white/60")}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "compras" && (fin ? <PurchasesList data={fin} /> : <Unavailable state={finance} />)}
            {tab === "itens" && (fin ? <ItemsRanking data={fin} all={showAllItems} onToggle={() => setShowAllItems((v) => !v)} onOpen={setItemOpen} /> : <Unavailable state={finance} />)}
            {tab === "documentos" && (
              <div className="flex flex-col gap-2 text-sm">
                <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">Documentos de compra pertencem aos lançamentos de origem. Anexos cadastrais pertencem ao fornecedor.</p>
                {files === null ? (
                  <p className="text-ink-muted">{permissions["fornecedores.anexos"] ? "Arquivos indisponíveis agora." : "Seu perfil não inclui anexos de fornecedores."}</p>
                ) : files.length === 0 ? (
                  <p className="text-ink-muted">Nenhum anexo cadastral. Nenhum comprovante é apresentado sem arquivo real.</p>
                ) : (
                  files.map((file) => (
                    <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/5 py-2">
                      <span className="min-w-0 break-words">
                        {file.fileName} <span className="text-xs text-ink-muted">· {file.kind === "FOTO" ? "foto" : file.kind === "DOCUMENTO" ? "documento" : "referência"} · {formatDateBr(file.uploadedAt)}</span>
                      </span>
                      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void openFile(file)}>
                        Abrir
                      </Button>
                    </div>
                  ))
                )}
                {fin && fin.purchases.filter((p) => p.counted).slice(0, 5).map((p) => (
                  <div key={p.launch_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/5 py-2">
                    <span>
                      <strong>{p.document_ref || "Sem número"}</strong> <span className="text-xs text-ink-muted">· {formatDateBr(p.day)}</span>
                    </span>
                    <Link to="/admin/despesas" className="min-h-11 text-sm font-semibold text-forest-800 hover:underline">
                      Ver origem →
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {tab === "historico" && <HistoryTab events={events} readAllowed={permissions["fornecedores.read"]} />}
          </section>

          <Card title={supplier.supplyType === "Serviços" ? "Serviços mais contratados" : "Produtos e insumos mais comprados"} action={<span className="text-[11px] text-ink-muted">Por valor dos itens</span>}>
            {fin ? <ItemsRanking data={fin} all={showAllItems} onToggle={() => setShowAllItems((v) => !v)} onOpen={setItemOpen} /> : <Unavailable state={finance} />}
          </Card>

          <Card title="Classificação e rastreabilidade">
            {fin ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Object.entries(KIND_LABELS).map(([kind, info]) => (
                  <div key={kind} className="rounded-2xl bg-forest-950/5 p-3">
                    <p className="text-xs text-ink-muted">{info.label}</p>
                    <p className="text-lg font-extrabold text-forest-950">{formatBrl(fin.by_kind?.[kind] ?? 0)}</p>
                    <p className="text-xs text-ink-muted">{info.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Unavailable state={finance} />
            )}
            <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">Esta ficha consulta Compras e Despesas e o Financeiro. Não cria outra despesa quando você abre ou consulta um pagamento.</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/despesas">
                <Button variant="outline" size="sm" className="min-h-11">
                  Ver lançamentos de origem
                </Button>
              </Link>
            </div>
          </Card>

          <SupplierBankSection supplierId={supplier.id} value={emptyBankInput} onChange={() => undefined} onDirty={() => undefined} readOnly />

          <Card title="Produtos vinculados ao cadastro">
            {supplierProducts.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum produto vinculado a este fornecedor.</p>
            ) : (
              <div className="flex flex-col divide-y divide-forest-950/5">
                {supplierProducts.map((product) => (
                  <Link key={product.id} to={`/admin/produtos/${product.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-forest-950/5">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {product.presentation} · {product.weight}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-ink-900">{formatCurrency(product.unitPrice)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card title="Resumo de compras">
            <p className="text-xs text-ink-muted">{periodText}</p>
            {fin ? (
              <>
                <p className="text-2xl font-extrabold text-forest-950">{formatBrl(fin.purchased.total_cents)}</p>
                <Row label="Compras confirmadas" value={fin.purchased.count} />
                <Row label="Valor médio por compra" value={fin.purchased.avg_cents === null ? "—" : formatBrl(fin.purchased.avg_cents)} />
                <Row label="Posição entre fornecedores" value={fin.purchased.rank === null ? "Sem posição" : `${fin.purchased.rank}º de ${fin.purchased.ranked_suppliers}`} />
                <Row label="Comprado em todo o histórico" value={formatBrl(fin.purchased.all_time_cents)} />
                <p className="text-[11px] text-ink-muted">Comprado = lançamentos confirmados (itens + frete − desconto) pela data de emissão do documento. Rascunhos ficam fora.</p>
              </>
            ) : (
              <Unavailable state={finance} />
            )}
          </Card>

          <Card title="Pagamentos realizados">
            <p className="text-xs text-ink-muted">{PERIOD_LABELS[period]} · por data da baixa</p>
            {fin ? (
              <>
                <p className="text-2xl font-extrabold text-forest-950">{formatBrl(fin.paid.period_cents)}</p>
                <Row label="Pago em todo o histórico" value={formatBrl(fin.paid.all_time_cents)} />
                <Row label="Prazo médio contratado" value={fin.terms.contracted_avg_days === null ? "—" : `${fin.terms.contracted_avg_days} dias`} />
                <Row label="Prazo médio real de pagamento" value={fin.terms.effective_avg_days === null ? "—" : `${fin.terms.effective_avg_days} dias`} />
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-forest-950/5 p-3 text-center">
                  <div>
                    <strong className="block text-lg text-forest-800">{fin.punctuality.pct === null ? "—" : `${fin.punctuality.pct}%`}</strong>
                    <small className="text-[10px] text-ink-muted">quitados em dia</small>
                  </div>
                  <div>
                    <strong className="block text-lg text-ink-900">{fin.punctuality.on_time}</strong>
                    <small className="text-[10px] text-ink-muted">no prazo</small>
                  </div>
                  <div>
                    <strong className="block text-lg text-gold-600">{fin.punctuality.late}</strong>
                    <small className="text-[10px] text-ink-muted">com atraso</small>
                  </div>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Base: {fin.punctuality.settled} título(s) quitado(s) no período{fin.punctuality.settled === 0 ? " (sem histórico: nunca 100%)" : ""}. Mede como a nossa empresa pagou, não a entrega do fornecedor. Estornos, juros e
                  baixas parciais ainda não têm fonte e não entram.
                </p>
              </>
            ) : (
              <Unavailable state={finance} />
            )}
          </Card>

          <Card title="Boletos e títulos em aberto">
            <p className="text-xs text-ink-muted">Posição atual · todos os períodos</p>
            {fin ? (
              <>
                <p className="text-2xl font-extrabold text-forest-950">{formatBrl(fin.open.total_cents)}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-ink-muted">Vencidos</span>
                    <strong className="block text-red-700">{formatBrl(fin.open.overdue_cents)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-ink-muted">A vencer / hoje</span>
                    <strong className="block text-ink-900">{formatBrl(fin.open.total_cents - fin.open.overdue_cents)}</strong>
                  </div>
                </div>
                {fin.open.titles.slice(0, 3).map((title) => (
                  <TitleRow key={title.expense_id} title={title} asOf={asOf} />
                ))}
                {fin.open.count === 0 && <p className="text-sm text-ink-muted">Sem títulos em aberto.</p>}
                {fin.open.count > 3 && (
                  <button type="button" onClick={() => setShowTitles(true)} className="min-h-11 text-left text-sm font-semibold text-forest-800 hover:underline">
                    Ver todos os {fin.open.count} títulos →
                  </button>
                )}
                <p className="text-[11px] text-ink-muted">Agendado não significa pago. A baixa depende da confirmação do fluxo financeiro.</p>
              </>
            ) : (
              <Unavailable state={finance} />
            )}
          </Card>

          <Card title="Condições de fornecimento">
            <Row label="Prazo preferencial informado" value={PAYMENT_TERMS.find((t) => t.value === supplier.paymentTerms)?.label ?? "Não definido"} />
            <Row label="Forma preferencial" value={supplier.paymentMethod || "Não definida"} />
            <Row label="Entrega usual" value={supplier.leadTimeDays === null ? "Não informada" : `${supplier.leadTimeDays} dias`} />
            <Row label="Limite informado pelo fornecedor" value={supplier.creditLimitCents > 0 ? formatBrl(supplier.creditLimitCents) : "Não informado"} />
            <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">Limite é uma referência da negociação. Não equivale a adiantamento, crédito a compensar ou autorização de pagamento.</p>
          </Card>

          <Card title="Adiantamentos e créditos">
            <p className="text-sm font-semibold text-ink-700">Indisponível</p>
            <p className="text-xs text-ink-muted">Ainda não existe registro de adiantamentos e créditos de fornecedor no sistema. Por isso nenhum valor (nem zero) é exibido. A compensação deverá apontar para o lançamento original.</p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmActive}
        onClose={() => setConfirmActive(false)}
        title={supplier.active ? "Inativar este cadastro?" : "Reativar este cadastro?"}
        description={
          supplier.active
            ? "O fornecedor deixa de aparecer na escolha em Compras e Despesas. Histórico, compras, títulos e vínculos são preservados; você pode reativar quando quiser."
            : "O fornecedor volta a aparecer na escolha em Compras e Despesas."
        }
        confirmLabel={supplier.active ? "Inativar" : "Reativar"}
        onConfirm={() => {
          setConfirmActive(false);
          void setActive(supplier.id, !supplier.active, supplier.revision);
        }}
      />

      {showTitles && fin && (
        <div role="dialog" aria-modal="true" aria-label="Títulos em aberto" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-forest-950">Títulos em aberto · posição atual</h2>
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => setShowTitles(false)}>
                Fechar
              </Button>
            </div>
            <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">
              {fin.open.count} títulos · {formatBrl(fin.open.total_cents)} em aberto. Independe do filtro de compras. Não há ação de pagar nesta ficha.
            </p>
            {fin.open.titles.map((title) => (
              <TitleRow key={title.expense_id} title={title} asOf={asOf} />
            ))}
            {fin.open.count > fin.open.titles.length && <p className="text-xs text-ink-muted">Mostrando os {fin.open.titles.length} primeiros por vencimento.</p>}
          </div>
        </div>
      )}

      {itemOpen && (
        <div role="dialog" aria-modal="true" aria-label={`Histórico de preços de ${itemOpen.name}`} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-forest-950">{itemOpen.name}</h2>
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => setItemOpen(null)}>
                Fechar
              </Button>
            </div>
            <p className="text-xs text-ink-muted">Histórico de preço unitário do mesmo item na unidade “{itemOpen.unit}”, por compra. Não compara apresentações ou unidades diferentes. Preço do item sem o frete do documento.</p>
            {itemOpen.history.map((point) => (
              <Row key={`${point.day}-${point.unit_price}`} label={formatDateBr(point.day)} value={`${formatBrl(Math.round(point.unit_price * 100))} / ${itemOpen.unit}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Recent({ label, big, sub }: { label: string; big: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-forest-950/5 p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{label}</span>
      <strong className="text-lg text-forest-950">{big}</strong>
      <span className="text-xs text-ink-muted">{sub}</span>
    </div>
  );
}

function IdentityCard({ supplier, categoryNames, contacts, expanded, onToggle }: { supplier: Supplier; categoryNames: string[]; contacts: SupplierContact[]; expanded: boolean; onToggle: () => void }) {
  const doc = supplier.cnpj || "Documento não informado";
  const full: [string, string][] = [
    ["Razão social", supplier.companyName],
    [supplier.personType === "PF" ? "CPF" : "CNPJ", doc],
    ["Inscrição estadual", supplier.stateExempt ? "Isento" : supplier.ie || "Não informada"],
    ["Enquadramento informado", supplier.taxProfile || "Não informado"],
    ["Município IBGE", supplier.ibgeCode || "Não informado"],
    ["E-mail de pedidos", supplier.salesEmail || "Não informado"],
    ["E-mail de notas/XML", supplier.invoiceEmail || "Não informado"],
    ["Site", supplier.website || "Não informado"],
    ["Código no fornecedor", supplier.externalCustomerCode || "Não informado"],
    ["Prazo usual de entrega", supplier.leadTimeDays === null ? "Não informado" : `${supplier.leadTimeDays} dias`],
    ["Pedido mínimo informado", formatBrl(supplier.minimumOrderCents)],
    ["Frete usual", supplier.freightTerms || "A combinar"],
    ["Tipo de fornecimento", supplier.supplyType || "Não definido"],
    ["Centro de custo preferencial", supplier.costCenter || "Não definido"],
    ["Origem do relacionamento", supplier.origin || "Não informada"],
    ["Observações", supplier.serviceNotes || "Não informadas"],
    ["Orientações de entrega/retirada", supplier.receivingNotes || "Não informadas"],
    ["Complemento / referência", [supplier.complement, supplier.referenceNote].filter(Boolean).join(" · ") || "Não informados"],
    ["Ponto no mapa", supplier.latitude !== null && supplier.longitude !== null ? `${supplier.latitude}, ${supplier.longitude}${supplier.locationConfirmedAt ? " · conferido" : " · não conferido"}` : "Não informado"],
    ["Cadastrado em", formatDateBr(supplier.createdAt)],
  ];
  const digits = supplier.phone.replace(/\D/g, "");
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">Dados do fornecedor</p>
        <h2 className="break-words text-2xl font-extrabold text-forest-950">{getSupplierDisplayName(supplier)}</h2>
        <p className="break-words text-sm text-ink-muted">
          {supplier.companyName} — {doc}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", supplier.active ? "bg-forest-700/15 text-forest-800" : "bg-gold-400/30 text-forest-950")}>{supplier.active ? "Cadastro ativo" : "Cadastro inativo"}</span>
          {categoryNames.length === 0 ? <span className="text-xs text-ink-muted">Sem categoria</span> : categoryNames.map((name) => <span key={name} className="rounded-full bg-forest-950/5 px-3 py-1 text-xs font-semibold text-ink-700">{name}</span>)}
          <span className="text-xs text-ink-muted">Comprador: {supplier.buyerName || "Não definido"}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex gap-2">
            <Phone size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
            <span>
              <strong>{supplier.phone || "Telefone não informado"}</strong>
              <br />
              <span className="text-xs text-ink-muted">
                {supplier.name || "Contato não informado"} · {supplier.contactRole || "Função não informada"}
              </span>
              {digits && supplier.contactWhatsapp && (
                <>
                  <br />
                  <a className="inline-flex min-h-11 items-center text-xs font-semibold text-forest-800 hover:underline" href={`https://wa.me/55${digits}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp ↗
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <Mail size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
            <span className="break-all">{supplier.email || "E-mail não informado"}</span>
          </div>
          {contacts.map((contact, index) => (
            <div key={index} className="rounded-xl bg-forest-950/5 p-3 text-xs">
              <strong className="text-sm text-ink-900">{contact.name || "Contato"}</strong> · {contact.role || "Função não informada"}
              <br />
              {contact.phone} {contact.email && `· ${contact.email}`}
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          <MapPin size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <span>
            <strong>{[supplier.address, supplier.streetNumber].filter(Boolean).join(", ") || "Endereço não informado"}</strong>
            <br />
            <span className="text-xs text-ink-muted">
              {supplier.neighborhood} {supplier.neighborhood && "· "}
              {supplier.city} / {supplier.state} {supplier.cep && `· ${supplier.cep}`}
            </span>
            <br />
            <a href={supplierMapsUrl(supplier)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-forest-800 hover:underline">
              Ver localização ↗
            </a>
          </span>
        </div>
      </div>
      {expanded && (
        <dl className="grid grid-cols-1 gap-3 border-t border-forest-950/10 pt-4 sm:grid-cols-2">
          {full.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="break-words text-sm font-semibold text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-forest-950/5 text-sm font-semibold text-forest-800 hover:bg-forest-950/10">
        {expanded ? (
          <>
            Recolher cadastro <ChevronUp size={14} />
          </>
        ) : (
          <>
            Ver cadastro completo <ChevronDown size={14} />
          </>
        )}
      </button>
    </section>
  );
}

function MonthlyChart({ data }: { data: FinancialSummary["monthly"] }) {
  if (data.length === 0) return <p className="text-sm text-ink-muted">Sem meses no período.</p>;
  const W = 760;
  const H = 240;
  const left = 56;
  const bottom = 190;
  const top = 20;
  const max = Math.max(1, ...data.flatMap((d) => [d.purchased_cents, d.paid_cents])) * 1.12;
  const step = (W - left - 15) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Compras e pagamentos por mês" className="min-w-[520px]">
        {[0, 1, 2, 3].map((i) => {
          const y = bottom - ((bottom - top) * i) / 3;
          return (
            <g key={i}>
              <line x1={left} y1={y} x2={W - 15} y2={y} stroke="#e4e9db" strokeDasharray="4 5" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#8b987c">
                {Math.round((max * i) / 3 / 100000)} mil
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const center = left + (i + 0.5) * step;
          const bw = Math.min(23, step * 0.28);
          return (
            <g key={d.month}>
              {(
                [
                  ["purchased_cents", "#40825a", -bw - 3, "Comprado"],
                  ["paid_cents", "#c3a34d", 3, "Pago"],
                ] as const
              ).map(([key, color, dx, label]) => {
                const h = (d[key] / max) * (bottom - top);
                return (
                  <rect key={key} x={center + dx} y={bottom - h} width={bw} height={Math.max(2, h)} rx={4} fill={color}>
                    <title>{`${monthLabel(d.month)} · ${label}: ${formatBrl(d[key])}`}</title>
                  </rect>
                );
              })}
              <text x={center} y={212} fontSize="11" fill="#849178" textAnchor="middle">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PurchasesList({ data }: { data: FinancialSummary }) {
  const [all, setAll] = useState(false);
  const list = all ? data.purchases : data.purchases.slice(0, 6);
  if (data.purchases.length === 0) return <p className="text-sm text-ink-muted">Nenhuma compra neste período.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">Confirmadas entram no comprado. Rascunhos ficam identificados, fora do total.</p>
      {list.map((p) => (
        <div key={p.launch_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-forest-950/5 py-2 text-sm">
          <div>
            <strong className="text-ink-900">{p.document_ref || "Sem número"}</strong>
            <p className="text-xs text-ink-muted">{formatDateBr(p.day)}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", p.counted ? "bg-forest-700/15 text-forest-800" : "bg-gold-400/30 text-forest-950")}>{purchaseStateLabel(p.state)}</span>
          <div className="text-right">
            <strong>{formatBrl(p.total_cents)}</strong>
            <p className="text-xs text-ink-muted">{p.counted ? "Valor líquido da compra" : "Fora dos totais"}</p>
          </div>
        </div>
      ))}
      {data.purchases.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="min-h-11 text-left text-sm font-semibold text-forest-800 hover:underline">
          {all ? "Mostrar resumo" : `Ver todas as ${data.purchases.length} compras →`}
        </button>
      )}
    </div>
  );
}

function ItemsRanking({ data, all, onToggle, onOpen }: { data: FinancialSummary; all: boolean; onToggle: () => void; onOpen: (item: FinancialSummary["items"][number]) => void }) {
  const total = data.items.reduce((sum, item) => sum + item.value_cents, 0);
  const list = all ? data.items : data.items.slice(0, 6);
  if (data.items.length === 0) return <p className="text-sm text-ink-muted">Nenhum item comprado neste período.</p>;
  return (
    <div className="flex flex-col gap-3">
      {list.map((item, index) => (
        <div key={`${item.name}-${item.unit}`} className="flex items-center gap-3 text-sm">
          <span className="w-8 shrink-0 text-xs font-bold text-ink-muted">{index + 1}º</span>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onOpen(item)} className="min-h-11 break-words text-left font-semibold text-forest-800 hover:underline">
              {item.name}
            </button>
            <p className="text-xs text-ink-muted">{item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unit}</p>
            <div className="h-1.5 rounded-full bg-forest-950/10">
              <div className="h-full rounded-full bg-forest-700" style={{ width: `${total ? (item.value_cents / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="text-right">
            <strong>{formatBrl(item.value_cents)}</strong>
            <p className="text-xs text-ink-muted">{total ? ((item.value_cents / total) * 100).toFixed(1).replace(".", ",") : "0"}% dos itens</p>
          </div>
        </div>
      ))}
      {data.items.length > 6 && (
        <button type="button" onClick={onToggle} className="min-h-11 text-left text-sm font-semibold text-forest-800 hover:underline">
          {all ? "Mostrar resumo" : `Ver todos os ${data.items.length} itens e suas posições →`}
        </button>
      )}
      <p className="text-[11px] text-ink-muted">
        Ranking por valor dos itens antes do rateio de desconto e frete do documento (não há motor oficial de rateio identificado). Quantidades mantêm a unidade de cada item; SKU interno e código do fornecedor por item ainda não
        estão ligados a este ranking.
      </p>
    </div>
  );
}

function TitleRow({ title, asOf }: { title: FinancialSummary["open"]["titles"][number]; asOf: string }) {
  const overdue = title.due_date < asOf;
  const today = title.due_date === asOf;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-forest-950/5 py-2 text-sm">
      <div>
        <strong className="text-ink-900">
          {title.document_ref || "Sem número"} · {title.installment_number ?? 1}/{title.installment_count ?? 1}
        </strong>
        <p className="text-xs text-ink-muted">
          Vence {formatDateBr(title.due_date)} {title.payment_method ? `· ${title.payment_method}` : ""}
          {title.scheduled_payment_on && <><br />Agendado para {formatDateBr(title.scheduled_payment_on)}</>}
        </p>
      </div>
      <div className="text-right">
        <strong>{formatBrl(title.balance_cents)}</strong>
        <p className={cn("text-xs font-semibold", overdue ? "text-red-700" : "text-ink-muted")}>
          {overdue ? `${daysBetween(title.due_date, asOf)} dias de atraso` : today ? "Vence hoje" : "A vencer"}
        </p>
      </div>
    </div>
  );
}

function HistoryTab({ events, readAllowed }: { events: SupplierEvent[] | null; readAllowed: boolean }) {
  if (!readAllowed) return <p className="text-sm text-ink-muted">Acesso restrito.</p>;
  if (events === null) return <p className="text-sm text-ink-muted">Histórico indisponível agora.</p>;
  if (events.length === 0) return <p className="text-sm text-ink-muted">Sem eventos registrados.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">
        Histórico das alterações do cadastro: mostra o que mudou (nomes dos campos), nunca os valores. Eventos ficam registrados; integração com outros módulos ainda está pendente.
      </p>
      {events.map((event, index) => (
        <div key={`${event.occurredAt}-${index}`} className="border-b border-forest-950/5 py-2 text-sm">
          <strong className="text-ink-900">{EVENT_LABELS[event.eventType] ?? event.eventType}</strong>
          <p className="text-xs text-ink-muted">
            {new Date(event.occurredAt).toLocaleString("pt-BR")}
            {event.revision ? ` · revisão ${event.revision}` : ""}
            {event.fields.length > 0 ? ` · campos: ${event.fields.join(", ")}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
