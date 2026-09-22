import type { AgingLevel } from "@/types/separation";

const SEGMENT_COLORS: Record<AgingLevel, string> = {
  normal: "#9CA3AF",
  atencao: "#F59E0B",
  "laranja-claro": "#FB923C",
  "laranja-forte": "#F97316",
  vermelho: "#EF4444",
  critico: "#111827",
};

const SEGMENT_LABELS: Record<AgingLevel, string> = {
  normal: "0 a 2 dias",
  atencao: "3 dias",
  "laranja-claro": "4 dias",
  "laranja-forte": "5 dias",
  vermelho: "6 a 9 dias",
  critico: "10 dias ou mais",
};

const ORDER: AgingLevel[] = ["normal", "atencao", "laranja-claro", "laranja-forte", "vermelho", "critico"];

interface SeparationWeeklyDonutProps {
  counts: Record<AgingLevel, number>;
}

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SeparationWeeklyDonut({ counts }: SeparationWeeklyDonutProps) {
  const total = ORDER.reduce((sum, level) => sum + counts[level], 0);

  let offset = 0;
  const segments = ORDER.filter((level) => counts[level] > 0).map((level) => {
    const fraction = total > 0 ? counts[level] / total : 0;
    const dash = fraction * CIRCUMFERENCE;
    const segment = { level, dash, offset };
    offset += dash;
    return segment;
  });

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-forest-950/10 bg-white p-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#E5E7EB" strokeWidth="18" />
          {segments.map((segment) => (
            <circle
              key={segment.level}
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={SEGMENT_COLORS[segment.level]}
              strokeWidth="18"
              strokeDasharray={`${segment.dash} ${CIRCUMFERENCE - segment.dash}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-forest-950">{total}</span>
          <span className="text-[11px] font-semibold text-ink-muted">na semana</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {ORDER.map((level) => {
          const count = counts[level];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={level} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[level] }} />
                <span className="text-ink-700/80">{SEGMENT_LABELS[level]}</span>
              </div>
              <span className="font-semibold text-ink-900">
                {count} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
