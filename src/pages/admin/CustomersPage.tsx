import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronDown, Download, Plus, Search, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminState } from "@/components/admin/AdminState";
import { CustomerListRow, CustomerPortfolioPanel, PortfolioHelp } from "@/components/admin/CustomerListParts";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { resolveCurrentCompanyId } from "@/lib/current-company";
import {
  fetchCustomersList,
  PAGE_SIZES,
  type CustomerListFilters,
  type CustomerListItem,
  type CustomerListResult,
  type ListCategory,
} from "@/lib/customers-api";
import {
  activeFilterTags,
  buildCustomersCsv,
  clearedFilters,
  CATEGORY_NAME,
  hasActiveFilters,
  pageWindow,
  parseListFilters,
  serializeListFilters,
} from "@/lib/customers-list";

const selectClass = "h-11 w-full rounded-xl border border-ink-900/15 bg-white px-3 text-sm text-ink-900 outline-none focus:border-forest-700";

function scrollKey(search: string) {
  return `clientes:scroll:${search}`;
}

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const filters = parseListFilters(params);
  const paramsKey = params.toString();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerListResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchInput, setSearchInput] = useState(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestRef = useRef(0);
  const restoredRef = useRef(false);

  useEffect(() => {
    void resolveCurrentCompanyId().then((id) => {
      if (id) setCompanyId(id);
      else {
        setStatus("error");
        setErrorMessage("Não foi possível identificar a empresa.");
      }
    });
  }, []);

  const update = useCallback(
    (patch: Partial<CustomerListFilters>, resetPage = true) => {
      const next = { ...parseListFilters(new URLSearchParams(paramsKey)), ...patch };
      if (resetPage && patch.page === undefined) next.page = 1;
      setParams(serializeListFilters(next), { replace: true });
    },
    [paramsKey, setParams]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== filters.search) update({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const ticket = ++requestRef.current;
    setStatus((current) => (current === "ready" ? current : "loading"));
    const response = await fetchCustomersList(companyId, parseListFilters(new URLSearchParams(paramsKey)));
    if (ticket !== requestRef.current) return;
    if (response.state === "ready") {
      setResult(response.data);
      setStatus("ready");
      if (response.data.page !== parseListFilters(new URLSearchParams(paramsKey)).page) {
        const next = { ...parseListFilters(new URLSearchParams(paramsKey)), page: response.data.page };
        setParams(serializeListFilters(next), { replace: true });
      }
    } else {
      setStatus("error");
      setErrorMessage(response.state === "error" ? response.message : "Não foi possível consultar a carteira.");
    }
  }, [companyId, paramsKey, setParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "ready" || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(scrollKey(paramsKey));
      if (saved) window.requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
    } catch {
      // sessionStorage indisponível: a lista só não recupera a rolagem
    }
  }, [status, paramsKey]);

  function rememberScroll() {
    try {
      sessionStorage.setItem(scrollKey(paramsKey), String(window.scrollY));
    } catch {
      // sem sessionStorage a rolagem não é preservada
    }
  }

  async function exportFiltered() {
    if (!companyId || !result) return;
    setExporting(true);
    const base = { ...filters, page: 1, pageSize: 50 };
    const rows: CustomerListItem[] = [];
    let page = 1;
    let pages = 1;
    let financeAvailable = result.finance_available;
    while (page <= pages) {
      const response = await fetchCustomersList(companyId, { ...base, page });
      if (response.state !== "ready") {
        setExporting(false);
        toast.error("Não foi possível exportar a lista. Tente novamente.");
        return;
      }
      rows.push(...response.data.items);
      pages = response.data.pages;
      financeAvailable = response.data.finance_available;
      page += 1;
    }
    const blob = new Blob([buildCustomersCsv(rows, financeAvailable)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clientes-filtrados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success(`${rows.length} cliente(s) exportados (todos os filtrados, não só a página).`);
  }

  function selectCategory(category: Exclude<ListCategory, "all">) {
    update({ category: filters.category === category ? "all" : category });
  }

  const tags = result ? activeFilterTags(filters, result.options) : [];
  const financeRestricted = result !== null && !result.finance_available;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">Cadastros</p>
          <h1 className="text-2xl font-extrabold text-forest-950">Clientes</h1>
          <p className="text-sm text-ink-muted">Sua carteira, o relacionamento e as próximas oportunidades de atendimento.</p>
        </div>
        <Link to="/admin/clientes/novo" className="hidden sm:block">
          <Button><Plus size={18} /> Cadastrar cliente</Button>
        </Link>
      </div>

      {result && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiButton label="Clientes cadastrados" value={result.kpis.total} onClick={() => update(clearedFilters(filters))} />
          <KpiButton label="Compras recentes" value={result.kpis.active} hint="Última compra em até 30 dias" onClick={() => update({ category: "active" })} />
          <KpiButton label="Sem primeira compra" value={result.kpis.prospect} hint="Cadastros formais sem compra" onClick={() => update({ category: "prospect" })} />
          <KpiButton
            label="Com títulos vencidos"
            value={result.kpis.with_debt}
            hint={result.kpis.with_debt === null ? "Restrito ao seu perfil" : "Consultar pendências"}
            tone="bad"
            onClick={() => result.kpis.with_debt !== null && update({ finance: "debt" })}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-3xl border border-forest-950/10 bg-white">
          <div className="flex flex-col gap-3 border-b border-forest-950/10 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" aria-hidden />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  aria-label="Buscar cliente"
                  placeholder="Nome, razão social, CPF/CNPJ ou contato"
                  className="h-11 w-full rounded-xl border border-ink-900/15 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none focus:border-forest-700"
                />
              </div>
              <Button type="button" variant="outline" disabled={!result || exporting} onClick={() => void exportFiltered()}>
                <Download size={16} /> {exporting ? "Exportando..." : "Exportar filtrados"}
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
                className="flex min-h-11 items-center gap-2 text-sm font-semibold text-forest-700"
              >
                <SlidersHorizontal size={16} aria-hidden /> Cidade, bairro, equipe e situação
                <ChevronDown size={16} className={cn("transition-transform", filtersOpen && "rotate-180")} aria-hidden />
              </button>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <select aria-label="Situação comercial" value={filters.category} onChange={(e) => update({ category: e.target.value as ListCategory })} className={cn(selectClass, "sm:w-52")}>
                  <option value="all">Todos os clientes</option>
                  {(Object.keys(CATEGORY_NAME) as Exclude<ListCategory, "all">[]).map((key) => (
                    <option key={key} value={key}>{CATEGORY_NAME[key]}</option>
                  ))}
                </select>
                <select aria-label="Ordenar lista" value={filters.sort} onChange={(e) => update({ sort: e.target.value as CustomerListFilters["sort"] })} className={cn(selectClass, "sm:w-52")}>
                  <option value="purchase">Compra mais recente</option>
                  <option value="name">Nome · A a Z</option>
                  <option value="debt" disabled={financeRestricted}>Maior saldo vencido</option>
                </select>
              </div>
            </div>

            {filtersOpen && result && (
              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-cream-50 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <FilterField label="Cidade">
                  <select value={filters.city} onChange={(e) => update({ city: e.target.value })} className={selectClass}>
                    <option value="">Todas as cidades</option>
                    {result.options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Bairro">
                  <input defaultValue={filters.neighborhood} onBlur={(e) => e.target.value !== filters.neighborhood && update({ neighborhood: e.target.value })} onKeyDown={(e) => e.key === "Enter" && update({ neighborhood: e.currentTarget.value })} placeholder="Pesquisar bairro" className={selectClass} />
                </FilterField>
                <FilterField label="Estado">
                  <select value={filters.uf} onChange={(e) => update({ uf: e.target.value })} className={selectClass}>
                    <option value="">Todos os estados</option>
                    {result.options.states.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Vendedor">
                  <select value={filters.sellerId} onChange={(e) => update({ sellerId: e.target.value })} className={selectClass}>
                    <option value="">Todos os vendedores</option>
                    {result.options.sellers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Promotor / equipe">
                  <select value={filters.promoterId} onChange={(e) => update({ promoterId: e.target.value })} className={selectClass}>
                    <option value="">Todos os promotores</option>
                    {result.options.promoters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Financeiro">
                  <select value={filters.finance} disabled={financeRestricted} onChange={(e) => update({ finance: e.target.value as CustomerListFilters["finance"] })} className={selectClass}>
                    <option value="all">{financeRestricted ? "Restrito ao seu perfil" : "Todas as situações"}</option>
                    <option value="debt">Com títulos vencidos</option>
                    <option value="clear">Sem títulos vencidos</option>
                  </select>
                </FilterField>
                <FilterField label="Situação do cadastro">
                  <select value={filters.registration} onChange={(e) => update({ registration: e.target.value as CustomerListFilters["registration"] })} className={selectClass}>
                    <option value="all">Todos os cadastros</option>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </FilterField>
                <p className="text-xs text-ink-muted sm:col-span-2 xl:col-span-2">
                  Filtros combinados (todos ao mesmo tempo). O filtro e a ordenação por última visita não aparecem: ainda não existe fonte oficial de visitas.
                </p>
              </div>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {tags.map((tag) => <span key={tag} className="rounded-full bg-forest-950/5 px-3 py-1 text-xs font-semibold text-ink-700">{tag}</span>)}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-3 text-sm text-ink-muted" aria-live="polite">
            <span>{result ? <><strong className="text-ink-900">{result.total}</strong> {result.total === 1 ? "cliente encontrado" : "clientes encontrados"}</> : "Consultando..."}</span>
            {hasActiveFilters(filters) && <button type="button" onClick={() => { setSearchInput(""); update(clearedFilters(filters)); }} className="min-h-11 font-semibold text-forest-700 hover:underline">Limpar filtros</button>}
          </div>

          {status === "loading" && !result ? (
            <div className="p-4"><AdminState variant="loading" message="Carregando clientes..." /></div>
          ) : status === "error" ? (
            <div className="p-4"><AdminState variant="error" message={errorMessage || "Não foi possível carregar os clientes."} onRetry={() => { setStatus("loading"); void load(); }} /></div>
          ) : result && result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <Users size={28} className="text-ink-muted" aria-hidden />
              <p className="text-sm text-ink-muted">{result.kpis.total === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado com esses filtros."}</p>
              {result.kpis.total > 0 && <Button variant="outline" onClick={() => { setSearchInput(""); update(clearedFilters(filters)); }}>Limpar e mostrar todos</Button>}
            </div>
          ) : result ? (
            <div>
              {result.items.map((item) => (
                <CustomerListRow key={item.id} item={item} today={result.as_of} financeAvailable={result.finance_available} listSearch={paramsKey ? `?${paramsKey}` : ""} onOpen={rememberScroll} />
              ))}
            </div>
          ) : null}

          {result && result.total > 0 && (
            <footer className="flex flex-col gap-3 border-t border-forest-950/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-ink-700">
                <span>{(result.page - 1) * result.page_size + 1}–{Math.min(result.page * result.page_size, result.total)} de {result.total}</span>
                <select aria-label="Clientes por página" value={filters.pageSize} onChange={(e) => update({ pageSize: Number(e.target.value) })} className="h-11 rounded-lg border border-ink-900/15 bg-white px-2 text-sm">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} por página</option>)}
                </select>
              </div>
              <nav aria-label="Páginas" className="flex flex-wrap items-center gap-1">
                <PageButton label="Página anterior" disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 }, false)}>‹</PageButton>
                {pageWindow(result.page, result.pages).map((entry, index) =>
                  entry === "gap" ? <span key={`gap-${index}`} className="px-1 text-ink-muted">…</span> : (
                    <PageButton key={entry} label={`Página ${entry}`} current={entry === result.page} onClick={() => update({ page: entry }, false)}>{entry}</PageButton>
                  )
                )}
                <PageButton label="Próxima página" disabled={result.page >= result.pages} onClick={() => update({ page: result.page + 1 }, false)}>›</PageButton>
              </nav>
            </footer>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {result ? (
            <>
              <CustomerPortfolioPanel summary={result.summary} selected={filters.category} onSelect={selectCategory} onDetails={() => setHelpOpen((open) => !open)} />
              {helpOpen && <PortfolioHelp />}
              <section className="rounded-3xl border border-forest-950/10 bg-white">
                <div className="border-b border-forest-950/10 px-5 py-4"><h2 className="text-base font-extrabold text-forest-950">Atenção à carteira</h2></div>
                <div className="flex flex-col p-2">
                  <button type="button" disabled={result.summary.with_debt === null} onClick={() => update({ finance: "debt" })} className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-left hover:bg-forest-950/5 disabled:opacity-60">
                    <AlertTriangle size={18} className="text-red-700" aria-hidden />
                    <span className="flex-1 text-sm"><strong className="block text-ink-900">Títulos vencidos</strong><small className="text-ink-muted">{result.summary.with_debt === null ? "Restrito ao seu perfil" : "Clientes com pendências financeiras"}</small></span>
                    <strong>{result.summary.with_debt ?? "—"}</strong>
                  </button>
                  <div className="flex min-h-14 items-center gap-3 px-3 text-sm text-ink-muted">
                    <AlertTriangle size={18} aria-hidden />
                    <span className="flex-1"><strong className="block text-ink-700">Sem visita há mais de 30 dias</strong><small>Indisponível: sem fonte oficial de visitas</small></span>
                    <strong>—</strong>
                  </div>
                  <button type="button" onClick={() => update({ category: "prospect" })} className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-left hover:bg-forest-950/5">
                    <Users size={18} className="text-gold-600" aria-hidden />
                    <span className="flex-1 text-sm"><strong className="block text-ink-900">Aguardando a primeira compra</strong><small className="text-ink-muted">Consultar clientes sem compra</small></span>
                    <strong>{result.summary.prospect}</strong>
                  </button>
                </div>
              </section>
              <section className="rounded-3xl border border-dashed border-forest-950/20 bg-white p-5 text-sm text-ink-muted">
                <strong className="block text-ink-700">Presença da equipe</strong>
                Indisponível: visitas realizadas dependem do motor de Tarefas/Missões, ainda não integrado. Pedidos e WhatsApp não comprovam visita.
              </section>
            </>
          ) : null}
        </aside>
      </div>

      <Link to="/admin/clientes/novo" className="fixed bottom-4 right-4 z-30 sm:hidden" aria-label="Cadastrar cliente">
        <Button size="lg" className="shadow-lg"><Plus size={18} /> Cadastrar</Button>
      </Link>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
      {label}
      {children}
    </label>
  );
}

function KpiButton({ label, value, hint, tone, onClick }: { label: string; value: number | null; hint?: string; tone?: "bad"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-20 flex-col items-start gap-0.5 rounded-2xl border border-forest-950/10 bg-white p-4 text-left hover:bg-forest-950/5">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <strong className={cn("text-2xl font-extrabold", tone === "bad" && value ? "text-red-700" : "text-forest-950")}>{value ?? "—"}</strong>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </button>
  );
}

function PageButton({ label, current, disabled, onClick, children }: { label: string; current?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn("flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-semibold disabled:pointer-events-none disabled:opacity-40", current ? "border-forest-700 bg-forest-700 text-cream-50" : "border-forest-950/15 text-forest-900 hover:bg-forest-950/5")}
    >
      {children}
    </button>
  );
}
