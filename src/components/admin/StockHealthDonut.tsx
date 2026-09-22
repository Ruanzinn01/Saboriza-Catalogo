import { formatNumber } from "@/lib/number";
const RADIUS = 54;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface StockHealthDonutProps {
  green: number;
  yellow: number;
  red: number;
  outOfStock?: number;
  onSelect?: (level: "green" | "yellow" | "red") => void;
  selected?: "green" | "yellow" | "red" | null;
}

const colors = {
  green: "var(--color-forest-600)",
  yellow: "var(--color-gold-500)",
  red: "#dc2626",
};

export function StockHealthDonut({ green, yellow, red, outOfStock = 0, onSelect, selected }: StockHealthDonutProps) {
  const total = green + yellow + red;
  const segments: { level: "green" | "yellow" | "red"; value: number; label: string }[] = [
    { level: "green", value: green, label: "Saudável" },
    { level: "yellow", value: yellow, label: "Atenção" },
    { level: "red", value: red, label: "Crítico" },
  ];

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-forest-950/10 bg-white p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
        <svg
          viewBox="0 0 128 128"
          role="img"
          aria-label={`Saúde do estoque: ${green} saudáveis, ${yellow} em atenção, ${red} críticos`}
          className="h-36 w-36 -rotate-90"
        >
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--color-ink-900)" strokeOpacity="0.08" strokeWidth={STROKE} />
          {total > 0 &&
            segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const fraction = segment.value / total;
                const dash = fraction * CIRCUMFERENCE;
                const el = (
                  <circle
                    key={segment.level}
                    cx="64"
                    cy="64"
                    r={RADIUS}
                    fill="none"
                    stroke={colors[segment.level]}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={-offset}
                    opacity={selected && selected !== segment.level ? 0.25 : 1}
                  />
                );
                offset += dash;
                return el;
              })}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-extrabold text-forest-950">{formatNumber(total)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Itens</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {segments.map((segment) => (
          <button
            key={segment.level}
            type="button"
            aria-pressed={selected === segment.level}
            onClick={() => onSelect?.(segment.level)}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-2 py-1 text-left text-sm transition-colors ${
              onSelect ? "hover:bg-forest-950/5" : ""
            } ${selected === segment.level ? "bg-forest-950/5" : ""}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[segment.level] }} />
            <span className="text-ink-900">{segment.label}</span>
            <span className="font-bold text-ink-900">{formatNumber(segment.value)}</span>
            {segment.level === "red" && outOfStock > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">{formatNumber(outOfStock)} sem estoque</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
