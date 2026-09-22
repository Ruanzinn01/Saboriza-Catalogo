import type { WeeklyProductionPoint } from "@/lib/weekly-production";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/number";

interface WeeklyProductionChartProps {
  data: WeeklyProductionPoint[];
  selectedDate?: Date | null;
  onSelectDay?: (date: Date) => void;
}

export function WeeklyProductionChart({ data, selectedDate, onSelectDay }: WeeklyProductionChartProps) {
  const max = Math.max(...data.map((point) => point.units), 1);
  const total = data.reduce((sum, point) => sum + point.units, 0);
  const today = new Date();

  return (
    <div className="rounded-3xl border border-forest-950/10 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-forest-950">Produção da semana</p>
        <p className="text-xs font-semibold text-ink-muted">
          <span className="text-base font-extrabold text-forest-950">{formatNumber(total)}</span> un no total
        </p>
      </div>
      <div className="mt-4 flex items-end gap-1.5 sm:gap-2">
        {data.map((point) => {
          const heightPct = point.units > 0 ? Math.max((point.units / max) * 100, 6) : 0;
          const isToday = point.date.toDateString() === today.toDateString();
          const isSelected = selectedDate ? point.date.toDateString() === selectedDate.toDateString() : false;
          return (
            <button
              key={point.date.toISOString()}
              type="button"
              disabled={!onSelectDay}
              aria-label={`${point.day}: ${formatNumber(point.units)} unidades${isToday ? " (hoje)" : ""}`}
              onClick={onSelectDay ? () => onSelectDay(point.date) : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 transition-colors disabled:cursor-default",
                onSelectDay && "cursor-pointer hover:bg-forest-950/5",
                isSelected && "bg-forest-950/5"
              )}
            >
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold",
                  point.units > 0 ? (isToday ? "bg-gold-500/20 text-forest-950" : "bg-forest-700/10 text-forest-950") : "text-ink-muted"
                )}
              >
                {formatNumber(point.units)}
              </span>
              <div className="flex h-24 w-full items-end rounded-t-md bg-forest-950/5">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-colors",
                    isSelected ? "bg-forest-900" : isToday ? "bg-gold-600" : "bg-forest-700/70"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={cn("font-mono text-[10px] uppercase", isToday ? "font-bold text-gold-600" : "text-ink-muted")}>{point.day}</span>
            </button>
          );
        })}
      </div>
      {total === 0 && <p className="mt-3 text-center text-xs text-ink-muted">Nenhuma produção registrada nesta semana.</p>}
    </div>
  );
}
