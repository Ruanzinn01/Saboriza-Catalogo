import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/admin/estoque/EstoquePrimitives";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/number";
import { useEstoqueStore } from "@/store/estoque-store";
import type { ClosingRow } from "@/types/estoque";

const PERIODS = [
  { months: 1, label: "Mês" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "Ano" },
];

const monthShort = (competence: string) => {
  const [year, month] = competence.split("-");
  return `${month}/${year.slice(2)}`;
};

export function EstoqueHistorico({ goTo }: { goTo: (tab: string) => void }) {
  const closings = useEstoqueStore((s) => s.closings);
  const fetchClosings = useEstoqueStore((s) => s.fetchClosings);
  const [months, setMonths] = useState(6);
  const [detail, setDetail] = useState<ClosingRow | null>(null);

  useEffect(() => {
    void fetchClosings();
  }, [fetchClosings]);

  // Séries vêm só das fotografias de fechamento: nunca recalculam o passado.
  const series = useMemo(() => [...closings].sort((a, b) => a.competence.localeCompare(b.competence)).slice(-months), [closings, months]);
  const maxValue = Math.max(...series.map((row) => row.totalValue), 1);
  const maxFlow = Math.max(...series.flatMap((row) => [row.entriesValue, row.exitsValue]), 1);
  const step = series.length > 0 ? 520 / series.length : 520;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-forest-950">Como o estoque evoluiu</h2>
          <p className="text-xs text-ink-muted">O período altera os gráficos históricos; a posição atual permanece atual.</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((period) => (
            <button
              key={period.months}
              type="button"
              onClick={() => setMonths(period.months)}
              className={cn("min-h-11 rounded-xl border px-3 text-xs font-bold", months === period.months ? "border-forest-700 bg-forest-950/10 text-forest-950" : "border-ink-900/15 text-ink-muted")}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <Card title="Histórico mensal" note="Os gráficos nascem das fotografias de fechamento e nunca são recalculados depois.">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-700">Ainda não há competência fechada. Feche o mês em Relatórios mensais para começar o histórico.</p>
            <Button variant="outline" onClick={() => goTo("relatorios")}>Ir para Relatórios</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card title="Evolução do valor do estoque" note="R$ a custo · fechamentos mensais. Clique nas barras.">
            <svg viewBox="0 0 600 220" className="w-full p-3" role="img" aria-label="Evolução do valor do estoque">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="52" y1={173 - i * 48} x2="590" y2={173 - i * 48} stroke="#e5e8e1" />
                  <text x="1" y={176 - i * 48} fontSize="10" fill="#788078">{formatNumber((maxValue * i) / 3 / 1000, 1)}k</text>
                </g>
              ))}
              {series.map((row, index) => {
                const x = 62 + index * step;
                const height = (row.totalValue / maxValue) * 138;
                return (
                  <g key={row.id} role="button" tabIndex={0} aria-label={`Detalhar ${monthShort(row.competence)}`} onClick={() => setDetail(row)} onKeyDown={(e) => e.key === "Enter" && setDetail(row)} className="cursor-pointer">
                    <rect x={x} y={173 - height} width={step * 0.62} height={height} rx="4" fill="#357db5" />
                    <text x={x + step * 0.31} y={166 - height} textAnchor="middle" fontSize="10" fontWeight="700" fill="#18372d">{formatNumber(row.totalValue / 1000, 1)}k</text>
                    <text x={x + step * 0.31} y="195" textAnchor="middle" fontSize="10" fill="#788078">{monthShort(row.competence)}</text>
                  </g>
                );
              })}
            </svg>
          </Card>
          <Card title="Entradas × saídas" note="R$ a custo do fechamento, não pagamentos. Item sem custo conhecido fica fora das barras.">
            <svg viewBox="0 0 600 220" className="w-full p-3" role="img" aria-label="Entradas e saídas a custo">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="52" y1={173 - i * 48} x2="590" y2={173 - i * 48} stroke="#e5e8e1" />
                  <text x="1" y={176 - i * 48} fontSize="10" fill="#788078">{formatNumber((maxFlow * i) / 3 / 1000, 1)}k</text>
                </g>
              ))}
              {series.map((row, index) => {
                const x = 62 + index * step;
                const entries = (row.entriesValue / maxFlow) * 138;
                const exits = (row.exitsValue / maxFlow) * 138;
                return (
                  <g key={row.id} role="button" tabIndex={0} aria-label={`Detalhar ${monthShort(row.competence)}`} onClick={() => setDetail(row)} onKeyDown={(e) => e.key === "Enter" && setDetail(row)} className="cursor-pointer">
                    <rect x={x} y={173 - entries} width={step * 0.29} height={entries} rx="3" fill="#208252" />
                    <rect x={x + step * 0.32} y={173 - exits} width={step * 0.29} height={exits} rx="3" fill="#bf5a50" />
                    <text x={x + step * 0.3} y="195" textAnchor="middle" fontSize="10" fill="#788078">{monthShort(row.competence)}</text>
                  </g>
                );
              })}
            </svg>
            <p className="px-4 pb-3 text-[11px] text-ink-muted"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#208252]" />Entradas <span className="mx-1 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#bf5a50]" />Saídas</p>
          </Card>
        </div>
      )}

      <Dialog open={detail !== null} onClose={() => setDetail(null)} title={detail ? `${monthShort(detail.competence)} · fotografia de fechamento` : ""}>
        {detail && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">Posição</small><strong className="block text-lg">{formatCurrency(detail.totalValue)}</strong></div>
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">Entradas</small><strong className="block text-lg">{formatCurrency(detail.entriesValue)}</strong></div>
              <div className="rounded-xl border border-forest-950/10 p-3"><small className="text-ink-muted">Saídas</small><strong className="block text-lg">{formatCurrency(detail.exitsValue)}</strong></div>
            </div>
            <p className="rounded-xl bg-forest-950/5 p-3 text-xs leading-relaxed text-forest-900">
              Valores preservados do fechamento{detail.partial ? " (competência parcial no momento do fechamento)" : ""}. Posições vêm das fotografias de fechamento e fluxos dos movimentos da competência. Valores não representam caixa.
            </p>
            <Button variant="outline" onClick={() => { setDetail(null); goTo("relatorios"); }}>Abrir em Relatórios</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
