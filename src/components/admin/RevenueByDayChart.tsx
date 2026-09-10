import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/currency";
import type { DailyRevenuePoint } from "@/lib/daily-revenue";

interface RevenueByDayChartProps {
  data: DailyRevenuePoint[];
  monthLabel: string;
}

const tooltipDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const GRID_STEPS = [1, 0.5, 0];

function formatAxisValue(value: number) {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${Math.round(value)}`;
}

export function RevenueByDayChart({ data, monthLabel }: RevenueByDayChartProps) {
  const max = Math.max(...data.map((point) => point.amount), 0);
  const today = new Date();

  return (
    <div className="rounded-3xl border border-forest-950/10 bg-white p-5 sm:p-6">
      <p className="text-sm font-bold text-forest-950">Faturamento por dia — {monthLabel}</p>

      <div className="mt-6 flex gap-3">
        <div className="flex h-40 w-14 shrink-0 flex-col justify-between text-right font-mono text-[11px] text-ink-700/70">
          {GRID_STEPS.map((step) => (
            <span key={step}>{formatAxisValue(max * step)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative flex h-40 items-end gap-[3px]">
            {GRID_STEPS.map((step) => (
              <div
                key={step}
                aria-hidden
                className="absolute inset-x-0 border-t border-forest-950/10"
                style={{ bottom: `${step * 100}%` }}
              />
            ))}

            {data.map((point) => {
              const hasRevenue = point.amount > 0;
              const heightPct = hasRevenue ? Math.max((point.amount / max) * 100, 4) : 0;
              const isToday = point.date.toDateString() === today.toDateString();

              return (
                <div
                  key={point.day}
                  tabIndex={hasRevenue ? 0 : -1}
                  className="group relative z-10 flex h-full flex-1 items-end rounded-t-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-600 focus-visible:ring-offset-2"
                >
                  {hasRevenue && (
                    <div
                      className={cn(
                        "mx-auto w-full max-w-[14px] rounded-t-[4px] transition-colors",
                        isToday ? "bg-gold-600" : "bg-gold-500/80 group-hover:bg-gold-600 group-focus-visible:bg-gold-600"
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  )}
                  {hasRevenue && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded-lg bg-forest-950 px-2.5 py-1.5 text-xs text-cream-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="block font-bold">{formatCurrency(point.amount)}</span>
                      <span className="block text-cream-100/70">{tooltipDateFormatter.format(point.date)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-700/70">
            <span>dia {data[0]?.day}</span>
            <span>dia {data[data.length - 1]?.day}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
