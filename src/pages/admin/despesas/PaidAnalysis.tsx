import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { Expense } from "@/store/despesas-store";
import { brl, DetailKpis, ExpenseTable } from "@/pages/admin/despesas/shared";
import { DESPESAS_COLORS } from "@/pages/admin/despesas/theme";

const C = DESPESAS_COLORS;
const CHART_COLORS = ["#208252", "#d2aa43", "#5f83b4", "#8b6c9f", "#799385", "#b77f58"];
const STRUCTURE_CATEGORIES = ["estrutura", "serviços profissionais", "comunicação"];

type PaidGroup = { name: string; value: number; rows: Expense[] };
type Detail = { title: string; rows: Expense[]; base: number; period: string };

const paidValue = (e: Expense) => e.paidAmount ?? 0;
const sumPaid = (rows: Expense[]) => rows.reduce((s, e) => s + paidValue(e), 0);
const percent = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%");
const moneyShort = (v: number) => `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil`;

/** Só entra nos gráficos o que de fato saiu de caixa: valor pago > 0, mesmo critério do KPI "Pago". */
export function paidRows(list: Expense[]): Expense[] {
  return list.filter((e) => paidValue(e) > 0);
}

function fundingGroup(e: Expense): string {
  if (e.origin === "stock") return "Compras de mercadorias e insumos";
  if (e.origin === "salary" || e.origin === "commission" || e.category.toLowerCase() === "pró-labore") return "Pessoal e remuneração";
  if (e.origin === "asset") return "Bens e investimentos";
  if (e.origin === "partner") return "Retiradas de sócios";
  if (STRUCTURE_CATEGORIES.includes(e.category.toLowerCase())) return "Estrutura e administração";
  return "Outras despesas operacionais";
}

function groupPaid(rows: Expense[], key: (e: Expense) => string): PaidGroup[] {
  const map = new Map<string, PaidGroup>();
  rows.forEach((e) => {
    const name = key(e);
    const group = map.get(name) ?? { name, value: 0, rows: [] };
    group.value += paidValue(e);
    group.rows.push(e);
    map.set(name, group);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const s = point(startDeg);
  const e = point(endDeg);
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${e.x} ${e.y} Z`;
}

function CardHead({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b p-4 max-[520px]:flex-col max-[520px]:items-start" style={{ borderColor: C.line }}>
      <div>
        <h2 className="flex items-center text-[19px] font-bold" style={{ color: C.green }}>
          <span className="mr-2 grid h-[30px] w-[30px] place-items-center rounded-[9px] text-lg" style={{ background: C.cream, color: C.accent }}>{icon}</span>
          {title}
        </h2>
        {sub && <p className="text-[11px]" style={{ color: C.muted }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const smallBtn = "rounded-[10px] border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap";
const smallBtnStyle = { borderColor: "#d8dfd7", color: C.green };

function ViewAll({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="block w-full rounded-b-3xl border-t p-2.5 text-sm font-semibold" style={{ borderColor: C.line, background: "#fbfcf8", color: "#2c7650" }}>
      {children}
    </button>
  );
}

/** Lista os pagamentos de uma faixa/fatia/torre — equivalente ao `showCashList()` do HTML V5.7. */
function PaidDetailModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const { expenseId } = useParams<{ expenseId?: string }>();
  const total = sumPaid(detail.rows);

  useEffect(() => {
    if (expenseId) onClose();
  }, [expenseId, onClose]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={detail.title}>
      <div className="my-6 flex w-full max-w-5xl flex-col gap-4 rounded-3xl bg-[#f7f5ee] p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-extrabold" style={{ color: C.green }}>{detail.title}</h2>
            <p className="text-sm" style={{ color: C.muted }}>Saídas realizadas · {detail.period}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-xl" style={{ borderColor: C.line }}>×</button>
        </div>
        <DetailKpis
          items={[
            { label: "Total pago", value: brl(total) },
            { label: "Participação nas saídas", value: percent(total, detail.base) },
            { label: "Pagamentos", value: String(detail.rows.length) },
            { label: "Período", value: detail.period },
          ]}
        />
        <div className="rounded-3xl border bg-white" style={{ borderColor: C.line }}>
          <ExpenseTable rows={[...detail.rows].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))} />
        </div>
      </div>
    </div>
  );
}

function useDetail() {
  const [detail, setDetail] = useState<Detail | null>(null);
  const close = useMemo(() => () => setDetail(null), []);
  return { detail, setDetail, close };
}

/** Funil de despesas + Despesas por categoria + Despesas por subcategoria. Valores = pago do período. */
export function PaidFunnelCard({ rows, periodLabel }: { rows: Expense[]; periodLabel: string }) {
  const { detail, setDetail, close } = useDetail();
  const paid = useMemo(() => paidRows(rows), [rows]);
  const total = sumPaid(paid);
  const groups = useMemo(() => groupPaid(paid, fundingGroup), [paid]);
  const open = (title: string, list: Expense[]) => setDetail({ title, rows: list, base: total, period: periodLabel });

  let offset = 0;
  const rowGrid = "grid grid-cols-[minmax(0,1fr)_108px] gap-2.5 pl-12 sm:grid-cols-[minmax(0,1fr)_165px] sm:gap-3 md:grid-cols-[minmax(0,1fr)_210px] md:gap-[22px] md:pl-[58px] xl:grid-cols-[minmax(0,1fr)_250px] xl:pl-[72px]";

  return (
    <article className="flex flex-col rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <CardHead
        icon="▱"
        title="Funil de despesas"
        sub="100% do total pago, distribuído do maior gasto para o menor"
        action={<button onClick={() => open("Todas as despesas pagas", paid)} className={smallBtn} style={smallBtnStyle}>Ver todos os pagamentos</button>}
      />
      <div className="px-2.5 py-3.5 sm:px-[22px] sm:py-5">
        {total === 0 ? (
          <p className="p-6 text-center text-sm" style={{ color: C.muted }}>Nenhum pagamento confirmado neste período.</p>
        ) : (
          <>
            <div className={`${rowGrid} mb-1 items-center text-[9px]`} style={{ color: "#869085" }}>
              <div className="flex justify-between"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
              <span>Categoria e valor pago</span>
            </div>
            <button onClick={() => open("Todas as despesas pagas", paid)} className={`${rowGrid} min-h-[84px] w-full items-center border-t py-2.5 text-left hover:bg-[#faf9f3] md:min-h-[72px]`} style={{ borderColor: "#ececdf" }}>
              <div className="relative h-[34px] border-r md:h-9" style={{ borderColor: "#e6e9e0" }}>
                <span className="absolute top-2.5 whitespace-nowrap text-[10px] font-extrabold md:text-xs" style={{ left: 0, transform: "translateX(calc(-100% - 6px))", color: "#345d45" }}>100%</span>
                <span className="absolute left-0 top-0 grid h-full w-full place-items-center rounded" style={{ background: C.green }}>
                  <b className="whitespace-nowrap text-[10px] text-white md:text-[13px]">{brl(total)}</b>
                </span>
              </div>
              <div>
                <strong className="block text-[10px] leading-snug md:text-sm" style={{ color: "#244b39" }}>Total das despesas</strong>
                <small className="mt-1 block text-[9px] md:text-[11px]" style={{ color: "#74816f" }}>Tudo que saiu de dinheiro no período</small>
              </div>
            </button>
            {groups.map((g, i) => {
              const pct = (g.value / total) * 100;
              const left = offset;
              offset += pct;
              return (
                <button key={g.name} onClick={() => open(g.name, g.rows)} className={`${rowGrid} min-h-[84px] w-full items-center border-t py-2.5 text-left hover:bg-[#faf9f3] md:min-h-[72px]`} style={{ borderColor: "#ececdf" }}>
                  <div className="relative h-[34px] border-r md:h-9" style={{ borderColor: "#e6e9e0", backgroundImage: "linear-gradient(90deg,#e6e9e080 1px,transparent 1px)", backgroundSize: "25% 100%" }}>
                    <span className="absolute top-2.5 whitespace-nowrap text-[10px] font-extrabold md:text-xs" style={{ left: `${left}%`, transform: "translateX(calc(-100% - 6px))", color: "#345d45" }}>{percent(g.value, total)}</span>
                    <span className="absolute top-0 h-full rounded will-change-transform" style={{ left: `${left}%`, width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                  <div>
                    <strong className="block text-[10px] leading-snug md:text-xs" style={{ color: "#244b39" }}>{g.name}</strong>
                    <small className="mt-1 block text-[9px] md:text-[11px]" style={{ color: "#74816f" }}>{brl(g.value)} · {percent(g.value, total)}</small>
                  </div>
                </button>
              );
            })}
            <div className="flex items-center justify-between gap-3 border-t pb-1 pt-4 text-xs max-[850px]:flex-col max-[850px]:items-start" style={{ borderColor: "#e2e5d8", color: "#244b39" }}>
              <strong>{brl(total)} · 100% distribuído</strong>
              <span className="text-[10px]" style={{ color: C.muted }}>{groups.length} grupos · do maior gasto para o menor · clique nas faixas para detalhar</span>
            </div>
          </>
        )}
      </div>
      {detail && <PaidDetailModal detail={detail} onClose={close} />}
    </article>
  );
}

export function PaidCategoryCard({ rows, periodLabel }: { rows: Expense[]; periodLabel: string }) {
  const { detail, setDetail, close } = useDetail();
  const paid = useMemo(() => paidRows(rows), [rows]);
  const total = sumPaid(paid);
  const groups = useMemo(() => groupPaid(paid, (e) => e.category), [paid]);
  const open = (title: string, list: Expense[]) => setDetail({ title, rows: list, base: total, period: periodLabel });

  let start = 0;
  const slices = groups.map((g, i) => {
    const end = start + (total ? (g.value / total) * 360 : 0);
    const slice = { ...g, start, end, color: CHART_COLORS[i % CHART_COLORS.length] };
    start = end;
    return slice;
  });

  return (
    <article className="flex flex-col rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <CardHead icon="◉" title="Despesas por categoria" sub={periodLabel} action={<span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#faf0d7", color: "#977021" }}>Valor + participação</span>} />
      <div className="grid grid-cols-1 items-center gap-3 p-[18px] md:grid-cols-[210px_1fr]">
        <svg viewBox="0 0 230 230" className="mx-auto h-[210px] w-[210px]" role="img" aria-label="Categorias dos pagamentos realizados">
          {slices.map((s) =>
            s.end - s.start >= 359.99 ? (
              <circle key={s.name} cx={115} cy={115} r={91} fill={s.color} stroke="#fff" strokeWidth={2} className="cursor-pointer hover:opacity-80" onClick={() => open(s.name, s.rows)} />
            ) : (
              <path key={s.name} d={arcPath(115, 115, 91, s.start, s.end)} fill={s.color} stroke="#fff" strokeWidth={2} className="cursor-pointer transition hover:opacity-80" onClick={() => open(s.name, s.rows)}>
                <title>{`${s.name} · ${brl(s.value)} · ${percent(s.value, total)}`}</title>
              </path>
            )
          )}
          <circle cx={115} cy={115} r={59} fill="#fff" />
          <text x={115} y={111} textAnchor="middle" fontSize={14} fontWeight={800} fill={C.green}>{moneyShort(total)}</text>
          <text x={115} y={133} textAnchor="middle" fontSize={10} fill={C.muted}>total pago</text>
        </svg>
        <div>
          {slices.map((s) => (
            <button key={s.name} onClick={() => open(s.name, s.rows)} className="flex w-full items-center justify-between gap-3 border-b py-2.5 text-left text-[11px]" style={{ borderColor: "#eef0e8" }}>
              <span className="flex items-center"><i className="mr-1.5 inline-block h-2 w-2 rounded-[3px]" style={{ background: s.color }} />{s.name}</span>
              <strong className="whitespace-nowrap text-right">{brl(s.value)}<small className="mt-0.5 block text-[9px] font-normal" style={{ color: C.muted }}>{percent(s.value, total)}</small></strong>
            </button>
          ))}
        </div>
      </div>
      <p className="px-2.5 pb-4 text-center text-[10px]" style={{ color: C.muted }}>{total ? "100% das saídas · " : "Nenhum pagamento · "}{brl(total)}</p>
      <div className="mt-auto"><ViewAll onClick={() => open("Todas as despesas pagas", paid)}>Ver todos os pagamentos ›</ViewAll></div>
      {detail && <PaidDetailModal detail={detail} onClose={close} />}
    </article>
  );
}

export function PaidSubcategoryCard({ rows, periodLabel }: { rows: Expense[]; periodLabel: string }) {
  const { detail, setDetail, close } = useDetail();
  const paid = useMemo(() => paidRows(rows), [rows]);
  const total = sumPaid(paid);
  const groups = useMemo(() => groupPaid(paid, (e) => e.subcategory || e.category), [paid]);
  const open = (title: string, list: Expense[]) => setDetail({ title, rows: list, base: total, period: periodLabel });

  return (
    <article className="flex flex-col rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <CardHead icon="☰" title="Despesas por subcategoria" sub={periodLabel} action={<button onClick={() => open("Todas as despesas pagas", paid)} className={smallBtn} style={smallBtnStyle}>Ver todas</button>} />
      <div className="px-5 py-[18px]">
        <div className="mb-1 border-b pb-3.5 pt-2 text-xs font-bold" style={{ borderColor: "#e7eadf", color: "#345d45" }}>
          Total pago · {brl(total)}{total ? " · 100%" : ""}
        </div>
        {groups.slice(0, 8).map((g, i) => (
          <button key={g.name} onClick={() => open(g.name, g.rows)} className="block w-full py-3 text-left">
            <div className="mb-[7px] flex items-center justify-between gap-2.5 text-[11px]">
              <strong className="font-semibold">{g.name}</strong>
              <span className="whitespace-nowrap font-bold">{brl(g.value)} <small className="ml-1.5 font-normal" style={{ color: C.muted }}>{percent(g.value, total)}</small></span>
            </div>
            <div className="h-2 overflow-hidden rounded-lg" style={{ background: "#f1f1e9" }}>
              <i className="block h-full rounded-lg" style={{ width: `${total ? (g.value / total) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
            </div>
          </button>
        ))}
        <p className="text-[10px]" style={{ color: C.muted }}>Maiores subcategorias · cada percentual usa o total pago como 100%</p>
      </div>
      {detail && <PaidDetailModal detail={detail} onClose={close} />}
    </article>
  );
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Torres por trimestre do ano da competência, até o mês selecionado. Mês usa o vencimento, como os KPIs. */
export function PaidQuarterCard({ all, referenceDate }: { all: Expense[]; referenceDate: Date }) {
  const { detail, setDetail, close } = useDetail();
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();

  const quarters = useMemo(() => {
    const paid = paidRows(all);
    const result = [0, 1, 2, 3].map((q) => {
      const months = [q * 3, q * 3 + 1, q * 3 + 2].filter((m) => m <= monthIndex);
      const rows = paid.filter((e) => {
        const ref = e.dueDate ?? e.competence;
        if (!ref || Number(ref.slice(0, 4)) !== year) return false;
        return months.includes(Number(ref.slice(5, 7)) - 1);
      });
      return { q, count: months.length, rows, value: sumPaid(rows) };
    });
    return result;
  }, [all, year, monthIndex]);

  const yearTotal = quarters.reduce((s, q) => s + q.value, 0);
  const max = Math.max(...quarters.map((q) => q.value), 1) * 1.2;
  const bottom = 226;
  const y = (v: number) => bottom - (v / max) * 180;

  function openQuarter(q: (typeof quarters)[number]) {
    if (!q.count) return;
    setDetail({ title: `${q.q + 1}º trimestre · despesas pagas`, rows: q.rows, base: yearTotal, period: `${year} · ${q.count} mês(es)` });
  }

  return (
    <article className="flex flex-col rounded-3xl border bg-white" style={{ borderColor: C.line }}>
      <CardHead
        icon="▥"
        title="Despesas por trimestre · pago"
        sub="Uma torre para cada trimestre · valores visíveis · clique para detalhar"
        action={<span className="rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap" style={{ background: "#faf0d7", color: "#977021" }}>{year} · até {MONTH_NAMES[monthIndex]}</span>}
      />
      <div className="p-3.5">
        <svg viewBox="0 0 620 280" className="mx-auto block h-auto w-full max-w-[1050px]" role="img" aria-label="Total das despesas pagas em cada trimestre">
          {[0, 0.5, 1].map((t) => {
            const v = Math.round((max * t) / 1000) * 1000;
            return (
              <g key={t}>
                <line x1={50} x2={610} y1={y(v)} y2={y(v)} stroke="#e8ebe5" strokeWidth={1} />
                <text x={2} y={y(v) + 4} fontSize={10} fill="#7c827b">{Math.round(v / 1000)} mil</text>
              </g>
            );
          })}
          {quarters.map((q, i) => {
            const cx = 50 + (i + 0.5) * 140;
            const yy = y(q.value);
            return (
              <g key={q.q} tabIndex={0} role="button" aria-label={`${q.q + 1}º trimestre`} className="cursor-pointer" onClick={() => openQuarter(q)} onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && openQuarter(q)}>
                <rect x={cx - 24} y={yy} width={48} height={bottom - yy} rx={6} fill="#508268" />
                <text x={cx} y={yy - 10} textAnchor="middle" fontSize={12} fontWeight={750} fill="#345a44">{moneyShort(q.value)}</text>
                <text x={cx} y={248} textAnchor="middle" fontSize={10} fill="#7c827b">{q.q + 1}º trimestre</text>
                <text x={cx} y={266} textAnchor="middle" fontSize={10} fill="#7c827b">{q.count === 3 ? "3 meses" : q.count ? `${q.count} mês · parcial` : "Sem dados"}</text>
              </g>
            );
          })}
        </svg>
        <p className="text-[10px]" style={{ color: C.muted }}>O trimestre atual mostra somente os meses disponíveis até a competência selecionada.</p>
      </div>
      {detail && <PaidDetailModal detail={detail} onClose={close} />}
    </article>
  );
}
