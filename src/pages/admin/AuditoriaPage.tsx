import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Info } from "lucide-react";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  ACTOR_LABELS,
  AUDIT_PAGE_SIZES,
  AUDIT_UNAVAILABLE,
  actorLabel,
  auditoriaCentral,
  defaultAuditFilters,
  fillDailySeries,
  shortId,
  totalPages,
  type AuditCountItem,
  type AuditDetail,
  type AuditFilters,
  type AuditListResult,
  type AuditOverview,
} from "@/lib/auditoria-central";

type Tab = "geral" | "logs";

const fieldClass = "h-11 w-full rounded-xl border border-forest-950/15 bg-white px-3 text-sm text-forest-950";
const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR");

function Unavailable({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-forest-950/5 p-3 text-xs text-ink-muted">
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-forest-950/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-forest-950">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function BarList({ title, items, onPick }: { title: string; items: AuditCountItem[]; onPick?: (key: string) => void }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="rounded-2xl border border-forest-950/10 bg-white p-4">
      <h3 className="text-sm font-bold text-forest-950">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Sem eventos no período.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                disabled={!onPick}
                onClick={() => onPick?.(item.key)}
                className="flex min-h-11 w-full flex-col justify-center gap-1 text-left disabled:cursor-default"
              >
                <span className="flex justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-forest-950">{item.key}</span>
                  <span className="font-semibold text-forest-950">{item.count}</span>
                </span>
                <span className="h-2 rounded-full bg-forest-950/5">
                  <span className="block h-2 rounded-full bg-forest-700" style={{ width: `${(item.count / max) * 100}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DailyChart({ overview, from, to }: { overview: AuditOverview; from: string; to: string }) {
  const series = useMemo(() => fillDailySeries(overview.by_day, from, to), [overview.by_day, from, to]);
  const max = Math.max(1, ...series.map((item) => item.count));
  return (
    <section className="rounded-2xl border border-forest-950/10 bg-white p-4">
      <h3 className="text-sm font-bold text-forest-950">Eventos por dia (UTC)</h3>
      <div className="mt-3 flex h-32 items-end gap-px" role="img" aria-label={`Eventos por dia, total ${overview.total}`}>
        {series.map((item) => (
          <div key={item.day} title={`${item.day}: ${item.count}`} className="flex-1 rounded-t bg-forest-700/80" style={{ height: `${Math.max(2, (item.count / max) * 100)}%`, opacity: item.count === 0 ? 0.2 : 1 }} />
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {from} a {to}. Série única: não há classificação de eventos críticos nem de exceções para separar.
      </p>
    </section>
  );
}

function FiltersBar({ draft, setDraft, onApply, onClear }: { draft: AuditFilters; setDraft: (f: AuditFilters) => void; onApply: () => void; onClear: () => void }) {
  const set = (patch: Partial<AuditFilters>) => setDraft({ ...draft, ...patch });
  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-3xl border border-forest-950/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted sm:col-span-2 lg:col-span-2">
        Busca (tipo de evento, entidade, registro ou correlação)
        <input className={fieldClass} value={draft.search} onChange={(e) => set({ search: e.target.value })} placeholder="Ex.: despesa, EXP-1" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
        De
        <input type="date" className={fieldClass} value={draft.from} onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
        Até
        <input type="date" className={fieldClass} value={draft.to} onChange={(e) => set({ to: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
        Tipo de evento (exato)
        <input className={fieldClass} value={draft.eventType} onChange={(e) => set({ eventType: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
        Entidade (exata)
        <input className={fieldClass} value={draft.entityType} onChange={(e) => set({ entityType: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
        Ator
        <select className={fieldClass} value={draft.actorType} onChange={(e) => set({ actorType: e.target.value })}>
          <option value="">Todos</option>
          {Object.entries(ACTOR_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <Button type="submit" size="md" className="flex-1">
          Aplicar
        </Button>
        <Button type="button" variant="outline" size="md" onClick={onClear}>
          Limpar
        </Button>
      </div>
    </form>
  );
}

function DetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError(null);
    auditoriaCentral
      .detail(id)
      .then((data) => alive && setDetail(data))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const rows: [string, string][] = detail
    ? [
        ["Tipo de evento", detail.event_type],
        ["Ocorreu em", formatDateTime(detail.occurred_at)],
        ["Gravado em", formatDateTime(detail.recorded_at)],
        ["Ator", actorLabel(detail.actor_type, detail.actor_user_id)],
        ["Colaborador vinculado", detail.employee_id ?? "-"],
        ["Entidade", detail.entity_type],
        ["Registro afetado", detail.entity_id],
        ["Correlação", detail.correlation_id],
        ["Causa (causation)", detail.causation_id ?? "-"],
        ["Chave de idempotência", detail.idempotency_key ?? "-"],
        ["Outros eventos da mesma correlação", String(detail.related_count)],
        ["Versão do esquema", String(detail.schema_version)],
        ["ID do evento", detail.id],
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" size="md" onClick={onBack} className="self-start">
        <ChevronLeft size={16} aria-hidden /> Voltar
      </Button>
      {error && <AdminState variant="error" message={error} />}
      {!error && !detail && <AdminState variant="loading" message="Carregando evento..." />}
      {detail && (
        <>
          <section className="rounded-3xl border border-forest-950/10 bg-white p-4">
            <h2 className="text-lg font-extrabold text-forest-950">Evento de auditoria (somente leitura)</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
                  <dd className="break-all font-mono text-sm text-forest-950">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-3xl border border-forest-950/10 bg-white p-4">
            <h3 className="text-sm font-bold text-forest-950">Conteúdo (payload)</h3>
            {detail.payload_redacted ? (
              <p className="mt-2 text-sm text-ink-muted">Conteúdo oculto: seu perfil não tem a permissão de consulta sensível.</p>
            ) : (
              <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-forest-950/5 p-3 text-xs text-forest-950">{JSON.stringify(detail.payload, null, 2)}</pre>
            )}
          </section>
          <div className="flex flex-col gap-2">
            <Unavailable>{AUDIT_UNAVAILABLE.modulo}</Unavailable>
            <Unavailable>{AUDIT_UNAVAILABLE.nivel}</Unavailable>
            <Unavailable>{AUDIT_UNAVAILABLE.antesDepois}</Unavailable>
            <Unavailable>{AUDIT_UNAVAILABLE.motivo}</Unavailable>
            <Unavailable>{AUDIT_UNAVAILABLE.integridade}</Unavailable>
          </div>
        </>
      )}
    </div>
  );
}

export function AuditoriaPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("aba") === "logs" ? "logs" : "geral";
  const eventId = params.get("evento");

  const [draft, setDraft] = useState<AuditFilters>(() => defaultAuditFilters());
  const [applied, setApplied] = useState<AuditFilters>(draft);
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState<AuditOverview | null>(null);
  const [list, setList] = useState<AuditListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const navigate = useCallback(
    (next: Record<string, string | null>) => {
      const merged = new URLSearchParams(params);
      Object.entries(next).forEach(([key, value]) => (value === null ? merged.delete(key) : merged.set(key, value)));
      setParams(merged);
    },
    [params, setParams]
  );

  useEffect(() => {
    if (eventId) return;
    let alive = true;
    setError(null);
    const request =
      tab === "geral"
        ? auditoriaCentral.overview(applied).then((data) => alive && setOverview(data))
        : auditoriaCentral.list(applied, pageSize, page).then((data) => alive && setList(data));
    request.catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [tab, applied, pageSize, page, eventId, reloadKey]);

  const applyFilters = (next: AuditFilters) => {
    setApplied(next);
    setDraft(next);
    setPage(1);
  };
  const drill = (patch: Partial<AuditFilters>) => {
    applyFilters({ ...applied, ...patch });
    navigate({ aba: "logs" });
  };

  if (eventId) return <DetailView id={eventId} onBack={() => navigate({ evento: null })} />;

  const pages = list ? totalPages(list.total, pageSize) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-950">Auditoria</h1>
        <p className="text-sm text-ink-muted">Central de consulta, somente leitura. Eventos gravados são imutáveis.</p>
      </div>

      <div role="tablist" aria-label="Seções da auditoria" className="flex gap-2">
        {([["geral", "Visão Geral"], ["logs", "Logs de Auditoria"]] as const).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => navigate({ aba: key })}
            className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", tab === key ? "bg-forest-900 text-cream-50" : "border border-forest-950/15 text-forest-900")}
          >
            {label}
          </button>
        ))}
      </div>

      <FiltersBar draft={draft} setDraft={setDraft} onApply={() => applyFilters(draft)} onClear={() => applyFilters(defaultAuditFilters())} />

      {error && <AdminState variant="error" message={`Não foi possível carregar: ${error}`} onRetry={() => setReloadKey((k) => k + 1)} />}

      {!error && tab === "geral" && !overview && <AdminState variant="loading" message="Carregando visão geral..." />}
      {!error && tab === "geral" && overview && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total de registros" value={String(overview.total)} hint="Eventos no período e filtros de data" />
            <StatCard label="Usuários ativos" value={String(overview.human_actors)} hint="Atores humanos distintos com evento" />
            <StatCard label="Eventos de sistema" value={String(overview.system_events)} hint="Sistema, integração ou suporte" />
            <StatCard label="Última atividade" value={overview.last_event_at ? formatDateTime(overview.last_event_at) : "-"} hint="Evento mais recente da empresa" />
          </div>
          <DailyChart overview={overview} from={applied.from} to={applied.to} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <BarList title="Por tipo de evento" items={overview.by_event_type} onPick={(key) => drill({ eventType: key })} />
            <BarList title="Por entidade" items={overview.by_entity_type} onPick={(key) => drill({ entityType: key })} />
            <BarList title="Por tipo de ator" items={overview.by_actor_type.map((i) => ({ ...i, key: i.key }))} onPick={(key) => drill({ actorType: key })} />
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <Unavailable>{AUDIT_UNAVAILABLE.modulo}</Unavailable>
            <Unavailable>{AUDIT_UNAVAILABLE.nivel}</Unavailable>
            <Unavailable>Eventos críticos, alertas e exceções: indisponíveis (não há política nem motor de exceções).</Unavailable>
            <Unavailable>Módulos monitorados e cobertura: indisponíveis (não há catálogo de módulos auditáveis).</Unavailable>
          </div>
        </>
      )}

      {!error && tab === "logs" && !list && <AdminState variant="loading" message="Carregando eventos..." />}
      {!error && tab === "logs" && list && (
        <>
          {list.rows.length === 0 ? (
            <AdminState variant="empty" message="Nenhum evento para os filtros escolhidos." />
          ) : (
            <ul className="flex flex-col gap-2">
              {list.rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-2xl border border-forest-950/10 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-semibold text-forest-950">{row.event_type}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {formatDateTime(row.occurred_at)} · {actorLabel(row.actor_type, row.actor_user_id)}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {row.entity_type} · {row.entity_id} · corr. {shortId(row.correlation_id)}
                    </p>
                  </div>
                  <Button variant="outline" size="md" aria-label={`Ver evento ${row.event_type}`} onClick={() => navigate({ evento: row.id })}>
                    <Eye size={16} aria-hidden /> Ver
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {list.total} evento(s) · página {Math.min(page, pages)} de {pages}
            </p>
            <div className="flex items-center gap-2">
              <select aria-label="Itens por página" className="h-11 rounded-xl border border-forest-950/15 bg-white px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {AUDIT_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <Button variant="outline" size="md" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} aria-hidden />
              </Button>
              <Button variant="outline" size="md" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          </div>
          <Unavailable>{`${AUDIT_UNAVAILABLE.modulo} ${AUDIT_UNAVAILABLE.nivel} Antes/Depois aparecem só no detalhe, dentro do payload.`}</Unavailable>
        </>
      )}
    </div>
  );
}
