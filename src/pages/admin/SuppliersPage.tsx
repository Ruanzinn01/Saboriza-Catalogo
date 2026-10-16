import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Download, MapPin, Plus, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { useSuppliersStore } from "@/store/suppliers-store";
import { useSupplierCategoriesStore } from "@/store/supplier-categories-store";
import { useSupplierPermissionsStore } from "@/store/supplier-permissions-store";
import { AdminState } from "@/components/admin/AdminState";
import { Pagination } from "@/components/admin/Pagination";
import { SupplierCandidatesTab } from "@/components/admin/fornecedores/SupplierCandidatesTab";
import { SupplierCategoriesSettings } from "@/components/admin/fornecedores/SupplierCategoriesSettings";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fetchExportRows, fetchFinanceList, type FinanceList } from "@/lib/supplier-api";
import { buildSuppliersCsv, downloadCsv, type FinanceColumns } from "@/lib/supplier-csv";
import {
  agoLabel,
  concentration,
  type FinanceFilter,
  type FinanceRow,
  financeChip,
  formatBrl,
  formatDateBr,
  formatPercent,
  matchesFinanceFilter,
  PERIOD_LABELS,
  periodRange,
  type SupplierPeriod,
  todayInZone,
} from "@/lib/supplier-finance";
import { supplierMapsUrl } from "@/lib/supplier-form";
import { getSupplierDisplayName } from "@/lib/supplier-display";
import { filterSuppliers, paginate, sortSuppliers, SUPPLIER_PAGE_SIZES, type SupplierSort, type SupplierStatusFilter } from "@/lib/supplier-search";
import type { Supplier } from "@/types/supplier";

type Tab = "fornecedores" | "possiveis" | "configuracoes";

const TABS: { key: Tab; label: string }[] = [
  { key: "fornecedores", label: "Fornecedores" },
  { key: "possiveis", label: "Possíveis fornecedores" },
  { key: "configuracoes", label: "Configurações" },
];

const PERIODS = Object.keys(PERIOD_LABELS) as SupplierPeriod[];
const FINANCE_FILTERS: { value: FinanceFilter; label: string }[] = [
  { value: "all", label: "Todas as situações" },
  { value: "overdue", label: "Com títulos vencidos" },
  { value: "open", label: "Com saldo em aberto" },
  { value: "clear", label: "Sem saldo em aberto" },
];
const SORTS: { value: SupplierSort; label: string }[] = [
  { value: "name", label: "Nome" },
  { value: "value", label: "Maior valor comprado" },
  { value: "debt", label: "Maior saldo em aberto" },
];

type FinanceState = { kind: "restricted" } | { kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; data: FinanceList };

function Kpi({ label, value, sub, onClick }: { label: string; value: string; sub: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="text-xl font-extrabold text-forest-950">{value}</span>
      <span className="text-xs text-ink-muted">{sub}</span>
    </>
  );
  const base = "flex min-h-11 flex-col gap-1 rounded-2xl border border-forest-950/10 bg-white p-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, "hover:bg-forest-950/5")}>
      {body}
    </button>
  ) : (
    <div className={base}>{body}</div>
  );
}

function stateText(state: FinanceState): { value: string; sub: string } | null {
  if (state.kind === "restricted") return { value: "Acesso restrito", sub: "Seu perfil não inclui a posição financeira de fornecedores." };
  if (state.kind === "loading") return { value: "Carregando...", sub: "Lendo Compras e Contas a Pagar." };
  if (state.kind === "unavailable") return { value: "Fonte indisponível", sub: "Não foi possível ler Compras e Contas a Pagar. Nenhum valor é exibido." };
  return null;
}

export function SuppliersPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some((item) => item.key === params.get("aba")) ? (params.get("aba") as Tab) : "fornecedores";
  const query = params.get("q") ?? "";
  const categoryId = params.get("categoria") ?? "";
  const city = params.get("cidade") ?? "";
  const buyer = params.get("comprador") ?? "";
  const status: SupplierStatusFilter = params.get("cadastro") === "inativos" ? "inactive" : params.get("cadastro") === "todos" ? "all" : "active";
  const financeFilter = (FINANCE_FILTERS.some((f) => f.value === params.get("financeiro")) ? params.get("financeiro") : "all") as FinanceFilter;
  const sort = (SORTS.some((s) => s.value === params.get("ordem")) ? params.get("ordem") : "name") as SupplierSort;
  const period = (PERIODS.includes(params.get("periodo") as SupplierPeriod) ? params.get("periodo") : "year") as SupplierPeriod;
  const pageSize = SUPPLIER_PAGE_SIZES.includes(Number(params.get("tam"))) ? Number(params.get("tam")) : 10;
  const page = Math.max(1, Number(params.get("pagina")) || 1);

  const suppliers = useSuppliersStore((state) => state.suppliers);
  const suppliersStatus = useSuppliersStore((state) => state.status);
  const fetchSuppliers = useSuppliersStore((state) => state.fetchSuppliers);
  const categories = useSupplierCategoriesStore((state) => state.categories);
  const linksBySupplier = useSupplierCategoriesStore((state) => state.linksBySupplier);
  const categoriesStatus = useSupplierCategoriesStore((state) => state.status);
  const fetchCategories = useSupplierCategoriesStore((state) => state.fetchAll);
  const permissions = useSupplierPermissionsStore((state) => state.permissions);
  const permissionsStatus = useSupplierPermissionsStore((state) => state.status);
  const loadPermissions = useSupplierPermissionsStore((state) => state.load);
  const [finance, setFinance] = useState<FinanceState>({ kind: "loading" });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void fetchSuppliers();
    if (permissionsStatus === "idle") void loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSuppliers]);

  useEffect(() => {
    if (categoriesStatus === "idle") void fetchCategories();
  }, [categoriesStatus, fetchCategories]);

  const range = useMemo(() => periodRange(period, todayInZone()), [period]);

  const loadFinance = useCallback(async () => {
    if (permissionsStatus !== "ready" && permissionsStatus !== "error") return;
    if (!permissions["fornecedores.financeiro"]) {
      setFinance({ kind: "restricted" });
      return;
    }
    setFinance({ kind: "loading" });
    const { data, error } = await fetchFinanceList(range.from, range.to);
    setFinance(error || !data ? { kind: "unavailable" } : { kind: "ready", data });
  }, [permissions, permissionsStatus, range]);

  useEffect(() => {
    void loadFinance();
  }, [loadFinance]);

  function setParam(changes: Record<string, string>, resetPage = true) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (resetPage) next.delete("pagina");
    setParams(next, { replace: true });
  }

  const financeById = useMemo(() => {
    const map = new Map<string, FinanceRow>();
    if (finance.kind === "ready") finance.data.rows.forEach((row) => map.set(row.supplier_id, row));
    return map;
  }, [finance]);

  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const cities = useMemo(() => Array.from(new Set(suppliers.map((s) => s.city.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [suppliers]);
  const buyers = useMemo(() => Array.from(new Set(suppliers.map((s) => s.buyerName.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [suppliers]);

  const filtered = useMemo(() => {
    const base = filterSuppliers(suppliers, linksBySupplier, categoriesById, { query, categoryIds: categoryId ? [categoryId] : [], city, buyer, status }).filter((s) =>
      matchesFinanceFilter(financeById.get(s.id), financeFilter)
    );
    return sortSuppliers(base, sort, (id) => {
      const row = financeById.get(id);
      return row ? { value: row.purchased_cents, debt: row.open_cents } : undefined;
    });
  }, [suppliers, linksBySupplier, categoriesById, query, categoryId, city, buyer, status, financeFilter, financeById, sort]);
  const paged = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  const totals = useMemo(() => {
    let purchased = 0;
    let paid = 0;
    let open = 0;
    let overdue = 0;
    let overdueSuppliers = 0;
    let withPurchases = 0;
    for (const s of filtered) {
      const row = financeById.get(s.id);
      if (!row) continue;
      purchased += row.purchased_cents;
      paid += row.paid_cents;
      open += row.open_cents;
      overdue += row.overdue_cents;
      if (row.overdue_cents > 0) overdueSuppliers += 1;
      if (row.purchase_count > 0) withPurchases += 1;
    }
    return { purchased, paid, open, overdue, overdueSuppliers, withPurchases };
  }, [filtered, financeById]);

  const concentrationRows = useMemo(
    () => concentration(filtered.map((s) => ({ id: s.id, name: getSupplierDisplayName(s), cents: financeById.get(s.id)?.purchased_cents ?? 0 })).filter((x) => x.cents > 0)),
    [filtered, financeById]
  );

  function categoryNames(supplierId: string) {
    return (linksBySupplier.get(supplierId) ?? []).map((id) => categoriesById.get(id)?.name).filter(Boolean) as string[];
  }

  async function handleExport() {
    setExporting(true);
    const { data, error } = await fetchExportRows(filtered.map((s) => s.id));
    setExporting(false);
    if (error || !data) {
      toast.error(error?.includes("Sem permiss") ? "Você não tem permissão para exportar." : "Não foi possível exportar agora.");
      return;
    }
    let columns: Map<string, FinanceColumns> | undefined;
    if (finance.kind === "ready") {
      columns = new Map();
      for (const s of filtered) {
        const row = financeById.get(s.id);
        if (row) columns.set(s.id, { purchasedCents: row.purchased_cents, paidCents: row.paid_cents, openCents: row.open_cents });
      }
    }
    const csv = buildSuppliersCsv(data.rows, columns, {
      scope: "Conjunto filtrado e autorizado da empresa",
      exportedOn: formatDateBr(todayInZone()),
      periodLabel: finance.kind === "ready" ? PERIOD_LABELS[period] : undefined,
    });
    downloadCsv(`fornecedores_${todayInZone()}.csv`, csv);
    toast.success(`${data.rows.length} fornecedor(es) exportado(s)`);
  }

  const selectClass = "h-11 rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";
  const fin = stateText(finance);
  const asOf = finance.kind === "ready" ? finance.data.as_of : todayInZone();
  const clearFilters = () => setParam({ q: "", categoria: "", cidade: "", comprador: "", cadastro: "", financeiro: "", ordem: "" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">Relacionamento</p>
          <h1 className="text-2xl font-extrabold text-forest-950">Fornecedores</h1>
          <p className="text-sm text-ink-muted">Compras, condições e relacionamento em um só lugar.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/admin/despesas/nova">
            <Button variant="outline" className="w-full sm:w-auto">
              Nova compra / despesa
            </Button>
          </Link>
          {permissions["fornecedores.manage"] && (
            <Link to="/admin/fornecedores/novo">
              <Button className="w-full sm:w-auto">
                <Plus size={18} /> Novo fornecedor
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="mr-auto text-xs text-ink-muted">Posição em {formatDateBr(asOf)}</span>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-700">
          Período
          <select value={period} aria-label="Período" onChange={(e) => setParam({ periodo: e.target.value === "year" ? "" : e.target.value }, false)} className={selectClass}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Fornecedores" value={String(filtered.length)} sub="Cadastros formais nos filtros" onClick={() => setParam({ financeiro: "" })} />
        <Kpi label="Comprado no período" value={fin ? fin.value : formatBrl(totals.purchased)} sub={fin ? fin.sub : "Compras confirmadas · valor líquido · emissão do documento"} />
        <Kpi label="Pago no período" value={fin ? fin.value : formatBrl(totals.paid)} sub={fin ? fin.sub : "Baixas confirmadas · data do pagamento"} />
        <Kpi
          label="Saldo em aberto"
          value={fin ? fin.value : formatBrl(totals.open)}
          sub={fin ? fin.sub : "Posição atual · todos os vencimentos"}
          onClick={finance.kind === "ready" ? () => setParam({ financeiro: "open" }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div role="tablist" aria-label="Seções de fornecedores" className="flex gap-1 overflow-x-auto rounded-2xl bg-forest-950/5 p-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setParam({ aba: item.key === "fornecedores" ? "" : item.key }, false)}
                className={cn(
                  "min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors",
                  tab === item.key ? "bg-white text-forest-950 shadow-sm" : "text-ink-700 hover:bg-white/60"
                )}
              >
                {item.label}
                {item.key === "fornecedores" ? ` · ${suppliers.length}` : ""}
              </button>
            ))}
          </div>

          {tab === "possiveis" && <SupplierCandidatesTab />}
          {tab === "configuracoes" && <SupplierCategoriesSettings />}

          {tab === "fornecedores" && (
            <>
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
                  <input
                    value={query}
                    onChange={(e) => setParam({ q: e.target.value })}
                    aria-label="Buscar fornecedor"
                    placeholder="Buscar fornecedor, razão social, documento, contato ou categoria"
                    className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
                  />
                </div>
                {permissions["fornecedores.exportar"] && (
                  <Button variant="outline" className="min-h-11" disabled={exporting || filtered.length === 0} onClick={() => void handleExport()}>
                    <Download size={16} /> {exporting ? "Exportando..." : "Exportar CSV"}
                  </Button>
                )}
                <Button variant="outline" className="min-h-11" onClick={clearFilters}>
                  Limpar
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Categoria do fornecedor
                  <select value={categoryId} onChange={(e) => setParam({ categoria: e.target.value })} className={selectClass}>
                    <option value="">Todas as categorias (inclui sem categoria)</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.active ? "" : " · inativa"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Cidade
                  <select value={city} onChange={(e) => setParam({ cidade: e.target.value })} className={selectClass}>
                    <option value="">Todas as cidades</option>
                    {cities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Financeiro
                  <select value={financeFilter} onChange={(e) => setParam({ financeiro: e.target.value === "all" ? "" : e.target.value })} className={selectClass} disabled={finance.kind !== "ready"}>
                    {FINANCE_FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Cadastro
                  <select value={status} onChange={(e) => setParam({ cadastro: e.target.value === "active" ? "" : e.target.value === "inactive" ? "inativos" : "todos" })} className={selectClass}>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="all">Todos os cadastros</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Comprador
                  <select value={buyer} onChange={(e) => setParam({ comprador: e.target.value })} className={selectClass}>
                    <option value="">Todos os compradores</option>
                    {buyers.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
                  Ordenar
                  <select value={sort} onChange={(e) => setParam({ ordem: e.target.value === "name" ? "" : e.target.value })} className={selectClass}>
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value} disabled={s.value !== "name" && finance.kind !== "ready"}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {suppliersStatus === "loading" && suppliers.length === 0 ? (
                <AdminState variant="loading" message="Carregando fornecedores..." />
              ) : suppliersStatus === "error" ? (
                <AdminState variant="error" message="Não foi possível carregar os fornecedores." onRetry={() => void fetchSuppliers()} />
              ) : filtered.length === 0 ? (
                <AdminState variant="empty" message={suppliers.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum fornecedor encontrado. Ajuste os filtros."} />
              ) : (
                <div className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
                  <div className="hidden grid-cols-[minmax(0,1.7fr)_1fr_1fr_48px] gap-3 border-b border-forest-950/10 px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-muted lg:grid">
                    <span>Fornecedor / contato</span>
                    <span>Comprado no período</span>
                    <span>Em aberto · atual</span>
                    <span />
                  </div>
                  <ul className="flex flex-col divide-y divide-forest-950/5">
                    {paged.rows.map((supplier) => (
                      <SupplierRowItem key={supplier.id} supplier={supplier} categoryNames={categoryNames(supplier.id)} finance={financeById.get(supplier.id)} financeKind={finance.kind} />
                    ))}
                  </ul>
                  <Pagination
                    page={paged.page}
                    totalPages={paged.totalPages}
                    pageSize={pageSize}
                    pageSizeOptions={SUPPLIER_PAGE_SIZES}
                    total={filtered.length}
                    itemLabel="fornecedores"
                    onPageChange={(next) => setParam({ pagina: next > 1 ? String(next) : "" }, false)}
                    onPageSizeChange={(size) => setParam({ tam: size === 10 ? "" : String(size) })}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <aside className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <SideCard title="Carteira de fornecedores">
            <p className="text-xs text-ink-muted">Cadastros formais nos filtros</p>
            <p className="text-2xl font-extrabold text-forest-950">{filtered.length} fornecedores</p>
            {finance.kind === "ready" ? (
              <>
                <Stat label="Com compras no período" value={String(totals.withPurchases)} />
                <Stat label="Sem compra no período" value={String(filtered.length - totals.withPurchases)} />
              </>
            ) : (
              <p className="text-xs text-ink-muted">Compras por fornecedor: {fin?.value.toLowerCase()}.</p>
            )}
            <p className="mt-2 rounded-xl bg-forest-950/5 p-3 text-xs text-ink-700">Possíveis fornecedores ficam em avaliação e não entram nesta carteira nem nos valores financeiros.</p>
          </SideCard>
          <SideCard title="Atenção aos pagamentos">
            <p className="text-xs text-ink-muted">Títulos vencidos · posição atual</p>
            <p className="text-2xl font-extrabold text-red-700">{finance.kind === "ready" ? formatBrl(totals.overdue) : "—"}</p>
            {finance.kind === "ready" ? (
              <>
                <Stat label="Fornecedores com vencidos" value={String(totals.overdueSuppliers)} />
                <button type="button" onClick={() => setParam({ financeiro: "overdue" })} className="min-h-11 text-left text-sm font-semibold text-forest-800 hover:underline">
                  Ver fornecedores com vencidos →
                </button>
              </>
            ) : (
              <p className="text-xs text-ink-muted">{fin?.sub}</p>
            )}
          </SideCard>
          <SideCard title="Concentração das compras">
            {finance.kind !== "ready" ? (
              <p className="text-xs text-ink-muted">{fin?.sub}</p>
            ) : concentrationRows.length === 0 ? (
              <p className="text-xs text-ink-muted">Sem compras confirmadas no período.</p>
            ) : (
              <>
                {concentrationRows.map((row) => (
                  <div key={row.id} className="flex flex-col gap-1">
                    <Link to={`/admin/fornecedores/${row.id}`} className="min-h-6 text-sm font-semibold text-forest-800 hover:underline">
                      {row.name}
                    </Link>
                    <div className="flex justify-between text-xs text-ink-muted">
                      <span>{formatBrl(row.cents)}</span>
                      <span>{formatPercent(row.percent)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-forest-950/10">
                      <div className="h-full rounded-full bg-forest-700" style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink-muted">Participação no valor total filtrado; não é normalizada só entre os quatro exibidos.</p>
              </>
            )}
          </SideCard>
          <SideCard title="Novas possibilidades">
            <p className="text-xs text-ink-muted">Empresas em estudo, contato ou cotação. Sem criar saldo ou limite.</p>
            <button type="button" onClick={() => setParam({ aba: "possiveis" }, false)} className="flex min-h-11 items-center gap-1 text-left text-sm font-semibold text-forest-800 hover:underline">
              Abrir possíveis fornecedores <ArrowRight size={14} />
            </button>
          </SideCard>
        </aside>
      </div>

      <p className="text-[11px] text-ink-muted">
        Compras (data de emissão do documento), pagamentos (data da baixa) e saldo em aberto (posição atual) usam datas próprias. Estornos, juros, devoluções e adiantamentos de fornecedor ainda não
        têm fonte no sistema e não são somados.
      </p>
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-3xl border border-forest-950/10 bg-white p-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-forest-950/5 py-1.5 text-sm">
      <span className="text-ink-700/70">{label}</span>
      <strong className="text-ink-900">{value}</strong>
    </div>
  );
}

function SupplierRowItem({ supplier, categoryNames, finance, financeKind }: { supplier: Supplier; categoryNames: string[]; finance: FinanceRow | undefined; financeKind: FinanceState["kind"] }) {
  const chip = financeChip(finance);
  const secondary = [supplier.companyName !== getSupplierDisplayName(supplier) ? supplier.companyName : "", supplier.cnpj].filter(Boolean).join(" — ");
  return (
    <li className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,1.7fr)_1fr_1fr_48px] lg:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link to={`/admin/fornecedores/${supplier.id}`} className="break-words text-base font-extrabold text-forest-800 hover:underline">
            {getSupplierDisplayName(supplier)}
          </Link>
          {secondary && <span className="break-words text-xs text-ink-muted">— {secondary}</span>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-700/70">
          <MapPin size={12} aria-hidden /> {[supplier.city, supplier.state].filter(Boolean).join(" / ") || "Cidade não informada"}
          <a href={supplierMapsUrl(supplier)} target="_blank" rel="noopener noreferrer" aria-label={`Mapa de ${getSupplierDisplayName(supplier)}`} className="inline-flex min-h-11 items-center font-semibold text-forest-800 hover:underline lg:min-h-0">
            Ver mapa ↗
          </a>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {categoryNames.map((name) => (
            <span key={name} className="rounded-full bg-forest-950/5 px-2.5 py-1 text-xs font-semibold text-ink-700">
              {name}
            </span>
          ))}
          {!supplier.active && <span className="rounded-full bg-gold-400/30 px-2.5 py-1 text-xs font-semibold text-forest-950">Inativo</span>}
          <span className="text-xs text-ink-muted">{supplier.name || "Contato não informado"}</span>
        </div>
      </div>
      <div className="flex flex-col text-sm">
        {finance ? (
          <>
            <strong className="text-base text-forest-950">{formatBrl(finance.purchased_cents)}</strong>
            <span className="text-xs text-ink-muted">
              {finance.purchase_count > 0 ? `${finance.purchase_count} compra(s) no período` : "Sem compra no período"}
              <br />
              Última: {finance.last_purchase_on ? `${formatDateBr(finance.last_purchase_on)} · ${agoLabel(finance.last_purchase_on, todayInZone())}` : "Sem compra"}
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-muted">{financeKind === "restricted" ? "Acesso restrito" : financeKind === "loading" ? "Carregando..." : "Fonte indisponível"}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {finance ? (
          <>
            <strong className={cn("text-base", finance.overdue_cents > 0 ? "text-red-700" : "text-forest-950")}>{formatBrl(finance.open_cents)}</strong>
            <span
              className={cn(
                "w-fit rounded-full px-2.5 py-1 text-xs font-semibold",
                chip.tone === "red" ? "bg-red-100 text-red-700" : chip.tone === "neutral" ? "bg-forest-950/5 text-ink-700" : "text-ink-muted"
              )}
            >
              {chip.label}
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>
      <div className="flex items-start justify-end">
        <Link
          to={`/admin/fornecedores/${supplier.id}`}
          aria-label={`Abrir ${getSupplierDisplayName(supplier)}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 hover:bg-forest-950/5"
        >
          <Store size={16} />
        </Link>
      </div>
    </li>
  );
}
