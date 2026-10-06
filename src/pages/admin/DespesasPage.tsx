import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { useDespesasStore, type ExpenseOrigin, type ExpensePattern } from "@/store/despesas-store";
import { AdminState } from "@/components/admin/AdminState";
import { Button } from "@/components/ui/Button";
import { brl, ExpenseTable, withContext } from "@/pages/admin/despesas/shared";
import { useDespesasFilters } from "@/pages/admin/despesas/useDespesasFilters";
import { DESPESAS_COLORS, ORIGIN_COLOR_HEX, KPI_DOT_COLOR } from "@/pages/admin/despesas/theme";
import { ReportModal } from "@/pages/admin/despesas/ReportModal";
import { ExpenseDetailModal } from "@/pages/admin/despesas/ExpenseDetailModal";

const C = DESPESAS_COLORS;

const PERIOD_OPTIONS: { value: "month" | "3m" | "6m" | "year"; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "year", label: "Ano" },
];

function monthLabel(ref: Date) {
  return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Evolução 3/6/12 meses — SVG, ponto clicável muda a competência principal (DRT §2). Badge de
 * variação vs. mês anterior, igual ao `renderEvolution` do HTML V2 oficial. */
function EvolutionChart({ referenceDate }: { referenceDate: Date }) {
  const getEvolution = useDespesasStore((s) => s.getEvolution);
  const { update, params } = useDespesasFilters();
  const evoWindow = (params.get("evo") as "3m" | "6m" | "1y" | null) ?? "6m";
  const series = getEvolution(evoWindow, referenceDate);

  const max = Math.max(...series.map((s) => s.total), 1) * 1.08;
  const min = Math.min(...series.map((s) => s.total)) * 0.92;
  const range = max - min || 1;
  const w = 500;
  const h = 110;
  const left = 24;
  const points = series.map((s, i) => ({
    x: series.length > 1 ? left + (i * (w - left * 2)) / (series.length - 1) : w / 2,
    y: 14 + ((max - s.total) / range) * h,
    ...s,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${points[points.length - 1]?.x ?? 0},${14 + h} L${points[0]?.x ?? 0},${14 + h} Z`;

  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : last;
  const pct = prev && prev.total ? ((last!.total - prev.total) / prev.total) * 100 : 0;

  return (
    <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
        <div>
          <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Evolução das despesas</h2>
          <p className="text-[11px]" style={{ color: C.muted }}>
            Últimos {evoWindow === "3m" ? "3" : evoWindow === "6m" ? "6" : "12"} meses · clique em qualquer mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["3m", "6m", "1y"] as const).map((w2) => (
              <button
                key={w2}
                onClick={() => update({ evo: w2 })}
                className="rounded-lg border px-2 py-1.5 text-[10px] font-bold"
                style={
                  evoWindow === w2
                    ? { background: "#eaf4ec", borderColor: "#cfe1d2", color: "#1c7046" }
                    : { borderColor: "#d8dfd7", color: C.green }
                }
              >
                {w2 === "3m" ? "3 meses" : w2 === "6m" ? "6 meses" : "1 ano"}
              </button>
            ))}
          </div>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#eaf4ec", color: "#28734e" }}>
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1).replace(".", ",")}% vs. {prev?.label.toLowerCase()}
          </span>
        </div>
      </div>
      <div className="p-3">
        <svg viewBox={`0 0 ${w} ${14 + h + 20}`} className="h-40 w-full" role="img" aria-label="Evolução mensal das despesas">
          <path d={area} fill="#e7f1e7" stroke="none" />
          <path d={path} fill="none" stroke="#2c8054" strokeWidth={3} />
          {points.map((p) => (
            <g key={p.month} onClick={() => update({ month: p.month, period: "month" })} className="cursor-pointer" role="button" aria-label={`Ver ${p.label}`}>
              <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={4.5} fill="white" stroke="#2c8054" strokeWidth={3} />
              <text x={p.x} y={p.y - 10} fontSize={10} fill="#2d4b3f" fontWeight={700} textAnchor="middle">
                {Math.round(p.total / 1000)}k
              </text>
              <text x={p.x} y={14 + h + 15} fontSize={10} fill="#7c827b" textAnchor="middle">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Origem em % (rosca) e em R$ (barras) — fatia/barra/legenda inteiras clicáveis (DRT §2/§4). */
function OriginCharts({ list }: { list: ReturnType<typeof useDespesasStore.getState>["expenses"] }) {
  const getByOrigin = useDespesasStore((s) => s.getByOrigin);
  const navigate = useNavigate();
  const { params } = useDespesasFilters();
  const origins = getByOrigin(list);
  const total = origins.reduce((s, o) => s + o.total, 0);

  function openOrigin(origin: string) {
    navigate(withContext(`/admin/despesas/origem/${origin}`, params));
  }

  let acc = 0;
  const radius = 79;
  const cx = 90;
  const cy = 90;
  const arcs = origins.map((o) => {
    const fraction = total > 0 ? o.total / total : 0;
    const startAngle = acc * 360;
    acc += fraction;
    const endAngle = acc * 360;
    const polar = (deg: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };
    const s = polar(endAngle);
    const e = polar(startAngle);
    const large = endAngle - startAngle <= 180 ? 0 : 1;
    return { ...o, fraction, path: `M ${cx} ${cy} L ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 0 ${e.x} ${e.y} Z` };
  });

  const maxBar = Math.max(...origins.map((o) => o.total), 1);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_.86fr]">
      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
          <div>
            <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Despesas por origem (%)</h2>
            <p className="text-[11px]" style={{ color: C.muted }}>Participação de cada origem · clique para aprofundar</p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#faf0d7", color: "#977021" }}>aprofundar</span>
        </div>
        <div className="grid grid-cols-[165px_1fr] items-center gap-3 p-4">
          <svg viewBox="0 0 180 180" className="mx-auto h-[165px] w-[165px]">
            {arcs.map((a) => (
              <path key={a.origin} d={a.path} fill={ORIGIN_COLOR_HEX[a.origin]} stroke="#fff" strokeWidth={2} className="cursor-pointer transition hover:opacity-85" onClick={() => openOrigin(a.origin)} />
            ))}
            <circle cx={90} cy={90} r={47} fill="#fff" />
            <text x={90} y={87} fontSize={12} fontWeight={800} fill={C.green} textAnchor="middle">{Math.round(total / 1000)} mil</text>
            <text x={90} y={103} fontSize={8} fill="#7d867e" textAnchor="middle">no período</text>
          </svg>
          <div className="grid gap-1">
            {arcs.map((a) => (
              <button key={a.origin} onClick={() => openOrigin(a.origin)} className="flex items-center justify-between rounded-lg px-1 py-1.5 text-left text-[10px] hover:bg-[#f4f7f1]">
                <span className="flex items-center gap-1.5 truncate" style={{ color: "#263f35" }}>
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ORIGIN_COLOR_HEX[a.origin] }} />
                  {a.label}
                </span>
                <strong>{(a.fraction * 100).toFixed(1).replace(".", ",")}%</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
          <div>
            <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Despesas por origem (R$)</h2>
            <p className="text-[11px]" style={{ color: C.muted }}>Comparação em valores · clique para aprofundar</p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#faf0d7", color: "#977021" }}>aprofundar</span>
        </div>
        <div className="p-4">
          <div className="flex h-32 items-end gap-2.5 border-b pb-1.5" style={{ borderColor: "#e8ebe5" }}>
            {origins.map((o) => (
              <button key={o.origin} onClick={() => openOrigin(o.origin)} className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] font-bold whitespace-nowrap">{brl(o.total)}</span>
                <span className="w-full max-w-[36px] rounded-t-md transition hover:brightness-95" style={{ background: ORIGIN_COLOR_HEX[o.origin], height: `${Math.max((o.total / maxBar) * 95, 5)}%` }} />
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {origins.map((o) => (
              <button key={o.origin} onClick={() => openOrigin(o.origin)} className="truncate rounded-lg px-1 py-1 text-left text-[10px] hover:bg-[#f4f7f1]" style={{ color: "#68736b" }}>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: ORIGIN_COLOR_HEX[o.origin] }} />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompositionCards({ list }: { list: ReturnType<typeof useDespesasStore.getState>["expenses"] }) {
  const getComposition = useDespesasStore((s) => s.getComposition);
  const { update } = useDespesasFilters();
  const composition = getComposition(list);

  return (
    <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <div className="border-b p-4" style={{ borderColor: C.line }}>
        <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Composição do período</h2>
        <p className="text-[11px]" style={{ color: C.muted }}>Fixas, variáveis e eventuais</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-3">
        {composition.map((c) => (
          <button
            key={c.pattern}
            onClick={() => update({ pattern: c.pattern as ExpensePattern })}
            className="relative rounded-[13px] border p-3.5 text-left hover:bg-[#f9fbf7]"
            style={{ borderColor: C.line }}
          >
            <span className="text-[11px]" style={{ color: C.muted }}>{c.label}</span>
            <strong className="mt-1.5 block whitespace-nowrap text-base" style={{ color: C.green }}>{brl(c.total)}</strong>
            <small className="text-[11px]" style={{ color: C.muted }}>{c.count} lançamento(s)</small>
            <span className="absolute right-2.5 top-2.5" style={{ color: "#a4ada6" }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DespesasPage() {
  const expenses = useDespesasStore((s) => s.expenses);
  const obligations = useDespesasStore((s) => s.obligations);
  const status = useDespesasStore((s) => s.status);
  const fetchAll = useDespesasStore((s) => s.fetchAll);
  const subscribeRealtime = useDespesasStore((s) => s.subscribeRealtime);
  const unsubscribeRealtime = useDespesasStore((s) => s.unsubscribeRealtime);
  const getByPeriod = useDespesasStore((s) => s.getByPeriod);
  const getByOrigin = useDespesasStore((s) => s.getByOrigin);
  const getComposition = useDespesasStore((s) => s.getComposition);
  const navigate = useNavigate();

  const { period, referenceDate, origin, status: statusFilter, search, setPeriod, moveMonth, update, params } = useDespesasFilters();
  const [showReport, setShowReport] = useState(false);
  const { expenseId } = useParams<{ expenseId?: string }>();

  useEffect(() => {
    fetchAll();
    subscribeRealtime();
    return () => unsubscribeRealtime();
  }, [fetchAll, subscribeRealtime, unsubscribeRealtime]);

  const periodExpenses = useMemo(() => getByPeriod(period, referenceDate), [getByPeriod, period, referenceDate, expenses]);

  const periodRange = useMemo(() => {
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();
    if (period === "month") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    if (period === "3m") return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 0) };
    if (period === "6m") return { from: new Date(y, m - 5, 1), to: new Date(y, m + 1, 0) };
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }, [period, referenceDate]);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let list = periodExpenses;
    if (origin) list = list.filter((e) => e.origin === origin);
    if (statusFilter) list = list.filter((e) => e.status === statusFilter);
    const patternParam = params.get("pattern");
    if (patternParam) list = list.filter((e) => e.pattern === patternParam);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.partyName?.toLowerCase().includes(q) ?? false) ||
          (e.documentRef?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [periodExpenses, origin, statusFilter, search, params]);

  const kpis = useMemo(() => {
    const total = periodExpenses.reduce((s, e) => s + e.amount, 0);
    const pago = periodExpenses.filter((e) => e.status === "PAGO").reduce((s, e) => s + e.amount, 0);
    const aPagar = periodExpenses
      .filter((e) => e.status === "ABERTO" || e.status === "ATRASADO" || e.status === "BLOQUEADO")
      .reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
    const agendado = periodExpenses.filter((e) => e.status === "AGENDADO").reduce((s, e) => s + e.amount, 0);
    const atrasado = periodExpenses.filter((e) => e.status === "ATRASADO").reduce((s, e) => s + (e.amount - (e.paidAmount ?? 0)), 0);
    return { total, pago, aPagar, agendado, atrasado };
  }, [periodExpenses]);

  const due = useMemo(
    () => expenses.filter((e) => e.status !== "PAGO" && e.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 6),
    [expenses]
  );

  const folha = useMemo(() => {
    const monthKey = referenceDate.toISOString().slice(0, 7);
    const monthObligations = obligations.filter((o) => o.competence.slice(0, 7) === monthKey);
    const brutaTotal = monthObligations.reduce((s, o) => s + o.baseSalary, 0);
    const pagoTotal = monthObligations.reduce((s, o) => s + (o.baseSalary - o.remaining), 0);
    return { bruta: brutaTotal, pago: pagoTotal, saldo: brutaTotal - pagoTotal, count: monthObligations.length };
  }, [obligations, referenceDate]);

  const kpiCards = [
    { key: null, label: "Total", value: kpis.total, sub: "Todos os compromissos", dot: KPI_DOT_COLOR.total },
    { key: "PAGO", label: "Pago", value: kpis.pago, sub: kpis.total ? `${Math.round((kpis.pago / kpis.total) * 100)}% do total` : "0% do total", dot: KPI_DOT_COLOR.pago },
    { key: "ABERTO", label: "A pagar", value: kpis.aPagar, sub: "Aberto + atrasado + bloqueado", dot: KPI_DOT_COLOR.aPagar },
    { key: "AGENDADO", label: "Agendado", value: kpis.agendado, sub: "Programado, ainda não pago", dot: KPI_DOT_COLOR.agendado },
    { key: "ATRASADO", label: "Atrasado", value: kpis.atrasado, sub: kpis.atrasado ? "Exige atenção" : "Nenhum vencido", dot: "#c45e54" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs" style={{ color: C.muted }}>Início › Despesas › Visão Geral</div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight" style={{ color: C.green }}>Despesas</h1>
          <p style={{ color: C.muted }}>Visão mensal integrada para acompanhar, analisar e aprofundar cada origem e situação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowReport(true)}>
            <FileText size={16} /> Relatório / PDF
          </Button>
          <Button onClick={() => navigate(withContext("/admin/despesas/nova", params))}>
            <Plus size={18} /> Nova despesa
          </Button>
        </div>
      </header>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2 rounded-[13px] border bg-white p-1.5" style={{ borderColor: C.line }}>
          <button onClick={() => moveMonth(-1)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-xl text-lg hover:bg-[#edf5ee]">‹</button>
          <span className="min-w-[150px] text-center text-[15px] font-bold capitalize" style={{ color: C.green }}>{monthLabel(referenceDate)}</span>
          <button onClick={() => moveMonth(1)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-xl text-lg hover:bg-[#edf5ee]">›</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="rounded-[10px] border px-3.5 py-2.5 text-sm font-semibold"
              style={period === opt.value ? { background: "#eaf4ec", borderColor: "#cfe1d2", color: "#1c7046" } : { borderColor: "#d8dfd7", color: C.green }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setPeriod("custom")}
            className="rounded-[10px] border px-3.5 py-2.5 text-sm font-semibold"
            style={period === "custom" ? { background: "#eaf4ec", borderColor: "#cfe1d2", color: "#1c7046" } : { borderColor: "#d8dfd7", color: C.green }}
          >
            Período
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:[grid-template-columns:1.25fr_repeat(4,1fr)]">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => update({ status: kpi.key })}
            className="relative rounded-[15px] border bg-white p-[17px] text-left transition hover:-translate-y-0.5"
            style={{ borderColor: C.line }}
          >
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: C.muted }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: kpi.dot }} />
              {kpi.label}
            </div>
            <strong className="my-2 block text-2xl" style={{ color: C.green }}>{brl(kpi.value)}</strong>
            <small style={{ color: C.muted }}>{kpi.sub}</small>
            <span className="absolute right-3.5 top-3" style={{ color: "#a0aaa2" }}>›</span>
          </button>
        ))}
      </div>

      <EvolutionChart referenceDate={referenceDate} />
      <OriginCharts list={periodExpenses} />
      <CompositionCards list={periodExpenses} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
            <div>
              <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Pessoal e remuneração</h2>
              <p className="text-[11px]" style={{ color: C.muted }}>Folha, adiantamentos e comissões separados</p>
            </div>
            <button onClick={() => navigate(withContext("/admin/despesas/pessoal", params))} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
              Aprofundar
            </button>
          </div>
          <div className="flex flex-col divide-y px-4" style={{ borderColor: "#eff0eb" }}>
            <div className="flex items-center justify-between gap-3 py-3">
              <div><strong style={{ color: C.green }}>Folha salarial</strong><p className="text-xs" style={{ color: C.muted }}>{folha.count} colaborador(es) · clique para ver cada pessoa</p></div>
              <div className="text-right"><p className="font-bold" style={{ color: C.green }}>{brl(folha.bruta)}</p></div>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <div><strong style={{ color: C.green }}>Saldo salarial a pagar</strong><p className="text-xs" style={{ color: C.muted }}>Após adiantamentos e pagamentos já realizados</p></div>
              <div className="text-right"><p className="font-bold" style={{ color: C.green }}>{brl(folha.saldo)}</p><small style={{ color: C.muted }}>{brl(folha.pago)} já pagos</small></div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
          <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
            <div>
              <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Próximos vencimentos</h2>
              <p className="text-[11px]" style={{ color: C.muted }}>Prioridade por data e situação</p>
            </div>
            <button onClick={() => navigate(withContext("/admin/despesas/vencimentos", params))} className="rounded-[10px] border px-2.5 py-1.5 text-xs font-bold" style={{ borderColor: "#d8dfd7", color: C.green }}>
              Ver todos
            </button>
          </div>
          {due.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: C.muted }}>Nada pendente.</p>
          ) : (
            <div className="px-4">
              {due.map((e) => (
                <button
                  key={e.id}
                  onClick={() => navigate(withContext(`/admin/despesas/${e.id}`, params))}
                  className="grid w-full grid-cols-[12px_1fr_58px_auto] items-start gap-2.5 border-b py-2.5 text-left last:border-none"
                  style={{ borderColor: "#eff0eb" }}
                >
                  <span className="mt-1 inline-block h-2 w-2 rounded-full" style={{ background: e.status === "ATRASADO" ? "#c45e54" : e.status === "AGENDADO" ? "#4885bd" : e.status === "BLOQUEADO" ? C.orange : C.gray }} />
                  <span>
                    <b style={{ color: C.green }}>{e.description}</b>
                    <small className="block" style={{ color: C.muted }}>{e.status === "BLOQUEADO" ? "Bloqueado" : e.status}</small>
                  </span>
                  <span className="text-center text-[15px] font-extrabold leading-tight whitespace-nowrap" style={{ color: C.red }}>{e.dueDate?.slice(8, 10)}/{e.dueDate?.slice(5, 7)}</span>
                  <span className="whitespace-nowrap font-bold" style={{ color: C.green }}>{brl(e.amount - (e.paidAmount ?? 0))}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
        <div className="flex items-center justify-between gap-2 border-b p-4" style={{ borderColor: C.line }}>
          <div>
            <h2 className="text-[19px] font-bold" style={{ color: C.green }}>Despesas do período</h2>
            <p className="text-[11px]" style={{ color: C.muted }}>Pesquise por despesa, fornecedor, colaborador, sócio ou documento.</p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "#eaf4ec", color: "#28734e" }}>{filtered.length} lançamento{filtered.length === 1 ? "" : "s"}</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-4 pb-2.5 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Busca geral</label>
            <input
              value={search}
              onChange={(e) => update({ search: e.target.value || null })}
              placeholder="Ex.: aluguel, fornecedor, NF 2431..."
              className="h-11 w-full rounded-[10px] border px-3 text-sm"
              style={{ borderColor: "#d9ded7" }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Categoria / origem</label>
            <select value={origin} onChange={(e) => update({ origin: e.target.value || null })} className="h-11 w-full rounded-[10px] border px-3 text-sm" style={{ borderColor: "#d9ded7" }}>
              <option value="">Todas</option>
              <option value="stock">Insumos e Mercadorias</option>
              <option value="asset">Bens e Investimentos</option>
              <option value="expense">Serviços e Outras Despesas</option>
              <option value="salary">Gestão Salarial</option>
              <option value="commission">Força de Vendas / Comissões</option>
              <option value="partner">Sócios e Retiradas</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wide" style={{ color: "#7a8179" }}>Status</label>
            <select value={statusFilter} onChange={(e) => update({ status: e.target.value || null })} className="h-11 w-full rounded-[10px] border px-3 text-sm" style={{ borderColor: "#d9ded7" }}>
              <option value="">Todos</option>
              <option value="ABERTO">Em aberto</option>
              <option value="AGENDADO">Agendado</option>
              <option value="PAGO">Pago</option>
              <option value="ATRASADO">Atrasado</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
        </div>

        {status === "loading" && expenses.length === 0 ? (
          <AdminState variant="loading" message="Carregando despesas..." />
        ) : status === "error" ? (
          <AdminState variant="error" message="Não foi possível carregar as despesas." />
        ) : (
          <ExpenseTable rows={filtered} />
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-[11px]" style={{ borderColor: C.line, color: C.muted }}>
          <span>Todos os lançamentos do período</span>
          <span><span className="rounded border px-1.5 py-0.5" style={{ borderColor: "#dfe3dc", background: "#f0f2ed" }}>clique</span> em qualquer linha para detalhar</span>
        </div>
      </div>

      {showReport && (
        <ReportModal
          onClose={() => setShowReport(false)}
          periodLabel={`${PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? period} · ${monthLabel(referenceDate)}`}
          periodExpenses={filtered}
          kpis={kpis}
          byOrigin={getByOrigin(periodExpenses)}
          composition={getComposition(periodExpenses)}
          periodFrom={toIso(periodRange.from)}
          periodTo={toIso(periodRange.to)}
        />
      )}

      {expenseId && <ExpenseDetailModal expenseId={expenseId} onClose={() => navigate(withContext("/admin/despesas", params))} />}
    </div>
  );
}
